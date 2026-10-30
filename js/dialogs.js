/* Mochipixelu — shared dialogs: pattern preview/print, confirm, and a one-line text prompt. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});

  M.Dialogs = {
    init(app) {
      const $ = app.$;

      /* ---------- preview & print ---------- */
      const previewDlg = $('preview-dialog');
      let pages = [];
      let previewDesign = null;

      const fill = (host, className) => {
        host.textContent = '';
        pages.forEach((p, i) => {
          const wrap = document.createElement(className === 'print-page' ? 'div' : 'figure');
          if (className) wrap.className = className;
          const img = document.createElement('img');
          img.src = p.url;
          img.alt = p.title + ' (page ' + (i + 1) + ' of ' + pages.length + ')';
          wrap.appendChild(img);
          host.appendChild(wrap);
        });
      };

      /** Build the printable pages for any design and show the preview dialog. */
      app.openPreview = (design) => {
        previewDesign = design;
        if (!M.Palette.legend(design).filled) return app.toast('The pattern is empty — draw something first.', true);
        const o = app.exportOptions();
        if (!o.colors && !o.symbols) return app.toast('Turn on colors or symbols so the pattern shows something.', true);
        try {
          pages = M.Exporter.buildPages(design, o).map((p) => ({ title: p.title, url: p.canvas.toDataURL('image/png') }));
        } catch (err) {
          return app.toast('Could not build the pattern: ' + err.message, true);
        }
        fill($('preview-pages'));
        previewDlg.showModal();
      };

      $('preview-close').addEventListener('click', () => previewDlg.close());
      $('preview-png').addEventListener('click', () => previewDesign && app.act.patternPng(previewDesign));
      $('preview-print').addEventListener('click', () => {
        fill($('print-area'), 'print-page');
        const done = () => {
          document.body.classList.remove('printing');
          $('print-area').textContent = '';
        };
        document.body.classList.add('printing');
        window.addEventListener('afterprint', done, { once: true });
        // wait for the images to decode so the print sheet is not blank
        const imgs = Array.from($('print-area').querySelectorAll('img'));
        Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()))).then(() => window.print());
      });

      /* ---------- confirm ---------- */
      const confirmDlg = $('confirm-dialog');
      app.confirm = (o) =>
        new Promise((resolve) => {
          $('confirm-title').textContent = o.title || 'Are you sure?';
          $('confirm-text').textContent = o.text || '';
          $('confirm-ok').textContent = o.okLabel || 'OK';
          let result = false;
          $('confirm-ok').onclick = () => {
            result = true;
            confirmDlg.close();
          };
          $('confirm-cancel').onclick = () => confirmDlg.close();
          confirmDlg.onclose = () => resolve(result);
          confirmDlg.showModal();
        });

      /* ---------- one-line text prompt (rename) ---------- */
      const textDlg = $('text-dialog');
      app.askText = (o) =>
        new Promise((resolve) => {
          $('text-title').textContent = o.title || 'Name';
          $('text-label').textContent = o.label || 'Name';
          $('text-ok').textContent = o.okLabel || 'Save';
          const input = $('text-input');
          input.value = o.value || '';
          let result = null;
          $('text-form').onsubmit = (e) => {
            e.preventDefault();
            result = input.value;
            textDlg.close();
          };
          $('text-cancel').onclick = () => textDlg.close();
          textDlg.onclose = () => resolve(result);
          textDlg.showModal();
          input.focus();
          input.select();
        });

      /* ---------- legend symbols ---------- */
      const symDlg = $('symbols-dialog');
      const symList = $('symbols-list');
      let symDesign = null;
      let symChanged = null;
      const symRender = () => {
        const entries = M.Palette.legend(symDesign).entries;
        symList.textContent = '';
        entries.forEach((e) => {
          const row = document.createElement('label');
          row.className = 'sym-row';
          const sw = document.createElement('span');
          sw.className = 'swatch';
          sw.style.background = e.hex;
          sw.style.color = M.Utils.textOn(e.color);
          sw.textContent = e.symbol;
          const name = document.createElement('span');
          name.className = 'sym-name';
          name.textContent = e.hex + ' · ' + e.count;
          const sel = document.createElement('select');
          sel.setAttribute('aria-label', 'Symbol for ' + e.hex);
          const opts = M.Palette.SYMBOLS.slice();
          if (opts.indexOf(e.symbol) < 0) opts.unshift(e.symbol);
          opts.forEach((s) => {
            const o = document.createElement('option');
            o.value = s;
            o.textContent = s;
            if (s === e.symbol) o.selected = true;
            sel.appendChild(o);
          });
          sel.addEventListener('change', () => {
            const map = symDesign.symbols || (symDesign.symbols = {});
            const other = entries.find((x) => x !== e && x.symbol === sel.value);
            if (other) map[other.hex] = e.symbol; // swap, so symbols stay unique
            map[e.hex] = sel.value;
            symChanged();
            symRender();
          });
          row.append(sw, name, sel);
          symList.appendChild(row);
        });
      };
      app.openSymbols = (design, onChange) => {
        symDesign = design;
        symChanged = onChange;
        symRender();
        symDlg.showModal();
      };
      $('symbols-reset').addEventListener('click', () => {
        delete symDesign.symbols;
        symChanged();
        symRender();
      });
      $('symbols-done').addEventListener('click', () => symDlg.close());

      // close dialogs when clicking the backdrop
      document.querySelectorAll('dialog').forEach((dlg) =>
        dlg.addEventListener('click', (e) => {
          if (e.target === dlg) dlg.close();
        })
      );
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
