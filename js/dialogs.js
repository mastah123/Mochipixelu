/* Mochipixelu — pattern preview/print dialog and the saved-designs library dialog. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const U = M.Utils;

  M.Dialogs = {
    init(app) {
      const $ = app.$;
      const { store } = app;

      /* ---------- preview & print ---------- */
      const previewDlg = $('preview-dialog');
      let pages = [];

      const buildPages = () => {
        if (!app.getLegend().filled) {
          app.toast('The design is empty — draw something first.', true);
          return false;
        }
        const o = app.exportOptions();
        if (!o.colors && !o.symbols) {
          app.toast('Turn on colors or symbols so the pattern shows something.', true);
          return false;
        }
        try {
          pages = M.Exporter.buildPages(store.design, o).map((p) => ({ title: p.title, url: p.canvas.toDataURL('image/png') }));
        } catch (err) {
          app.toast('Could not build the pattern: ' + err.message, true);
          return false;
        }
        return true;
      };

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

      $('btn-preview').addEventListener('click', () => {
        if (!buildPages()) return;
        fill($('preview-pages'));
        previewDlg.showModal();
      });
      $('preview-close').addEventListener('click', () => previewDlg.close());
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

      /* ---------- library ---------- */
      const libDlg = $('library-dialog');

      const renderLibrary = () => {
        const list = $('library-list');
        list.textContent = '';
        const items = M.Storage.library.list();
        if (!items.length) {
          const li = document.createElement('li');
          li.className = 'hint';
          li.textContent = 'Nothing saved yet. Use “Save” in the top bar.';
          list.appendChild(li);
          return;
        }
        items.forEach((it) => {
          const li = document.createElement('li');
          const img = document.createElement('img');
          img.alt = '';
          if (it.thumb) img.src = it.thumb;
          const text = document.createElement('div');
          text.className = 'li-text';
          const name = document.createElement('strong');
          name.textContent = it.name;
          const meta = document.createElement('span');
          meta.textContent = it.width + ' × ' + it.height + ' · ' + new Date(it.updated).toLocaleString();
          text.append(name, meta);
          const open = document.createElement('button');
          open.className = 'btn small';
          open.textContent = 'Open';
          open.addEventListener('click', () => {
            try {
              const d = M.Storage.library.load(it.id);
              store.load(d, { checkpoint: true, source: null, pristine: false });
              app.libraryId = it.id;
              libDlg.close();
              app.toast('Opened “' + d.name + '”');
            } catch (err) {
              app.toast(err.message, true);
            }
          });
          const del = document.createElement('button');
          del.className = 'btn small';
          del.textContent = '🗑';
          del.setAttribute('aria-label', 'Delete ' + it.name);
          del.addEventListener('click', () => {
            if (!window.confirm('Delete “' + it.name + '” from this browser?')) return;
            M.Storage.library.remove(it.id);
            if (app.libraryId === it.id) app.libraryId = null;
            renderLibrary();
          });
          li.append(img, text, open, del);
          list.appendChild(li);
        });
      };

      $('btn-library').addEventListener('click', () => {
        renderLibrary();
        libDlg.showModal();
      });
      $('library-close').addEventListener('click', () => libDlg.close());

      $('btn-save-lib').addEventListener('click', () => {
        const res = M.Storage.library.save(store.design, app.libraryId);
        if (!res.ok) return app.toast(res.error, true);
        app.libraryId = res.id;
        app.toast('Saved “' + store.design.name + '” to My designs');
      });

      // close dialogs when clicking the backdrop
      [previewDlg, libDlg].forEach((dlg) =>
        dlg.addEventListener('click', (e) => {
          if (e.target === dlg) dlg.close();
        })
      );
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
