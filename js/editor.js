/* Mochipixelu — editor controller: tools, pointer/touch input, selection/inspector, zoom, shortcuts. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const U = M.Utils;
  const D = M.Design;
  const EMPTY = U.EMPTY;

  const TOOL_KEYS = { b: 'pencil', e: 'eraser', g: 'fill', i: 'picker', q: 'inspect', m: 'mark', h: 'pan' };

  M.Editor = {
    init(app) {
      const $ = app.$;
      const { store, renderer, settings } = app;
      const canvas = $('canvas');
      const scroller = $('canvas-scroll');
      let stroke = null; // active drag: { last, changed, markValue, tool }
      let lastDims = '';
      const touches = new Map(); // active touch pointers (for pinch / two-finger pan)
      let gesture = null; // { dist, cell, ax, ay }
      let panDrag = null; // { id, x, y, sl, st }
      app.autoFit = true; // keep the whole design in view until the user zooms by hand

      /* ---------- tools ---------- */
      app.setTool = (tool) => {
        settings.tool = tool;
        document.body.dataset.tool = tool;
        document.querySelectorAll('.tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
        Array.from(scroller.classList)
          .filter((c) => c.startsWith('tool-'))
          .forEach((c) => scroller.classList.remove(c));
        scroller.classList.add('tool-' + tool);
        app.ui.emit('tool', tool);
      };

      document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => app.setTool(b.dataset.tool)));

      /* ---------- color ---------- */
      app.setColor = (color) => {
        settings.color = color;
        app.ui.emit('color', color);
      };
      app.addRecent = (color) => {
        const r = settings.recent;
        const i = r.indexOf(color);
        if (i === 0) return;
        if (i > 0) r.splice(i, 1);
        r.unshift(color);
        if (r.length > 14) r.pop();
        app.ui.emit('recent');
      };

      /* ---------- selection / hover ---------- */
      app.select = (cell, scrollIntoView) => {
        app.selected = cell;
        renderer.setSelected(cell);
        if (cell && scrollIntoView) revealCell(cell);
        updateInspector();
        app.ui.emit('selection', cell);
      };

      const revealCell = (cell) => {
        const c = renderer.cell;
        const left = canvas.offsetLeft + cell.x * c;
        const top = canvas.offsetTop + cell.y * c;
        const pad = c * 2;
        if (left - pad < scroller.scrollLeft) scroller.scrollLeft = left - pad;
        else if (left + c + pad > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = left + c + pad - scroller.clientWidth;
        if (top - pad < scroller.scrollTop) scroller.scrollTop = top - pad;
        else if (top + c + pad > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = top + c + pad - scroller.clientHeight;
      };

      const moveSelection = (dx, dy) => {
        const d = store.design;
        if (!app.selected) {
          // first key press just anchors the selection (hovered cell, else top-left)
          app.select(app.hover || { x: 0, y: 0 }, true);
          return;
        }
        const nx = U.clamp(app.selected.x + dx, 0, d.width - 1);
        const ny = U.clamp(app.selected.y + dy, 0, d.height - 1);
        app.select({ x: nx, y: ny }, true);
      };

      const cellInfo = (cell) => {
        const d = store.design;
        const i = cell.y * d.width + cell.x;
        const v = d.pixels[i];
        return { v, done: !!d.done[i], i };
      };

      const updateInspector = () => {
        const cell = app.selected || app.hover;
        const sw = $('insp-swatch');
        const title = $('insp-coords');
        const detail = $('insp-detail');
        ['insp-pick', 'insp-done'].forEach((id) => ($(id).disabled = !app.selected));
        if (!cell) {
          sw.className = 'swatch big empty';
          sw.style.background = '';
          title.textContent = 'No cell selected';
          detail.textContent = 'Tap the canvas — use the Inspect tool to lock a cell.';
          $('status-coords').textContent = '—';
          return;
        }
        const { v, done } = cellInfo(cell);
        const where = 'Column ' + (cell.x + 1) + ', Row ' + (cell.y + 1);
        $('status-coords').textContent = 'x ' + (cell.x + 1) + ' · y ' + (cell.y + 1);
        title.textContent = where + (app.selected && app.selected === cell ? ' (selected)' : '');
        if (v === EMPTY) {
          sw.className = 'swatch big empty';
          sw.style.background = '';
          detail.textContent = 'Empty — no stitch here.';
        } else {
          sw.className = 'swatch big';
          sw.style.background = U.toHex(v);
          const [r, g, b] = U.rgb(v);
          const e = app.getLegend().byColor.get(v);
          detail.textContent =
            U.toHex(v) + ' · rgb(' + r + ', ' + g + ', ' + b + ')' + (e ? ' · legend #' + e.index + ' ' + e.symbol : '') + ' · ' + (done ? 'done ✓' : 'to do');
        }
      };
      app.updateInspector = updateInspector;

      $('insp-pick').addEventListener('click', () => pickFromCell(app.selected));
      $('insp-done').addEventListener('click', () => toggleDone(app.selected));
      $('nav-up').addEventListener('click', () => moveSelection(0, -1));
      $('nav-down').addEventListener('click', () => moveSelection(0, 1));
      $('nav-left').addEventListener('click', () => moveSelection(-1, 0));
      $('nav-right').addEventListener('click', () => moveSelection(1, 0));

      /* ---------- cell actions ---------- */
      const pickFromCell = (cell) => {
        if (!cell) return false;
        const { v } = cellInfo(cell);
        if (v === EMPTY) {
          app.toast('That cell is empty — nothing to pick.');
          return false;
        }
        app.setColor(v);
        app.addRecent(v);
        return true;
      };

      const toggleDone = (cell) => {
        if (!cell) return;
        const d = store.design;
        const { v, done, i } = cellInfo(cell);
        if (v === EMPTY) {
          app.toast('Empty cells have no stitch to mark.');
          return;
        }
        store.checkpoint();
        d.done[i] = done ? 0 : 1;
        renderer.drawCell(cell.x, cell.y);
        store.touch({ keepPristine: true });
        updateInspector();
      };

      const paintCell = (x, y, tool) => {
        const d = store.design;
        if (!D.inBounds(d, x, y)) return;
        const i = y * d.width + x;
        if (tool === 'pencil') {
          if (d.pixels[i] === settings.color) return;
          d.pixels[i] = settings.color;
        } else if (tool === 'eraser') {
          if (d.pixels[i] === EMPTY) return;
          d.pixels[i] = EMPTY;
          d.done[i] = 0;
        } else if (tool === 'mark') {
          if (d.pixels[i] === EMPTY || d.done[i] === stroke.markValue) return;
          d.done[i] = stroke.markValue;
        }
        stroke.changed = true;
        renderer.drawCell(x, y);
      };

      const doFill = (cell) => {
        const d = store.design;
        const i = cell.y * d.width + cell.x;
        const from = d.pixels[i];
        const to = settings.color;
        if (from === to) return;
        store.checkpoint();
        const n = settings.fillAll ? D.replaceColor(d, from, to) : D.floodFill(d, cell.x, cell.y, to);
        if (n === 0) {
          store.dropCheckpoint();
          return;
        }
        renderer.draw();
        store.touch();
        app.addRecent(to);
      };

      /* ---------- touch gestures: two fingers = pinch-zoom + pan ---------- */
      const twoTouchState = () => {
        const pts = Array.from(touches.values());
        const a = pts[0];
        const b = pts[1];
        return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
      };

      const startGesture = () => {
        const { mid, dist } = twoTouchState();
        const r = canvas.getBoundingClientRect();
        gesture = { dist, cell: renderer.cell, ax: (mid.x - r.left) / renderer.cell, ay: (mid.y - r.top) / renderer.cell };
      };

      const updateGesture = () => {
        const { mid, dist } = twoTouchState();
        const next = Math.round((gesture.cell * dist) / gesture.dist);
        if (next !== renderer.cell && renderer.setCell(next)) {
          app.autoFit = false;
          syncZoomUi();
        }
        // keep the content point that started under the fingers under the fingers
        const r = canvas.getBoundingClientRect();
        scroller.scrollLeft += r.left + gesture.ax * renderer.cell - mid.x;
        scroller.scrollTop += r.top + gesture.ay * renderer.cell - mid.y;
      };

      /** A second finger landed: undo whatever the first finger had just started drawing. */
      const abortStroke = () => {
        if (!stroke) return;
        const s = stroke;
        stroke = null;
        if (s.changed) store.rollback();
        else store.dropCheckpoint();
      };

      /** Capture can throw if the pointer already ended (fast taps, synthetic events) — never fatal. */
      const capture = (e) => {
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch (err) {
          /* ignore */
        }
      };

      /* ---------- pointer input ---------- */
      canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.pointerType === 'touch') {
          touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (touches.size === 2) {
            e.preventDefault();
            abortStroke();
            panDrag = null;
            startGesture();
            return;
          }
          if (touches.size > 2) return;
        }
        const tool = settings.tool;
        if (tool === 'pan') {
          e.preventDefault();
          capture(e);
          panDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, sl: scroller.scrollLeft, st: scroller.scrollTop };
          return;
        }
        const cell = renderer.cellFromPoint(e.clientX, e.clientY);
        if (!cell) return;
        e.preventDefault();
        canvas.focus({ preventScroll: true });
        renderer.setHover(cell);
        app.hover = cell;

        if (tool === 'inspect') {
          app.select(cell);
          return;
        }
        if (tool === 'picker') {
          app.select(cell);
          if (pickFromCell(cell)) app.setTool('pencil');
          return;
        }
        if (tool === 'fill') {
          app.select(cell);
          doFill(cell);
          return;
        }
        // pencil / eraser / mark: a drag is one undo step
        capture(e);
        store.checkpoint();
        const info = cellInfo(cell);
        stroke = { last: cell, changed: false, tool, markValue: info.done ? 0 : 1 };
        paintCell(cell.x, cell.y, tool);
        app.select(cell);
      });

      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch' && touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (gesture && touches.size >= 2) {
          updateGesture();
          return;
        }
        if (panDrag && e.pointerId === panDrag.id) {
          scroller.scrollLeft = panDrag.sl - (e.clientX - panDrag.x);
          scroller.scrollTop = panDrag.st - (e.clientY - panDrag.y);
          return;
        }
        const cell = renderer.cellFromPoint(e.clientX, e.clientY);
        if (cell) {
          if (!app.hover || app.hover.x !== cell.x || app.hover.y !== cell.y) {
            app.hover = cell;
            renderer.setHover(cell);
            if (!app.selected || settings.tool !== 'inspect') updateInspector();
          }
        }
        if (stroke && cell) {
          if (cell.x !== stroke.last.x || cell.y !== stroke.last.y) {
            D.line(stroke.last.x, stroke.last.y, cell.x, cell.y, (x, y) => paintCell(x, y, stroke.tool));
            stroke.last = cell;
          }
        }
      });

      const endStroke = (e) => {
        if (e && e.pointerType === 'touch') {
          touches.delete(e.pointerId);
          if (touches.size < 2) gesture = null;
        }
        if (panDrag && e && e.pointerId === panDrag.id) panDrag = null;
        if (!stroke) return;
        if (e && canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        if (stroke.changed) {
          store.touch(stroke.tool === 'mark' ? { keepPristine: true } : undefined);
          if (stroke.tool === 'pencil') app.addRecent(settings.color);
        } else {
          store.dropCheckpoint();
        }
        stroke = null;
        updateInspector();
      };
      canvas.addEventListener('pointerup', endStroke);
      canvas.addEventListener('pointercancel', endStroke);
      canvas.addEventListener('pointerleave', (e) => {
        if (stroke || e.pointerType === 'touch') return;
        app.hover = null;
        renderer.setHover(null);
        updateInspector();
      });

      /* ---------- zoom ---------- */
      app.setZoom = (cell) => {
        app.autoFit = false;
        // keep the view centred on the same spot while zooming
        const before = renderer.cell;
        const cx = (scroller.scrollLeft + scroller.clientWidth / 2) / before;
        const cy = (scroller.scrollTop + scroller.clientHeight / 2) / before;
        renderer.setCell(cell);
        const after = renderer.cell;
        scroller.scrollLeft = cx * after - scroller.clientWidth / 2;
        scroller.scrollTop = cy * after - scroller.clientHeight / 2;
        syncZoomUi();
      };
      app.fit = () => {
        app.autoFit = true;
        const w = Math.max(60, scroller.clientWidth - 36);
        const h = Math.max(60, scroller.clientHeight - 36);
        renderer.setCell(renderer.fitCell(w, h));
        syncZoomUi();
      };
      const syncZoomUi = () => {
        const range = $('zoom-range');
        range.max = String(renderer.maxCell());
        range.value = String(renderer.cell);
      };

      // when the stage changes size (sheet opens, phone rotates) keep an auto-fitted design fitted
      if (typeof ResizeObserver !== 'undefined') {
        let raf = 0;
        new ResizeObserver(() => {
          if (!app.autoFit || !renderer.design) return;
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            if (app.autoFit) app.fit();
          });
        }).observe(scroller);
      }

      $('zoom-in').addEventListener('click', () => app.setZoom(renderer.cell + Math.max(1, Math.round(renderer.cell / 6))));
      $('zoom-out').addEventListener('click', () => app.setZoom(renderer.cell - Math.max(1, Math.round(renderer.cell / 6))));
      $('zoom-range').addEventListener('input', (e) => app.setZoom(Number(e.target.value)));
      $('zoom-fit').addEventListener('click', app.fit);

      const bindToggle = (id, fn) => {
        const b = $(id);
        b.addEventListener('click', () => {
          const on = b.getAttribute('aria-pressed') !== 'true';
          b.setAttribute('aria-pressed', String(on));
          fn(on);
        });
      };
      bindToggle('toggle-grid', (on) => {
        renderer.grid = on;
        renderer.draw();
      });
      bindToggle('toggle-done', (on) => {
        renderer.showDone = on;
        renderer.draw();
      });

      scroller.addEventListener(
        'wheel',
        (e) => {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          app.setZoom(renderer.cell + (e.deltaY < 0 ? 1 : -1) * Math.max(1, Math.round(renderer.cell / 8)));
        },
        { passive: false }
      );

      /* ---------- spotlight filter ---------- */
      app.setFilter = (colorOrNull) => {
        renderer.filter = colorOrNull;
        renderer.draw();
        app.ui.emit('filter', colorOrNull);
      };

      /* ---------- store wiring ---------- */
      store.on('replace', () => {
        const d = store.design;
        renderer.setDesign(d);
        const dims = d.width + 'x' + d.height;
        if (dims !== lastDims) {
          lastDims = dims;
          app.fit();
        }
        syncZoomUi();
        if (renderer.filter !== null && !app.getLegend().byColor.has(renderer.filter)) app.setFilter(null);
        $('status-size').textContent = d.width + ' × ' + d.height;
        updateInspector();
      });
      store.on('change', () => {
        const f = renderer.filter;
        if (f !== null && !app.getLegend().byColor.has(f)) app.setFilter(null);
        updateInspector();
      });

      /* ---------- keyboard ---------- */
      document.addEventListener('keydown', (e) => {
        const t = e.target;
        if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) && t.type !== 'checkbox' && t.type !== 'button') return;
        if (document.querySelector('dialog[open]')) return;
        const key = e.key.toLowerCase();

        if (e.ctrlKey || e.metaKey) {
          if (key === 'z' && !e.shiftKey) {
            e.preventDefault();
            app.undo();
          } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
            e.preventDefault();
            app.redo();
          }
          return;
        }
        if (e.altKey) return;

        if (TOOL_KEYS[key]) {
          app.setTool(TOOL_KEYS[key]);
          return;
        }
        if (key === '+' || key === '=') return app.setZoom(renderer.cell + 2);
        if (key === '-' || key === '_') return app.setZoom(renderer.cell - 2);
        if (key === '0') return app.fit();
        if (key === 'escape') {
          if (renderer.filter !== null) app.setFilter(null);
          else app.select(null);
          return;
        }
        if (key === 'c' && app.selected) return pickFromCell(app.selected);
        if (key === 'enter' && app.selected && t === canvas) {
          e.preventDefault();
          return toggleDone(app.selected);
        }
        const dir = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] }[key];
        if (dir && (settings.tool === 'inspect' || app.selected) && (!t || t === document.body || t === canvas || t.tagName === 'BUTTON')) {
          e.preventDefault();
          const step = e.shiftKey ? 5 : 1;
          moveSelection(dir[0] * step, dir[1] * step);
        }
      });

      app.undo = () => {
        if (store.undo()) app.toast('Undid last change');
      };
      app.redo = () => {
        if (store.redo()) app.toast('Redid change');
      };
      $('btn-undo').addEventListener('click', app.undo);
      $('btn-redo').addEventListener('click', app.redo);
      store.on('history', () => {
        $('btn-undo').disabled = !store.canUndo();
        $('btn-redo').disabled = !store.canRedo();
      });

      app.setTool(settings.tool);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
