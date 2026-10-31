/* Mochipixelu — project view: look at a saved pattern, highlight rows / columns while stitching,
 * tick stitches off, spotlight a color, and reach edit / export / delete. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const U = M.Utils;
  const EMPTY = U.EMPTY;


  M.View = {
    init(app) {
      const $ = app.$;
      const ago = (t) => {
        const sec = Math.max(0, (Date.now() - t) / 1000);
        if (sec < 60) return 'just now';
        if (sec < 3600) return Math.floor(sec / 60) + ' min ago';
        if (sec < 86400) return Math.floor(sec / 3600) + ' h ago';
        return new Date(t).toLocaleDateString();
      };
      const canvas = $('view-canvas');
      const scroller = $('view-scroll');
      const renderer = new M.Renderer(canvas);
      app.viewRenderer = renderer;
      renderer.showSymbols = app.symbolsOn();
      renderer.pin = true;
      let design = null;
      let id = null;
      let mode = 'look';
      let kind = 'row'; // guide style: row | col | cross
      let row = 0;
      let col = 0;
      let selected = null;
      let dirty = false;
      let saveTimer = 0;

      const vp = M.Viewport.create({ canvas, scroller, renderer, onZoom() {}, onGestureStart() { tap = null; } });
      app.viewVp = vp;

      /* ---------- saving ---------- */
      const saveNow = () => {
        clearTimeout(saveTimer);
        if (!dirty || !design || !id) return;
        dirty = false;
        const r = M.Storage.library.save(design, id);
        if (!r.ok) app.toast(r.error, true);
      };
      const markDirty = () => {
        dirty = true;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveNow, 600);
      };
      document.addEventListener('visibilitychange', () => document.hidden && saveNow());
      root.addEventListener('pagehide', saveNow);

      /* ---------- progress + legend ---------- */
      app.ui.on('symbols', () => design && refresh());
      $('view-legend-more').addEventListener('click', () => design && app.openSymbols(design, () => { markDirty(); renderer.draw(); refresh(); }));
      /* the three most used colours with their progress, and a shortcut to the whole legend (guide card) */
      const paintColors = (legend) => {
        const host = $('guide-colors');
        host.textContent = '';
        legend.entries.slice(0, 3).forEach((e) => {
          const item = document.createElement('div');
          item.className = 'gc-item';
          const sw = document.createElement('span');
          sw.className = 'gc-sw';
          sw.style.background = e.hex;
          const t = document.createElement('span');
          t.className = 'gc-text';
          const n = document.createElement('strong');
          n.textContent = e.done + ' / ' + e.count;
          const nm = document.createElement('span');
          nm.textContent = M.Palette.colorName(e.color);
          t.append(n, nm);
          item.append(sw, t);
          host.appendChild(item);
        });
        const all = document.createElement('button');
        all.type = 'button';
        all.className = 'btn small soft gc-all';
        all.innerHTML = '<svg class="ic sm"><use href="#i-palette"/></svg><span class="full">All colors</span><span class="short">All</span><svg class="ic sm chev"><use href="#i-chev"/></svg>';
        all.addEventListener('click', () => { setMode('none'); setLegend(true); });
        host.appendChild(all);
      };
      const refresh = () => {
        const legend = M.Palette.legend(design);
        let done = 0;
        legend.entries.forEach((e) => (done += e.done));
        const p = legend.filled ? Math.round((done / legend.filled) * 100) : 0;
        $('view-progress-bar').style.width = p + '%';
        $('view-progress').setAttribute('aria-valuenow', String(p));
        $('view-progress-text').textContent = done + ' / ' + legend.filled;
        $('view-progress-text').title = 'stitches done';
        $('view-progress').title = p + '% done';
        $('view-size').textContent = design.width + ' × ' + design.height + ' · ' + legend.entries.length + (legend.entries.length === 1 ? ' color' : ' colors');
        paintColors(legend);

        const host = $('view-legend');
        host.textContent = '';
        host.appendChild(app.makeEye());
        legend.entries.forEach((e) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-pressed', String(renderer.filter === e.color));
          b.title = 'Spotlight ' + e.hex;
          const s = document.createElement('span');
          s.className = 'swatch';
          s.style.background = e.hex;
          s.style.color = U.textOn(e.color);
          s.textContent = e.symbol;
          const m = document.createElement('span');
          m.className = 'meta';
          m.textContent = e.done + '/' + e.count;
          b.append(s, m);
          b.addEventListener('click', () => {
            renderer.filter = renderer.filter === e.color ? null : e.color;
            renderer.draw();
            refresh();
          });
          host.appendChild(b);
        });
      };

      const showInfo = () => {
        const sw = $('view-info-swatch');
        if (!selected) {
          sw.className = 'swatch empty';
          sw.style.background = '';
          $('view-info-text').textContent = '';
          $('view-info').removeAttribute('title');
          sw.hidden = true;
          updateStitchBtn();
          return;
        }
        sw.hidden = false;
        const i = selected.y * design.width + selected.x;
        const v = design.pixels[i];
        const where = 'Row ' + (selected.y + 1) + ' \u2022 Stitch ' + (selected.x + 1) + ' \u2022 ';
        if (v === EMPTY) {
          sw.className = 'swatch empty';
          sw.style.background = '';
          $('view-info-text').textContent = where + 'empty';
          $('view-info').removeAttribute('title');
        } else {
          sw.className = 'swatch';
          sw.style.background = U.toHex(v);
          const e = M.Palette.legend(design).byColor.get(v);
          $('view-info-text').textContent = where + M.Palette.colorName(v) + (design.done[i] ? ' \u2022 done \u2713' : '');
          $('view-info').title = U.toHex(v) + (e ? ' \u00b7 #' + e.index + ' ' + e.symbol : '') + ' \u00b7 ' + (design.done[i] ? 'done' : 'to do');
        }
        updateStitchBtn();
      };

      /* ---------- undo for ticks ---------- */
      const hist = [];
      const remember = (idxs) => {
        hist.push(idxs.map((i) => [i, design.done[i]]));
        if (hist.length > 100) hist.shift();
        $('guide-undo').disabled = false;
      };
      const undo = () => {
        const last = hist.pop();
        $('guide-undo').disabled = !hist.length;
        if (!last) return app.toast('Nothing to undo.');
        last.forEach(([i, v]) => (design.done[i] = v));
        renderer.draw();
        markDirty();
        refresh();
        showInfo();
        applyGuide();
      };
      $('guide-undo').addEventListener('click', undo);

      /* ---------- guide ---------- */
      const lineCells = (isRow, n) => {
        const out = [];
        const len = isRow ? design.width : design.height;
        for (let k = 0; k < len; k++) {
          const i = isRow ? n * design.width + k : k * design.width + n;
          if (design.pixels[i] !== EMPTY) out.push(i);
        }
        return out;
      };
      const lineDone = () => {
        const cells = lineCells(kind !== 'col', kind === 'col' ? col : row);
        return cells.length > 0 && cells.every((i) => design.done[i]);
      };

      const applyGuide = () => {
        if (mode !== 'guide') return renderer.setGuide(null);
        row = U.clamp(row, 0, design.height - 1);
        col = U.clamp(col, 0, design.width - 1);
        renderer.setGuide({ row: kind === 'col' ? null : row, col: kind === 'row' ? null : col });
        $('guide-label').textContent = kind === 'row' ? 'Row ' + (row + 1) + ' of ' + design.height : kind === 'col' ? 'Column ' + (col + 1) + ' of ' + design.width : 'Row ' + (row + 1) + ' · Col ' + (col + 1);
        $('guide-done-label').textContent = (kind === 'col' ? 'Column' : 'Row') + (lineDone() ? ' not done' : ' done');
        updateStitchBtn();
        document.querySelectorAll('#view-guides [data-guide]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.guide === kind)));
      };

      const step = (dir) => {
        if (kind === 'col') col += dir;
        else row += dir;
        selected = null;
        renderer.setSelected(null);
        showInfo();
        applyGuide();
        revealGuide();
      };

      const revealGuide = () => {
        const c = renderer.cell;
        if (kind !== 'col') {
          const top = canvas.offsetTop + row * c;
          if (top < scroller.scrollTop) scroller.scrollTop = top - c;
          else if (top + c > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = top + c * 2 - scroller.clientHeight;
        }
        if (kind !== 'row') {
          const left = canvas.offsetLeft + col * c;
          if (left < scroller.scrollLeft) scroller.scrollLeft = left - c;
          else if (left + c > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = left + c * 2 - scroller.clientWidth;
        }
      };

      const markLine = () => {
        const isRow = kind !== 'col';
        const n = isRow ? row : col;
        const cells = lineCells(isRow, n);
        if (!cells.length) return app.toast('Nothing to stitch in this ' + (isRow ? 'row' : 'column') + '.');
        const wasDone = cells.every((i) => design.done[i]);
        remember(cells);
        cells.forEach((i) => (design.done[i] = wasDone ? 0 : 1));
        renderer.draw();
        markDirty();
        refresh();
        showInfo();
        if (!wasDone) {
          // finished one: move on to the next row / column
          if (isRow) row = Math.min(design.height - 1, row + 1);
          else col = Math.min(design.width - 1, col + 1);
          revealGuide();
        }
        applyGuide();
      };

      /* Mark stitch done: the selected stitch, or the first open stitch of the guide line; then move to the next one */
      const lineFirstOpen = () => {
        const isRow = kind !== 'col';
        const cells = lineCells(isRow, isRow ? row : col).filter((i) => !design.done[i]);
        return cells.length ? cells[0] : -1;
      };
      const target = () => {
        if (selected && design.pixels[selected.y * design.width + selected.x] !== EMPTY) return selected.y * design.width + selected.x;
        const f = lineFirstOpen();
        return f;
      };
      function updateStitchBtn() {
        const b = $('guide-stitch-label');
        if (!b) return;
        const t = target();
        const undone = t >= 0 && design.done[t];
        b.textContent = undone ? 'Mark not done' : 'Mark stitch done';
        b.dataset.short = undone ? 'Not done' : 'Stitch done';
      }
      const markStitch = () => {
        const t = target();
        if (t < 0) return app.toast('Nothing left to stitch in this ' + (kind === 'col' ? 'column' : 'row') + '.');
        remember([t]);
        const wasDone = design.done[t];
        design.done[t] = wasDone ? 0 : 1;
        const x = t % design.width, y = (t - x) / design.width;
        renderer.drawCell(x, y);
        markDirty();
        refresh();
        if (!wasDone) {
          // move on to the next open stitch of the guide line
          const isRow = kind !== 'col';
          const n = lineCells(isRow, isRow ? row : col).filter((i) => !design.done[i]);
          if (n.length) {
            const nx = n[0] % design.width, ny = (n[0] - nx) / design.width;
            selected = { x: nx, y: ny };
            renderer.setSelected(selected);
          } else {
            app.toast((isRow ? 'Row ' + (row + 1) : 'Column ' + (col + 1)) + ' complete \u2713');
            if (isRow) row = Math.min(design.height - 1, row + 1); else col = Math.min(design.width - 1, col + 1);
            selected = null;
            renderer.setSelected(null);
          }
        }
        showInfo();
        applyGuide();
        revealGuide();
      };
      $('guide-stitch').addEventListener('click', markStitch);
      $('guide-prev').addEventListener('click', () => step(-1));
      $('guide-next').addEventListener('click', () => step(1));
      $('guide-done').addEventListener('click', markLine);
      $('view-guides').addEventListener('click', (e) => {
        const b = e.target.closest('[data-guide]');
        if (!b) return;
        kind = b.dataset.guide;
        applyGuide();
      });

      const setMode = (m) => {
        mode = m;
        document.querySelectorAll('#view-modes [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
        $('guide-controls').hidden = m !== 'guide';
        applyGuide();
      };
      /* the Legend button opens the legend card (and releases the mode buttons); Hide / Show only folds the chips */
      const setLegend = (open) => {
        $('view-legend-pop').hidden = !open;
        $('view-dock-legend').setAttribute('aria-pressed', String(open));
        requestAnimationFrame(() => vp.autoFit && vp.fit());
      };
      $('view-dock-legend').addEventListener('click', () => {
        const open = $('view-legend-pop').hidden;
        if (open) setMode('none');
        setLegend(open);
      });
      // one button at a time: picking a mode closes the legend, tapping the active mode releases it
      $('view-modes').addEventListener('click', (e) => {
        const b = e.target.closest('[data-mode]');
        if (!b) return;
        setLegend(false);
        setMode(mode === b.dataset.mode ? 'none' : b.dataset.mode);
      });

      /* ---------- taps on the pattern ---------- */
      let tap = null;
      const onTap = (cell) => {
        selected = cell;
        if (mode === 'none') {
          renderer.setSelected(cell); // no mode picked: a tap still shows the stitch details
          showInfo();
          return;
        }
        renderer.setSelected(cell);
        if (mode === 'guide') {
          row = cell.y;
          col = cell.x;
          applyGuide();
        } else if (mode === 'tick') {
          const i = cell.y * design.width + cell.x;
          if (design.pixels[i] === EMPTY) app.toast('Empty cells have no stitch to tick.');
          else {
            remember([i]);
            design.done[i] = design.done[i] ? 0 : 1;
            renderer.drawCell(cell.x, cell.y);
            markDirty();
            refresh();
          }
        }
        showInfo();
      };

      canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (vp.down(e)) {
          tap = null;
          return;
        }
        e.preventDefault();
        tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() };
        vp.startPan(e);
      });
      canvas.addEventListener('pointermove', (e) => {
        if (tap && e.pointerId === tap.id && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) tap = null;
        vp.move(e);
      });
      const end = (e) => {
        vp.up(e);
        if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        if (tap && e.pointerId === tap.id && e.type === 'pointerup') {
          const cell = renderer.cellFromPoint(e.clientX, e.clientY);
          if (cell) onTap(cell);
        }
        tap = null;
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);

      $('view-zoom-fit').addEventListener('click', vp.fit);

      /* ---------- top bar + ⋯ menu ---------- */
      $('view-back').addEventListener('click', () => {
        saveNow();
        M.Router.go('#/');
      });
      const goEdit = () => {
        saveNow();
        M.Router.go('#/e/' + id);
      };
      const menu = $('view-menu');
      const closeMenu = () => {
        menu.hidden = true;
        $('view-more').setAttribute('aria-expanded', 'false');
      };
      const sw = $('view-swatches');
      M.Storage.THEMES.forEach((t) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tone-sw';
        b.dataset.tone = t;
        b.setAttribute('aria-label', t);
        sw.appendChild(b);
      });
      const paintMenu = () => {
        const e = M.Storage.library.get(id) || {};
        sw.querySelectorAll('.tone-sw').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tone === (e.theme || 'white'))));
        menu.querySelector('[data-menu=pin] span').textContent = e.pinned ? 'Unpin' : 'Pin';
        menu.querySelector('[data-menu=archive] span').textContent = e.archived ? 'Unarchive' : 'Archive';
        $('view-foot').textContent = e.updated ? 'Edited ' + ago(e.updated) + ' · ' + e.width + ' × ' + e.height : 'Edited just now';
        const scr = $('screen-view');
        if (e.theme && e.theme !== 'white') scr.dataset.tone = e.theme;
        else delete scr.dataset.tone;
        renderer.setTone(app.toneHex(scr));
      };
      sw.addEventListener('click', (ev) => {
        const b = ev.target.closest('.tone-sw');
        if (!b) return;
        M.Storage.library.setMeta(id, { theme: b.dataset.tone });
        paintMenu();
      });
      $('view-more').addEventListener('click', () => {
        if (!menu.hidden) return closeMenu();
        paintMenu();
        menu.hidden = false;
        $('view-more').setAttribute('aria-expanded', 'true');
      });
      document.addEventListener('click', (ev) => {
        if (!menu.hidden && !menu.contains(ev.target) && !$('view-more').contains(ev.target)) closeMenu();
      });
      document.addEventListener('keydown', (ev) => ev.key === 'Escape' && !menu.hidden && closeMenu());

      const title = () => ($('view-title').textContent = design.name);

      menu.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-menu]');
        if (!b) return;
        closeMenu();
        const what = b.dataset.menu;
        saveNow();
        const cur = M.Storage.library.get(id) || {};
        if (what === 'edit') return goEdit();
        if (what === 'pin') {
          M.Storage.library.setMeta(id, { pinned: !cur.pinned });
          app.toast(cur.pinned ? 'Unpinned' : 'Pinned to the top');
        } else if (what === 'folder') app.pickFolder(id);
        else if (what === 'archive') {
          M.Storage.library.setMeta(id, { archived: !cur.archived });
          app.toast(cur.archived ? 'Moved back to My patterns' : 'Archived');
          if (!cur.archived) M.Router.go('#/');
        } else if (what === 'rename') {
          const name = await app.askText({ title: 'Rename pattern', label: 'Name', value: design.name });
          if (name === null) return;
          design.name = name.trim().slice(0, 60) || 'Untitled';
          dirty = true;
          saveNow();
          title();
        } else if (what === 'duplicate') {
          const r = M.Storage.library.duplicate(id);
          if (!r.ok) return app.toast(r.error, true);
          app.toast('Duplicated — the copy starts with fresh progress');
          M.Router.go('#/p/' + r.id);
        } else if (what === 'export') app.openSheet('export');
        else if (what === 'file') app.act.saveFile(design);
        else if (what === 'clear-progress') {
          if (!design.done.some((x) => x)) return app.toast('There is no progress to clear.');
          const ok = await app.confirm({ title: 'Clear all progress?', text: 'Every ticked stitch of “' + design.name + '” goes back to “to do”. The artwork is not changed.', okLabel: 'Clear progress' });
          if (!ok) return;
          design.done.fill(0);
          renderer.draw();
          markDirty();
          saveNow();
          refresh();
          showInfo();
          applyGuide();
          app.toast('Progress cleared');
        }
        else if (what === 'delete') {
          dirty = false;
          M.Storage.library.setMeta(id, { trashed: true });
          app.toast('Moved to Trash — restore it from the Trash tab');
          M.Router.go('#/');
        }
      });

      /* ---------- screen lifecycle ---------- */
      M.Router.register('view', {
        el: $('screen-view'),
        enter(route) {
          closeMenu();
          try {
            design = M.Storage.library.load(route.id);
          } catch (err) {
            app.toast(err.message, true);
            M.Router.redirect('#/');
            return;
          }
          id = route.id;
          const _e = M.Storage.library.get(id);
          const _v = document.getElementById('screen-view');
          if (_e && _e.theme && _e.theme !== 'white') _v.dataset.tone = _e.theme;
          else delete _v.dataset.tone;
          renderer.setTone(app.toneHex(_v));
          setLegend(false);
          app.viewDesign = design;
          dirty = false;
          selected = null;
          row = 0;
          col = 0;
          hist.length = 0;
          $('guide-undo').disabled = true;
          renderer.filter = null;
          renderer.selected = null;
          renderer.guide = null;
          renderer.setDesign(design);
          title();
          setMode('look');
          refresh();
          showInfo();
          requestAnimationFrame(vp.fit);
        },
        leave() {
          closeMenu();
          saveNow();
          app.viewDesign = null;
          app.closeSheet();
        },
      });
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
