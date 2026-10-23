/* Mochipixelu — home screen: the pattern box (saved projects), filters, "continue" card, and the + speed dial. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const U = M.Utils;
  const D = M.Design;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  const pct = (e) => (e.filled ? Math.round((e.done / e.filled) * 100) : 0);
  const state = (e) => (e.filled && e.done >= e.filled ? 'done' : e.done > 0 ? 'progress' : 'new');

  M.Home = {
    init(app) {
      const $ = app.$;
      let filter = 'all';

      const matMini = (e) => {
        const mat = el('div', 'mat');
        if (e.thumb) {
          const img = el('img');
          img.src = e.thumb;
          img.alt = '';
          mat.appendChild(img);
        }
        return mat;
      };

      const metaText = (e) => e.width + ' × ' + e.height + ' · ' + e.colors + ' color' + (e.colors === 1 ? '' : 's');

      const card = (e) => {
        const li = el('li');
        const b = el('button', 'card');
        b.type = 'button';
        b.dataset.id = e.id;
        b.setAttribute('aria-label', 'Open ' + e.name);
        const body = el('div', 'body');
        body.append(el('div', 'name', e.name), el('div', 'meta', metaText(e)));
        const st = state(e);
        if (st === 'progress') {
          const bar = el('span', 'mini');
          bar.appendChild(el('i'));
          bar.firstChild.style.width = pct(e) + '%';
          body.append(bar, el('div', 'meta', pct(e) + '% stitched'));
        } else {
          body.appendChild(el('span', st === 'done' ? 'badge done' : 'badge', st === 'done' ? 'Finished' : 'Not started'));
        }
        b.append(matMini(e), body);
        b.addEventListener('click', () => M.Router.go('#/p/' + e.id));
        li.appendChild(b);
        return li;
      };

      const render = () => {
        const list = M.Storage.library.list();
        const total = list.length;
        $('home-empty').hidden = total > 0;
        $('home-filters').hidden = total === 0;
        $('home-grid').hidden = total === 0;
        $('home-count').hidden = total === 0;
        $('home-count').textContent = total + (total === 1 ? ' pattern' : ' patterns');

        const shown = filter === 'all' ? list : list.filter((e) => state(e) === filter);
        $('home-grid').textContent = '';
        shown.forEach((e) => $('home-grid').appendChild(card(e)));
        $('home-nomatch').hidden = !(total > 0 && shown.length === 0);

        const cont = list.find((e) => state(e) === 'progress');
        $('home-continue').hidden = !cont;
        const cc = $('continue-card');
        cc.textContent = '';
        if (cont) {
          const info = el('div', 'info');
          info.append(el('div', 'name', cont.name), el('div', 'meta', pct(cont) + '% stitched · ' + metaText(cont)));
          const bar = el('span', 'mini');
          bar.appendChild(el('i'));
          bar.firstChild.style.width = pct(cont) + '%';
          const go = el('span', 'go');
          go.innerHTML = '<svg class="ic sm"><use href="#i-highlight"/></svg>';
          go.appendChild(document.createTextNode('Keep stitching'));
          info.append(bar, go);
          cc.append(matMini(cont), info);
          cc.onclick = () => M.Router.go('#/p/' + cont.id);
        }
        document.querySelectorAll('#home-filters .chipbtn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
      };
      app.renderHome = render;

      $('home-filters').addEventListener('click', (e) => {
        const b = e.target.closest('[data-filter]');
        if (!b) return;
        filter = b.dataset.filter;
        render();
      });

      /* ---------- + speed dial ---------- */
      const fab = $('fab');
      const setMenu = (open) => {
        $('fab-menu').hidden = !open;
        fab.setAttribute('aria-expanded', String(open));
      };
      fab.addEventListener('click', () => setMenu($('fab-menu').hidden));
      document.addEventListener('click', (e) => {
        if (!$('fab-menu').hidden && !$('fab-wrap').contains(e.target)) setMenu(false);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$('fab-menu').hidden) setMenu(false);
      });

      /* ---------- new canvas ---------- */
      const dlg = $('new-dialog');
      const readSize = (id) => {
        const n = Math.round(Number($(id).value));
        return Number.isFinite(n) && n >= 1 ? U.clamp(n, 1, U.MAX_SIZE) : null;
      };
      $('new-presets').addEventListener('click', (e) => {
        const b = e.target.closest('[data-size]');
        if (!b) return;
        $('new-w').value = b.dataset.size;
        $('new-h').value = b.dataset.size;
      });
      $('new-cancel').addEventListener('click', () => dlg.close());
      $('new-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const w = readSize('new-w');
        const h = readSize('new-h');
        if (w === null || h === null) return app.toast('Enter a width and height between 1 and ' + U.MAX_SIZE + '.', true);
        const fill = $('new-bg').value === 'white' ? 0xffffff : U.EMPTY;
        const name = $('new-name').value.trim().slice(0, 60) || 'Untitled';
        const r = M.Storage.library.save(D.create(w, h, fill, name));
        if (!r.ok) return app.toast(r.error, true);
        dlg.close();
        M.Router.go('#/e/' + r.id);
      });

      /* ---------- import an image as a new pattern ---------- */
      app.importAsProject = async (file) => {
        try {
          const src = await M.Images.readFile(file);
          const { w, h } = M.Pixelate.fitSize(src.width, src.height, Math.min(48, Math.max(src.width, src.height)));
          const name = M.Images.baseName(file) || 'Imported image';
          const design = M.Pixelate.designFromSource(src, w, h, 0, name);
          const r = M.Storage.library.save(design);
          if (!r.ok) return app.toast(r.error, true);
          app.pendingSource = { id: r.id, source: src };
          M.Router.go('#/e/' + r.id);
        } catch (err) {
          app.toast(err.message || 'Could not import that image.', true);
        }
      };

      /* ---------- open a backup file ---------- */
      app.openProjectFile = async (file) => {
        try {
          if (file.size > 25 * 1024 * 1024) throw new Error('That file is too large to be a Mochipixelu project.');
          const d = M.Storage.fromFileText(await file.text());
          const r = M.Storage.library.save(d);
          if (!r.ok) return app.toast(r.error, true);
          app.toast('Opened “' + d.name + '”');
          M.Router.go('#/p/' + r.id);
        } catch (err) {
          app.toast(err.message || 'Could not open that file.', true);
        }
      };

      $('file-home-input').addEventListener('change', (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (f) app.importAsProject(f);
      });
      $('file-project').addEventListener('change', (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (f) app.openProjectFile(f);
      });

      document.querySelectorAll('[data-home]').forEach((b) =>
        b.addEventListener('click', () => {
          setMenu(false);
          const what = b.dataset.home;
          if (what === 'new') {
            $('new-name').value = 'Untitled';
            dlg.showModal();
            $('new-name').select();
          } else if (what === 'import') $('file-home-input').click();
          else if (what === 'open') $('file-project').click();
        })
      );

      $('home-version').textContent = 'v' + U.VERSION;

      M.Router.register('home', {
        el: $('screen-home'),
        enter() {
          setMenu(false);
          render();
          window.scrollTo(0, 0);
        },
      });
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
