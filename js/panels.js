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

      /* the sheet floats over the canvas, resting on the bottom bar — it never resizes the canvas */
      if (typeof ResizeObserver !== 'undefined') {
        const dock = document.querySelector('#screen-editor .dock');
        const ws = document.querySelector('#screen-editor .workspace');
        new ResizeObserver(() => ws.style.setProperty('--dock-h', dock.offsetHeight + 'px')).observe(dock);
      }

      /* ---------- ⋯ menu → one popup per section, each with a fixed Done button ---------- */
      const sheet = $('sheet');
      const optMenu = $('opt-menu');
      const TITLES = { design: 'Size & detail', export: 'Export & print', files: 'Image & files' };
      let current = 'design';
      const pop = $('color-pop');
      const legendPop = $('legend-pop');
      const syncNav = () => {
        $('btn-menu').setAttribute('aria-pressed', String(!optMenu.hidden || sheet.classList.contains('open')));
        $('dock-color').setAttribute('aria-pressed', String(!pop.hidden));
        $('dock-legend').setAttribute('aria-pressed', String(!legendPop.hidden));
      };
      const closeMenu = () => {
        optMenu.hidden = true;
        syncNav();
      };
      app.openSheet = (name) => {
        pop.hidden = true;
        optMenu.hidden = true;
        current = name || current;
        $('sheet-title').textContent = TITLES[current] || '';
        document.querySelectorAll('.tabpanel').forEach((el) => (el.hidden = el.id !== 'panel-' + current));
        sheet.querySelector('.tabpanel:not([hidden])').scrollTop = 0;
        sheet.classList.add('open');
        $('sheet-scrim').hidden = false;
        syncNav();
      };
      app.closeSheet = () => {
        pop.hidden = true;
        optMenu.hidden = true;
        sheet.classList.remove('open');
        $('sheet-scrim').hidden = true;
        syncNav();
      };
      /* theme swatches, pin / folder / archive / trash, and the "Edited …" footer */
      const entry = () => (app.projectId && M.Storage.library.get(app.projectId)) || null;
      const ago = (t) => {
        const s = Math.max(0, (Date.now() - t) / 1000);
        if (s < 60) return 'just now';
        if (s < 3600) return Math.floor(s / 60) + ' min ago';
        if (s < 86400) return Math.floor(s / 3600) + ' h ago';
        return new Date(t).toLocaleDateString();
      };
      app.applyTone = (tone) => {
        const t = tone && tone !== 'white' ? tone : '';
        const scr = document.getElementById('screen-editor');
        if (t) scr.dataset.tone = t;
        else delete scr.dataset.tone;
        renderer.setTone(app.toneHex(scr));
      };
      app.retone = () => app.retoneEditor();
      app.retoneEditor = () => app.applyTone(((entry() || {}).theme) || 'white');
      const swHost = optMenu.querySelector('.swatches');
      M.Storage.THEMES.forEach((t) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tone-sw';
        b.dataset.tone = t;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-label', t[0].toUpperCase() + t.slice(1));
        swHost.appendChild(b);
      });
      const refreshMenu = () => {
        const e = entry();
        const tone = (e && e.theme) || 'white';
        swHost.querySelectorAll('.tone-sw').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tone === tone)));
        app.applyTone(tone);
        optMenu.querySelector('[data-act=pin] span').textContent = e && e.pinned ? 'Unpin' : 'Pin';
        optMenu.querySelector('[data-act=archive] span').textContent = e && e.archived ? 'Unarchive' : 'Archive';
        $('menu-foot').textContent = e ? 'Edited ' + ago(e.updated) + ' · ' + e.width + ' × ' + e.height : 'Edited just now';
      };
      app.refreshOptMenu = refreshMenu;
      swHost.addEventListener('click', (ev) => {
        const b = ev.target.closest('.tone-sw');
        if (!b || !app.projectId) return;
        M.Storage.library.setMeta(app.projectId, { theme: b.dataset.tone });
        refreshMenu();
      });
      $('btn-menu').addEventListener('click', () => {
        if (sheet.classList.contains('open')) return app.closeSheet();
        const wasOpen = !optMenu.hidden;
        app.closeSheet();
        if (!wasOpen) refreshMenu();
        optMenu.hidden = wasOpen;
        syncNav();
      });
      optMenu.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-open]');
        if (b) return app.openSheet(b.dataset.open);
        const a = e.target.closest('[data-act]');
        if (!a || !app.projectId) return;
        const id = app.projectId;
        const cur = entry() || {};
        const what = a.dataset.act;
        if (what === 'pin') {
          M.Storage.library.setMeta(id, { pinned: !cur.pinned });
          refreshMenu();
          app.toast(cur.pinned ? 'Unpinned' : 'Pinned to the top');
        } else if (what === 'folder') {
          closeMenu();
          app.pickFolder(id, refreshMenu);
        } else if (what === 'archive') {
          M.Storage.library.setMeta(id, { archived: !cur.archived });
          closeMenu();
          app.toast(cur.archived ? 'Moved back to My patterns' : 'Archived');
          if (!cur.archived) M.Router.go('#/');
        } else if (what === 'trash') {
          closeMenu();
          M.Storage.library.setMeta(id, { trashed: true });
          app.toast('Moved to Trash — restore it from the Trash tab');
          M.Router.go('#/');
        }
      });
      $('sheet-done').addEventListener('click', app.closeSheet);
      $('sheet-scrim').addEventListener('click', app.closeSheet);
      document.addEventListener('click', (e) => {
        if (!optMenu.hidden && !optMenu.contains(e.target) && !$('btn-menu').contains(e.target)) closeMenu();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && (sheet.classList.contains('open') || !optMenu.hidden)) app.closeSheet();
      });

      /* ---------- Color button: a row pops up above the bar — picker first, then last used, then the palette ---------- */
      // after picking a color the drawing tool comes back (it let go when the color row opened)
      const reselectTool = () => {
        if (settings.tool === 'none' && app.lastTool) app.setTool(app.lastTool);
      };
      const closePop = () => {
        pop.hidden = true;
        syncNav();
      };
      app.closePop = closePop;
      const refreshPressed = () =>
        pop.querySelectorAll('.sw[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.color) === settings.color)));
      /* ---------- RGB dialog: gradient R / G / B sliders, hex, presets, Cancel / Use color ---------- */
      const rgbDlg = $('rgb-dialog');
      let rgbBefore = 0;
      let rgbCancelled = false;
      const hex6 = (c) => U.toHex(c).toUpperCase();
      const rgbVals = () => ['r', 'g', 'b'].map((k) => U.clamp(Math.round(Number($('rgb-' + k).value)) || 0, 0, 255));
      const rgbPresets = () => {
        const host = $('rgb-presets');
        host.textContent = '';
        const seen = new Set();
        settings.recent.slice(0, 4).concat(M.Palette.DEFAULT_PALETTE.map((x) => U.fromHex(x))).forEach((c) => {
          if (seen.has(c) || seen.size >= 12) return;
          seen.add(c);
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'sw';
          b.style.background = U.toHex(c);
          b.setAttribute('aria-label', hex6(c));
          b.setAttribute('aria-pressed', String(c === settings.color));
          b.addEventListener('click', () => rgbApply(c));
          host.appendChild(b);
        });
      };
      /** Update every control from the current color. `from` is the control being dragged (left alone). */
      const rgbShow = (c, from) => {
        const [r, g, b] = U.rgb(c);
        const v = [r, g, b];
        ['r', 'g', 'b'].forEach((k, i) => {
          if (from !== k) $('rgb-' + k).value = v[i];
          if (from !== k + 'n') $('rgb-' + k + 'n').value = v[i];
          // each track shows what the color would be along that channel
          const lo = v.slice();
          const hi = v.slice();
          lo[i] = 0;
          hi[i] = 255;
          $('rgb-' + k).style.setProperty('--track', 'linear-gradient(90deg, rgb(' + lo.join(',') + '), rgb(' + hi.join(',') + '))');
        });
        if (from !== 'hex') $('rgb-hex').value = hex6(c);
        $('rgb-hex').removeAttribute('aria-invalid');
        $('rgb-preview').style.background = U.toHex(c);
        $('rgb-preview-hex').textContent = hex6(c);
        $('rgb-preview-hex').style.color = U.textOn(c);
        $('rgb-presets').querySelectorAll('.sw').forEach((s) => s.setAttribute('aria-pressed', String(s.getAttribute('aria-label') === hex6(c))));
      };
      const rgbApply = (c, from) => {
        app.setColor(c); // live: the pencil already uses it
        rgbShow(c, from);
      };
      ['r', 'g', 'b'].forEach((k) => {
        $('rgb-' + k).addEventListener('input', () => {
          const v = rgbVals();
          rgbApply(U.pack(v[0], v[1], v[2]), k);
        });
        $('rgb-' + k + 'n').addEventListener('input', (e) => {
          if (e.target.value === '') return;
          const n = rgbVals(); // reads the sliders; overwrite this channel from the box
          n['rgb'.indexOf(k)] = U.clamp(Math.round(Number(e.target.value)) || 0, 0, 255);
          rgbApply(U.pack(n[0], n[1], n[2]), k + 'n');
        });
        $('rgb-' + k + 'n').addEventListener('blur', () => rgbShow(settings.color));
      });
      $('rgb-hex').addEventListener('input', (e) => {
        const t = e.target.value.trim().replace(/^#/, '');
        const ok = /^[0-9a-f]{6}$/i.test(t);
        e.target.setAttribute('aria-invalid', String(!ok));
        if (ok) rgbApply(U.fromHex('#' + t), 'hex');
      });
      $('rgb-hex').addEventListener('blur', () => rgbShow(settings.color));
      function openRgb() {
        rgbBefore = settings.color;
        rgbCancelled = false;
        rgbPresets();
        rgbShow(settings.color);
        rgbDlg.showModal();
      }
      $('rgb-ok').addEventListener('click', () => rgbDlg.close());
      $('rgb-cancel').addEventListener('click', () => {
        rgbCancelled = true;
        app.setColor(rgbBefore);
        rgbDlg.close();
      });
      // closing any other way (Use color, tapping outside, Esc) keeps the color and files it under "last used"
      rgbDlg.addEventListener('close', () => {
        if (!rgbCancelled) {
          app.addRecent(settings.color);
          reselectTool();
        }
        rgbCancelled = false;
      });

      const fillPop = () => {
        pop.textContent = '';
        // 1st: the RGB picker — opens the app's own R / G / B sliders (works on every phone)
        const pick = document.createElement('button');
        pick.type = 'button';
        pick.className = 'sw picker';
        pick.title = 'Mix any color (RGB)';
        pick.setAttribute('aria-label', 'Mix any color (RGB)');
        pick.addEventListener('click', () => {
          closePop();
          openRgb();
        });
        pop.appendChild(pick);
        // then the most recently used colours, then the default palette
        const seen = new Set();
        settings.recent.concat(M.Palette.DEFAULT_PALETTE.map((hex) => U.fromHex(hex))).forEach((c) => {
          if (seen.has(c)) return;
          seen.add(c);
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'sw';
          b.dataset.color = String(c);
          b.style.background = U.toHex(c);
          b.setAttribute('aria-label', U.toHex(c));
          b.addEventListener('click', () => {
            app.setColor(c);
            app.addRecent(c);
            fillPop();
            reselectTool();
          });
          pop.appendChild(b);
        });
        refreshPressed();
      };
      app.setLegend = (open) => {
        if (open) {
          app.closeSheet();
          pop.hidden = true;
          app.setTool('none'); // one button at a time: the drawing tool lets go
          refreshCraft();
        }
        legendPop.hidden = !open;
        syncNav();
      };
      $('dock-legend').addEventListener('click', () => app.setLegend(legendPop.hidden));
      $('dock-color').addEventListener('click', () => {
        if (!pop.hidden) return closePop();
        app.closeSheet();
        app.setLegend(false);
        app.setTool('none');
        fillPop();
        pop.hidden = false;
        syncNav();
      });
      document.querySelectorAll('.tool[data-tool]').forEach((b) => b.addEventListener('click', closePop));
      $('canvas').addEventListener('pointerdown', () => {
        closePop();
        closeMenu();
      });

      /* ---------- name ---------- */
      $('design-name').addEventListener('input', (e) => {
        store.design.name = e.target.value.slice(0, 60);
        store.emit('change');
      });
      // when the field loses focus: no empty names, and no two patterns share a name
      $('design-name').addEventListener('change', (e) => {
        store.design.name = M.Storage.library.uniqueName(e.target.value, app.projectId);
        e.target.value = store.design.name;
        store.emit('change');
        app.saveNow();
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
      const refreshColors = () => {
        const hex = U.toHex(settings.color);
        document.querySelectorAll('[data-cur-color]').forEach((d) => (d.style.background = hex));
        refreshPressed();
      };
      $('fill-all').addEventListener('change', (e) => (settings.fillAll = e.target.checked));

      /* ---------- CRAFT ---------- */
      const refreshCraft = () => {
        const legend = app.getLegend();
        const list = $('legend-list');
        list.textContent = '';
        list.appendChild(app.makeEye());
        legend.entries.forEach((e) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-pressed', String(renderer.filter === e.color));
          b.title = 'Spotlight ' + e.hex;
          const sw = document.createElement('span');
          sw.className = 'swatch';
          sw.style.background = e.hex;
          sw.style.color = U.textOn(e.color);
          sw.textContent = e.symbol;
          const meta = document.createElement('span');
          meta.className = 'meta';
          meta.textContent = String(e.count);
          b.append(sw, meta);
          b.addEventListener('click', () => app.setFilter(renderer.filter === e.color ? null : e.color));
          list.appendChild(b);
        });
        if (!legend.entries.length) {
          const t = document.createElement('span');
          t.className = 'hint';
          t.textContent = 'No colors yet — draw something!';
          list.appendChild(t);
        }
      };

      app.ui.on('symbols', refreshCraft);
      $('legend-more').addEventListener('click', () => app.openSymbols(store.design, () => { store.touch({ keepPristine: true }); renderer.draw(); }));

      /* ---------- EXPORT ---------- */
      app.exportOptions = () => ({
        cell: Number($('ex-cell').value) || 24,
        colors: $('ex-colors').checked,
        symbols: $('ex-symbols').checked,
        coords: $('ex-coords').checked,
        marks: $('ex-marks').checked,
        grid: true,
      });
      // the same options and buttons serve the editor's pattern and the pattern view's pattern
      const target = () => (app.route && app.route.name === 'view' && app.viewDesign) || store.design;
      $('btn-preview').addEventListener('click', () => app.act.preview(target()));
      $('btn-art-png').addEventListener('click', () => app.act.artPng(target()));
      $('btn-save-file').addEventListener('click', () => app.act.saveFile(target()));

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
      app.ui.on('recent', app.savePrefs);
      app.ui.on('filter', refreshCraft);
      refreshColors();
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
