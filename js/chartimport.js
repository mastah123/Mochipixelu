/* Mochipixelu — "Import a chart": pick an image of a finished pattern, set the pattern area (crop box),
 * check the preview, and import it as a new pattern. Uses Mochi.Chart for grid detection and cell reading. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});

  M.ChartImport = {
    init(app) {
      const $ = app.$;
      const U = M.Utils;
      const dlg = $('chart-dialog');
      const cv = $('chart-canvas');
      const ctx = cv.getContext('2d');
      const pv = $('chart-preview');
      const pctx = pv.getContext('2d');

      let src = null; // { data, width, height, name }
      let base = null; // offscreen canvas holding the image
      let name = 'Imported chart';
      let box = { x: 0, y: 0, w: 1, h: 1 }; // pattern area in image pixels
      let scale = 1;
      let drag = null;
      let result = null;
      let timer = 0;

      const cols = () => U.clamp(Math.round(Number($('chart-cols').value)) || 1, 1, U.MAX_SIZE);
      const rows = () => U.clamp(Math.round(Number($('chart-rows').value)) || 1, 1, U.MAX_SIZE);
      const grid = () => ({ x: box.x, y: box.y, cols: cols(), rows: rows(), cellW: box.w / cols(), cellH: box.h / rows() });

      /* ---------- drawing ---------- */
      const layout = () => {
        const stage = $('chart-stage');
        const maxW = Math.max(120, stage.clientWidth || 300);
        const maxH = Math.max(120, Math.round((root.innerHeight || 700) * 0.33));
        scale = Math.min(maxW / src.width, maxH / src.height);
        const dpr = root.devicePixelRatio || 1;
        cv.style.width = Math.round(src.width * scale) + 'px';
        cv.style.height = Math.round(src.height * scale) + 'px';
        cv.width = Math.round(src.width * scale * dpr);
        cv.height = Math.round(src.height * scale * dpr);
        ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      };
      const handles = () => [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]];
      const draw = () => {
        if (!src) return;
        ctx.clearRect(0, 0, src.width, src.height);
        ctx.drawImage(base, 0, 0);
        ctx.fillStyle = 'rgba(20,16,40,.5)';
        ctx.fillRect(0, 0, src.width, box.y);
        ctx.fillRect(0, box.y + box.h, src.width, src.height - box.y - box.h);
        ctx.fillRect(0, box.y, box.x, box.h);
        ctx.fillRect(box.x + box.w, box.y, src.width - box.x - box.w, box.h);
        const g = grid();
        const px = 1 / scale;
        if (g.cols * g.rows <= 20000) {
          ctx.lineWidth = px;
          ctx.strokeStyle = 'rgba(255,60,140,.85)';
          ctx.beginPath();
          for (let i = 1; i < g.cols; i++) { ctx.moveTo(g.x + i * g.cellW, g.y); ctx.lineTo(g.x + i * g.cellW, g.y + box.h); }
          for (let j = 1; j < g.rows; j++) { ctx.moveTo(g.x, g.y + j * g.cellH); ctx.lineTo(g.x + box.w, g.y + j * g.cellH); }
          ctx.stroke();
        }
        ctx.lineWidth = 2.5 * px;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.lineWidth = 1.2 * px;
        ctx.strokeStyle = '#3a2a6a';
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        handles().forEach(([hx, hy]) => {
          ctx.beginPath();
          ctx.arc(hx, hy, 9 * px, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 2 * px;
          ctx.strokeStyle = '#3a2a6a';
          ctx.stroke();
        });
      };

      const drawPreview = () => {
        if (!result) return;
        const { cols: c, rows: r, pixels } = result;
        const cell = Math.max(2, Math.min(14, Math.floor(280 / Math.max(c, r))));
        pv.width = c * cell;
        pv.height = r * cell;
        for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) {
          const v = pixels[j * c + i];
          pctx.fillStyle = v < 0 ? ((i + j) % 2 ? '#e6e1f2' : '#f4f1fb') : U.toHex(v);
          pctx.fillRect(i * cell, j * cell, cell, cell);
        }
      };
      const read = () => {
        if (!src) return;
        const g = grid();
        result = M.Chart.readCells(src, g, { empty: $('chart-empty').value });
        const used = result.palette.length;
        const filled = result.pixels.reduce((n, v) => n + (v >= 0 ? 1 : 0), 0);
        $('chart-info').textContent = g.cols + ' × ' + g.rows + ' · ' + used + ' colors · ' + filled + ' stitches';
        $('chart-import').disabled = !filled;
        drawPreview();
      };
      const later = () => { clearTimeout(timer); timer = setTimeout(read, 120); };
      const redraw = () => { draw(); later(); };

      /* ---------- grid detection ---------- */
      const apply = (g) => {
        box = { x: g.x, y: g.y, w: g.cols * g.cellW, h: g.rows * g.cellH };
        box.w = Math.min(box.w, src.width - box.x);
        box.h = Math.min(box.h, src.height - box.y);
        $('chart-cols').value = g.cols;
        $('chart-rows').value = g.rows;
      };
      const find = (useBox) => {
        const g = M.Chart.detectGrid(src, useBox ? { rect: box } : undefined);
        if (!g) {
          $('chart-hint').textContent = 'No regular grid found in this box. Move the corners to wrap only the squares, or type the columns and rows yourself.';
          return false;
        }
        apply(g);
        $('chart-hint').textContent = 'Found a ' + g.cols + ' × ' + g.rows + ' grid. Drag the corners if the box is off, then check the preview.';
        return true;
      };
      $('chart-find').addEventListener('click', () => { find(true); redraw(); });

      /* ---------- dragging the box ---------- */
      const toImg = (e) => {
        const r = cv.getBoundingClientRect();
        return { x: ((e.clientX - r.left) / r.width) * src.width, y: ((e.clientY - r.top) / r.height) * src.height };
      };
      cv.addEventListener('pointerdown', (e) => {
        if (!src) return;
        const p = toImg(e);
        const reach = 24 / scale;
        const hs = handles();
        let k = -1, best = reach;
        hs.forEach(([hx, hy], i) => { const d = Math.hypot(hx - p.x, hy - p.y); if (d < best) { best = d; k = i; } });
        if (k >= 0) drag = { kind: 'corner', k, start: p, box: Object.assign({}, box) };
        else if (p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h) drag = { kind: 'move', start: p, box: Object.assign({}, box) };
        if (drag) { cv.setPointerCapture(e.pointerId); e.preventDefault(); }
      });
      cv.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const p = toImg(e);
        const b = drag.box;
        const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        const min = 16;
        if (drag.kind === 'move') {
          box.x = U.clamp(b.x + dx, 0, src.width - b.w);
          box.y = U.clamp(b.y + dy, 0, src.height - b.h);
        } else {
          let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
          if (drag.k % 2 === 0) x0 = U.clamp(b.x + dx, 0, x1 - min); else x1 = U.clamp(b.x + b.w + dx, x0 + min, src.width);
          if (drag.k < 2) y0 = U.clamp(b.y + dy, 0, y1 - min); else y1 = U.clamp(b.y + b.h + dy, y0 + min, src.height);
          box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        }
        redraw();
      });
      const endDrag = () => { drag = null; };
      cv.addEventListener('pointerup', endDrag);
      cv.addEventListener('pointercancel', endDrag);

      ['chart-cols', 'chart-rows', 'chart-empty'].forEach((id) => $(id).addEventListener('input', redraw));
      $('chart-cancel').addEventListener('click', () => dlg.close());
      dlg.addEventListener('close', () => { src = null; base = null; result = null; clearTimeout(timer); });

      /* ---------- open + import ---------- */
      app.openChartImport = async (file) => {
        try {
          src = await M.Images.readFile(file);
          name = M.Images.baseName(file) || 'Imported chart';
          base = document.createElement('canvas');
          base.width = src.width;
          base.height = src.height;
          base.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(src.data), src.width, src.height), 0, 0);
          box = { x: 0, y: 0, w: src.width, h: src.height };
          $('chart-cols').value = 16;
          $('chart-rows').value = 16;
          $('chart-empty').value = 'auto';
          $('chart-hint').textContent = 'Looking for the grid…';
          dlg.showModal();
          layout();
          const ok = find(false);
          if (!ok) { box = { x: 0, y: 0, w: src.width, h: src.height }; }
          layout();
          redraw();
          read();
        } catch (err) {
          app.toast(err.message || 'Could not open that image.', true);
        }
      };
      $('file-chart-input').addEventListener('change', (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (f) app.openChartImport(f);
      });
      $('chart-import').addEventListener('click', () => {
        clearTimeout(timer);
        read();
        if (!result) return;
        const d = M.Design.create(result.cols, result.rows, U.EMPTY, name);
        d.pixels.set(result.pixels);
        const r = M.Storage.library.save(d);
        if (!r.ok) return app.toast(r.error, true);
        dlg.close();
        app.toast('Imported a ' + result.cols + ' × ' + result.rows + ' chart');
        M.Router.go('#/e/' + r.id);
      });
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
