/* Mochipixelu — editor settings sheet: design/resolution, colors, craft progress, export, files. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const U = M.Utils;
  const D = M.Design;
  const EMPTY = U.EMPTY;

  M.Panels = {
    init(app) {
      const $ = app.$;
      const { store, renderer, settings } = app;

      /* ---------- tabs + bottom sheet ---------- */
      const tabs = Array.from(document.querySelectorAll('.tab'));
      const sheet = $('sheet');
      let currentTab = 'design';
      const syncNav = () => {
        const open = sheet.classList.contains('open');
        $('btn-menu').setAttribute('aria-pressed', String(open && currentTab !== 'colors'));
        $('dock-color').setAttribute('aria-pressed', String((open && currentTab === 'colors') || !$('color-pop').hidden));
      };
      const showTab = (name) => {
        currentTab = name;
        tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
        document.querySelectorAll('.tabpanel').forEach((p) => (p.hidden = p.id !== 'panel-' + name));
        syncNav();
      };
      /** Phones: slide the sheet up on a tab. Desktop: the panel is always visible, this just switches tab. */
      app.openSheet = (name) => {
        $('color-pop').hidden = true;
        showTab(name || currentTab);
        sheet.classList.add('open');
        syncNav();
      };
      app.closeSheet = () => {
        $('color-pop').hidden = true;
        sheet.classList.remove('open');
        syncNav();
      };
      tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
      const toggleSheet = (tab, isOpenFor) => {
        if (sheet.classList.contains('open') && isOpenFor()) app.closeSheet();
        else app.openSheet(tab);
      };
      $('btn-menu').addEventListener('click', () => toggleSheet(currentTab === 'colors' ? 'design' : currentTab, () => currentTab !== 'colors'));
      /* Colour button: on phones a quick-colour row pops up above the bottom bar; desktop uses the side panel */
      const pop = $('color-pop');
      const wide = () => window.matchMedia('(min-width: 900px)').matches;
      const closePop = () => {
        pop.hidden = true;
        syncNav();
      };
      app.closePop = closePop;
      const fillPop = () => {
        pop.textContent = '';
        const add = (c) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'sw';
          b.style.background = U.toHex(c);
          b.setAttribute('aria-label', U.toHex(c));
          b.setAttribute('aria-pressed', String(c === settings.color));
          b.addEventListener('click', () => {
            app.setColor(c);
            app.addRecent(c);
            fillPop();
          });
          pop.appendChild(b);
        };
        const seen = new Set();
        settings.recent.concat(app.getLegend().entries.map((e) => e.color), M.Palette.DEFAULT_PALETTE.map((h) => U.fromHex(h))).forEach((c) => {
          if (!seen.has(c)) {
            seen.add(c);
            add(c);
          }
        });
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'btn small more';
        more.textContent = 'More';
        more.addEventListener('click', () => {
          closePop();
          app.openSheet('colors');
        });
        pop.appendChild(more);
      };
      $('dock-color').addEventListener('click', () => {
        if (wide()) return toggleSheet('colors', () => currentTab === 'colors');
        if (!pop.hidden) return closePop();
        app.closeSheet();
        fillPop();
        pop.hidden = false;
        syncNav();
      });
      document.querySelectorAll('.tool[data-tool]').forEach((b) => b.addEventListener('click', closePop));
      $('canvas').addEventListener('pointerdown', closePop);
      $('sheet-close').addEventListener('click', app.closeSheet);
      app.showTab = showTab;

      /* ---------- name ---------- */
      $('design-name').addEventListener('input', (e) => {
        store.design.name = e.target.value.slice(0, 60) || 'Untitled';
        store.emit('change');
      });

      /* ---------- DESIGN: resolution ---------- */
      let aspect = 1; // height / width used while "keep proportions" is on
      let resizing = false;
      const resW = $('res-w');
      const resH = $('res-h');
      const limitEl = $('color-limit');

      const readSize = (el) => {
        const n = Math.round(Number(el.value));
        return Number.isFinite(n) && n >= 1 ? U.clamp(n, 1, U.MAX_SIZE) : null;
      };
      const colorLimit = () => U.clamp(Math.round(Number(limitEl.value)) || 0, 0, 64);
      const liveFromSource = () => !!(store.source && store.pristine);

      const updateHints = () => {
        const s = store.source;
        $('btn-repixel').disabled = !s;
        $('img-info').textContent = s
          ? 'Image “' + s.name + '” (' + s.width + '×' + s.height + ' px). Change the numbers to re-pixelate it live.'
          : 'Changing these numbers changes how many pixels the design really has.';
        $('res-hint').textContent = liveFromSource()
          ? 'Live: every change re-pixelates your image at the new size.'
          : s
          ? 'You have edited this art, so resizing resamples the cells you drew. “Re-pixelate” starts over from the image.'
          : 'Resizing resamples (or crops/pads) the cells you have drawn.';
      };

      const applyResolution = (w, h) => {
        const d = store.design;
        if (w === d.width && h === d.height) return;
        resizing = true;
        let next;
        if (liveFromSource()) {
          next = M.Pixelate.designFromSource(store.source, w, h, colorLimit(), d.name);
          store.load(next, { checkpoint: true, pristine: true });
        } else {
          const mode = $('res-mode').value;
          if (mode === 'scale') next = D.resample(d, w, h);
          else next = D.resizeCanvas(d, w, h, mode === 'crop-c' ? 0.5 : 0, mode === 'crop-c' ? 0.5 : 0);
          next.name = d.name;
          store.load(next, { checkpoint: true, pristine: false });
        }
        resizing = false;
        store.touch({ keepPristine: true });
      };

      const onSizeInput = (changed) => {
        let w = readSize(resW);
        let h = readSize(resH);
        if (w === null || h === null) {
          if (changed === 'w' && w === null) return;
          if (changed === 'h' && h === null) return;
          w = w || store.design.width;
          h = h || store.design.height;
        }
        if ($('res-lock').checked) {
          if (changed === 'w') h = U.clamp(Math.round(w * aspect), 1, U.MAX_SIZE);
          else w = U.clamp(Math.round(h / aspect), 1, U.MAX_SIZE);
          resW.value = w;
          resH.value = h;
        }
        applyResolutionDebounced(w, h);
      };
      // A pending resize must never fire after something else replaced the design
      // (import, new canvas, undo, opened file) — it would overwrite that work.
      let resizeTimer = null;
      const applyResolutionDebounced = (w, h) => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => applyResolution(w, h), 140);
      };
      resW.addEventListener('input', () => onSizeInput('w'));
      resH.addEventListener('input', () => onSizeInput('h'));
      $('res-lock').addEventListener('change', () => {
        const w = readSize(resW) || store.design.width;
        const h = readSize(resH) || store.design.height;
        aspect = h / w;
      });
      $('res-presets').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-size]');
        if (!b) return;
        const n = Number(b.dataset.size);
        let w = n;
        let h = n;
        if ($('res-lock').checked) {
          // preset = longest side, other side follows the locked proportions
          if (aspect <= 1) h = U.clamp(Math.round(n * aspect), 1, U.MAX_SIZE);
          else w = U.clamp(Math.round(n / aspect), 1, U.MAX_SIZE);
        }
        resW.value = w;
        resH.value = h;
        applyResolution(w, h);
      });

      /* ---------- DESIGN: colors ---------- */
      limitEl.addEventListener('change', () => {
        limitEl.value = colorLimit();
        if (liveFromSource()) applyRepixel(true);
      });
      $('btn-reduce').addEventListener('click', () => {
        const n = colorLimit();
        if (n < 1) return app.toast('Enter a color limit of 1 or more first.', true);
        const d = store.design;
        const before = app.getLegend().entries.length;
        if (before <= n) return app.toast('The design already uses ' + before + ' color' + (before === 1 ? '' : 's') + '.');
        store.checkpoint();
        d.pixels.set(M.Palette.quantize(d.pixels, n));
        renderer.draw();
        store.touch();
        app.toast('Reduced to ' + app.getLegend().entries.length + ' colors');
      });

      const applyRepixel = (quiet) => {
        const s = store.source;
        if (!s) return;
        const w = readSize(resW) || store.design.width;
        const h = readSize(resH) || store.design.height;
        resizing = true;
        store.load(M.Pixelate.designFromSource(s, w, h, colorLimit(), store.design.name), { checkpoint: true, pristine: true });
        resizing = false;
        store.touch({ keepPristine: true });
        if (!quiet) app.toast('Re-pixelated from your image');
      };
      $('btn-repixel').addEventListener('click', () => applyRepixel(false));

      /* ---------- replace the artwork with an image (undoable) ---------- */
      app.importIntoEditor = async (file) => {
        try {
          const src = await M.Images.readFile(file);
          const longest = Math.max(store.design.width, store.design.height, 8);
          const { w, h } = M.Pixelate.fitSize(src.width, src.height, longest > 64 ? 64 : longest);
          const name = M.Images.baseName(file) || 'Imported image';
          resizing = true;
          store.load(M.Pixelate.designFromSource(src, w, h, colorLimit(), name), { checkpoint: true, source: src, pristine: true });
          resizing = false;
          store.touch({ keepPristine: true });
          app.openSheet('design');
          app.toast('Pixelated to ' + w + ' × ' + h + ' — adjust the resolution live!');
        } catch (err) {
          resizing = false;
          app.toast(err.message || 'Could not import that image.', true);
        }
      };
      $('btn-import').addEventListener('click', () => $('file-input').click());
      $('file-input').addEventListener('change', (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (f) app.importIntoEditor(f);
      });

      /* ---------- COLORS ---------- */
      const sw = (hex, pressed, onClick, title) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sw';
        b.style.background = hex;
        b.title = title || hex;
        b.setAttribute('aria-label', title || hex);
        b.setAttribute('aria-pressed', String(pressed));
        b.addEventListener('click', onClick);
        return b;
      };
      const renderSwatches = (host, colors) => {
        host.textContent = '';
        colors.forEach((c) =>
          host.appendChild(
            sw(U.toHex(c), c === settings.color, () => {
              app.setColor(c);
              app.addRecent(c);
            })
          )
        );
      };
      const palette = M.Palette.DEFAULT_PALETTE.map((h) => U.fromHex(h));
      const refreshColors = () => {
        const cur = settings.color;
        $('cur-swatch').style.background = U.toHex(cur);
        document.querySelectorAll('[data-cur-color]').forEach((d) => (d.style.background = U.toHex(cur)));
        if ($('color-input').value !== U.toHex(cur)) $('color-input').value = U.toHex(cur);
        if (document.activeElement !== $('color-hex')) $('color-hex').value = U.toHex(cur);
        renderSwatches($('palette-grid'), palette);
        renderSwatches($('recent-grid'), settings.recent);
        renderSwatches($('design-colors'), app.getLegend().entries.map((e) => e.color));
      };
      $('color-input').addEventListener('input', (e) => {
        app.setColor(U.fromHex(e.target.value));
      });
      $('color-input').addEventListener('change', () => app.addRecent(settings.color));
      $('color-hex').addEventListener('input', (e) => {
        const c = /^#?[0-9a-f]{6}$/i.test(e.target.value.trim()) ? U.fromHex(e.target.value) : null;
        if (c !== null) app.setColor(c);
        e.target.setAttribute('aria-invalid', String(c === null));
      });
      $('color-hex').addEventListener('blur', () => {
        $('color-hex').value = U.toHex(settings.color);
        $('color-hex').removeAttribute('aria-invalid');
      });
      $('fill-all').addEventListener('change', (e) => (settings.fillAll = e.target.checked));

      /* ---------- CRAFT ---------- */
      const refreshCraft = () => {
        const legend = app.getLegend();
        let done = 0;
        legend.entries.forEach((e) => (done += e.done));
        const pct = legend.filled ? Math.round((done / legend.filled) * 100) : 0;
        $('progress-bar').style.width = pct + '%';
        $('progress').setAttribute('aria-valuenow', String(pct));
        $('progress-text').textContent = done + ' of ' + legend.filled + ' stitches done (' + pct + '%)';
        const list = $('legend-list');
        list.textContent = '';
        legend.entries.forEach((e) => {
          const li = document.createElement('li');
          const b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-pressed', String(renderer.filter === e.color));
          b.title = 'Spotlight ' + e.hex;
          const s = document.createElement('span');
          s.className = 'swatch';
          s.style.background = e.hex;
          s.style.color = U.textOn(e.color);
          s.textContent = e.symbol;
          const label = document.createElement('span');
          label.textContent = '#' + e.index + ' ' + e.hex;
          const meta = document.createElement('span');
          meta.className = 'meta';
          meta.textContent = e.done + '/' + e.count;
          b.append(s, label, meta);
          b.addEventListener('click', () => app.setFilter(renderer.filter === e.color ? null : e.color));
          li.appendChild(b);
          list.appendChild(li);
        });
        if (!legend.entries.length) {
          const li = document.createElement('li');
          li.className = 'hint';
          li.textContent = 'No colors yet — draw something!';
          list.appendChild(li);
        }
        $('btn-clear-filter').hidden = renderer.filter === null;
      };

      $('btn-mark-all').addEventListener('click', () => {
        const d = store.design;
        store.checkpoint();
        let n = 0;
        for (let i = 0; i < d.pixels.length; i++) {
          if (d.pixels[i] !== EMPTY && !d.done[i]) {
            d.done[i] = 1;
            n++;
          }
        }
        if (!n) return store.dropCheckpoint();
        renderer.draw();
        store.touch({ keepPristine: true });
      });
      $('btn-clear-progress').addEventListener('click', () => {
        const d = store.design;
        if (!d.done.some((v) => v)) return;
        store.checkpoint();
        d.done.fill(0);
        renderer.draw();
        store.touch({ keepPristine: true });
      });
      $('btn-clear-filter').addEventListener('click', () => app.setFilter(null));

      /* ---------- EXPORT ---------- */
      app.exportOptions = () => ({
        cell: Number($('ex-cell').value) || 24,
        colors: $('ex-colors').checked,
        symbols: $('ex-symbols').checked,
        coords: $('ex-coords').checked,
        marks: $('ex-marks').checked,
        grid: true,
      });
      $('btn-preview').addEventListener('click', () => app.act.preview(store.design));
      $('btn-pattern-png').addEventListener('click', () => app.act.patternPng(store.design));
      $('btn-art-png').addEventListener('click', () => app.act.artPng(store.design));
      $('btn-save-file').addEventListener('click', () => app.act.saveFile(store.design));

      /* ---------- refresh wiring ---------- */
      const refreshAll = U.debounce(() => {
        refreshColors();
        refreshCraft();
        updateHints();
      }, 40);
      store.on('change', refreshAll);
      store.on('replace', () => {
        const d = store.design;
        $('design-name').value = d.name;
        resW.value = d.width;
        resH.value = d.height;
        if (!resizing) clearTimeout(resizeTimer);
        // With an image the source ratio is the truth (no rounding drift); otherwise follow the
        // design, except while our own resize is running (it would compound rounding errors).
        if (store.source) aspect = store.source.height / store.source.width || 1;
        else if (!resizing) aspect = d.height / d.width || 1;
        refreshAll();
      });
      app.ui.on('color', refreshColors);
      app.ui.on('recent', () => {
        renderSwatches($('recent-grid'), settings.recent);
        app.savePrefs();
      });
      app.ui.on('filter', refreshCraft);
      showTab('design');
      refreshColors();
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
