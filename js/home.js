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

      let ignoreClickUntil = 0;
      let continueEntry = null; // what the "Keep stitching" card currently shows
      let menuCard = null;

      /* ---------- folder picker (also used by the editor menu) ---------- */
      app.pickFolder = (id, done) => {
        const dlg = $('folder-dialog');
        const host = $('folder-list');
        const cur = (M.Storage.library.get(id) || {}).folder || '';
        const choose = (name) => {
          dlg.close();
          const r = M.Storage.library.setMeta(id, { folder: name });
          if (!r.ok) app.toast(r.error, true);
          else app.toast(name ? 'Moved to “' + name + '”' : 'Removed from folder');
          if (done) done();
        };
        const row = (icon, label, fn, on) => {
          const li = el('li');
          const b = el('button');
          b.type = 'button';
          b.innerHTML = '<svg class="ic sm"><use href="#' + icon + '"/></svg>';
          b.appendChild(document.createTextNode(label + (on ? '  ✓' : '')));
          b.addEventListener('click', fn);
          li.appendChild(b);
          host.appendChild(li);
        };
        host.textContent = '';
        M.Storage.library.folders().forEach((f) => row('i-folder', f, () => choose(f), f === cur));
        row('i-plus', 'New folder…', async () => {
          dlg.close();
          const name = await app.askText({ title: 'New folder', label: 'Folder name', value: '', okLabel: 'Create' });
          if (name && name.trim()) {
            const r = M.Storage.library.setMeta(id, { folder: name });
            if (!r.ok) app.toast(r.error, true);
            else app.toast('Moved to “' + name.trim().slice(0, 30) + '”');
            if (done) done();
          }
        });
        if (cur) row('i-close', 'No folder', () => choose(''));
        dlg.showModal();
      };
      $('folder-close').addEventListener('click', () => $('folder-dialog').close());

      /* ---------- long-press options (same look as the + speed dial) ---------- */
      const closeCardMenu = () => {
        $('card-menu').hidden = true;
        $('card-scrim').hidden = true;
        if (menuCard) menuCard.classList.remove('pressed');
        menuCard = null;
      };
      const openCardMenu = (entry, cardEl) => {
        closeCardMenu();
        const menu = $('card-menu');
        menu.textContent = '';
        menu.appendChild(el('div', 'ctx-title', entry.name));
        const item = (icon, label, fn, cls) => {
          const b = el('button', cls || '');
          b.type = 'button';
          b.setAttribute('role', 'menuitem');
          b.innerHTML = '<svg class="ic"><use href="#' + icon + '"/></svg>';
          b.appendChild(document.createTextNode(label));
          b.addEventListener('click', () => {
            closeCardMenu();
            fn();
          });
          menu.appendChild(b);
        };
        const meta = (patch, msg) => {
          const r = M.Storage.library.setMeta(entry.id, patch);
          if (!r.ok) app.toast(r.error, true);
          else if (msg) app.toast(msg);
          render();
        };
        if (entry.trashed) {
          item('i-restore', 'Restore', () => meta({ trashed: false }, 'Restored'));
          item('i-trash', 'Delete forever', async () => {
            const ok = await app.confirm({ title: 'Delete “' + entry.name + '” forever?', text: 'This removes the pattern and its progress from this device. It cannot be undone.', okLabel: 'Delete' });
            if (!ok) return;
            M.Storage.library.remove(entry.id);
            app.toast('Deleted');
            render();
          }, 'danger');
        } else {
          item('i-pin', entry.pinned ? 'Unpin' : 'Pin', () => meta({ pinned: !entry.pinned }));
          item('i-pencil', 'Rename', async () => {
            const name = await app.askText({ title: 'Rename pattern', label: 'Name', value: entry.name });
            if (name === null) return;
            const r = M.Storage.library.rename(entry.id, name);
            if (!r.ok) app.toast(r.error, true);
            render();
          });
          item('i-copy', 'Copy', () => {
            const r = M.Storage.library.duplicate(entry.id);
            if (!r.ok) return app.toast(r.error, true);
            app.toast('Copied — the copy starts with fresh progress');
            render();
          });
          item('i-folder', 'Move', () => app.pickFolder(entry.id, render));
          item('i-archive', entry.archived ? 'Unarchive' : 'Archive', () => meta({ archived: !entry.archived }, entry.archived ? 'Moved back' : 'Archived'));
          item('i-trash', 'Delete', () => meta({ trashed: true }, 'Moved to Trash'), 'danger');
        }

        menuCard = cardEl;
        cardEl.classList.add('pressed');
        $('card-scrim').hidden = false;
        menu.hidden = false;
        // sits just under the pressed card (above it when there is no room), inside the screen
        const r = cardEl.getBoundingClientRect();
        const mw = menu.offsetWidth;
        const mh = menu.offsetHeight;
        const left = Math.max(12, Math.min(r.left, innerWidth - mw - 12));
        let top = r.bottom + 12;
        if (top + mh > innerHeight - 12) top = r.top - mh - 12;
        top = Math.max(12, Math.min(top, innerHeight - mh - 12));
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
      };
      $('card-scrim').addEventListener('click', closeCardMenu);
      document.addEventListener('keydown', (e) => e.key === 'Escape' && closeCardMenu());

      /* long press (touch) or right click (mouse) opens the options, like the + button does */
      const attachLongPress = (node, getEntry) => {
        let timer = 0;
        let start = null;
        const cancel = () => {
          clearTimeout(timer);
          start = null;
        };
        const open = () => {
          const entry = getEntry();
          if (!entry) return;
          ignoreClickUntil = Date.now() + 700;
          if (navigator.vibrate) navigator.vibrate(12);
          openCardMenu(entry, node);
        };
        node.addEventListener('pointerdown', (ev) => {
          if (ev.pointerType === 'mouse' && ev.button !== 0) return;
          start = { x: ev.clientX, y: ev.clientY };
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (!start) return;
            start = null;
            open();
          }, 480);
        });
        node.addEventListener('pointermove', (ev) => {
          if (start && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 10) cancel();
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => node.addEventListener(t, cancel));
        node.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          cancel();
          open();
        });
      };

      attachLongPress($('continue-card'), () => continueEntry);

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
        if (e.theme && e.theme !== 'white') b.dataset.tone = e.theme;
        b.setAttribute('aria-label', 'Open ' + e.name);
        const body = el('div', 'body');
        const nm = el('div', 'name', e.name);
        if (e.pinned) nm.insertAdjacentHTML('afterbegin', '<svg class="ic sm pin-ic" aria-label="Pinned"><use href="#i-pin"/></svg>');
        body.append(nm, el('div', 'meta', metaText(e) + (e.folder ? ' · ' + e.folder : '')));
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
        b.addEventListener('click', () => {
          if (Date.now() < ignoreClickUntil) return; // the click that ends a long press
          if (e.trashed) return openCardMenu(e, b);
          M.Router.go('#/p/' + e.id);
        });
        attachLongPress(b, () => e);
        li.appendChild(b);
        return li;
      };

      const render = () => {
        const all = M.Storage.library.list();
        const live = all.filter((e) => !e.archived && !e.trashed);
        const folders = M.Storage.library.folders();
        if (/^f:/.test(filter) && !folders.includes(filter.slice(2))) filter = 'all';
        const list = live;
        const total = all.length;
        $('home-empty').hidden = total > 0;
        $('home-filters').hidden = total === 0;
        $('home-grid').hidden = total === 0;
        $('home-count').hidden = total === 0;
        $('home-count').textContent = live.length + (live.length === 1 ? ' pattern' : ' patterns');

        const fh = $('home-folders');
        fh.textContent = '';
        folders.forEach((f) => {
          const c = el('button', 'chipbtn');
          c.type = 'button';
          c.dataset.filter = 'f:' + f;
          c.innerHTML = '<svg class="ic sm"><use href="#i-folder"/></svg>';
          c.appendChild(document.createTextNode(f));
          fh.appendChild(c);
        });

        let shown;
        if (filter === 'archive') shown = all.filter((e) => e.archived && !e.trashed);
        else if (filter === 'trash') shown = all.filter((e) => e.trashed);
        else if (/^f:/.test(filter)) shown = live.filter((e) => e.folder === filter.slice(2));
        else shown = filter === 'all' ? live : live.filter((e) => state(e) === filter);
        shown = shown.filter((e) => e.pinned).concat(shown.filter((e) => !e.pinned));
        $('home-grid').textContent = '';
        shown.forEach((e) => $('home-grid').appendChild(card(e)));
        $('home-nomatch').hidden = !(total > 0 && shown.length === 0);
        $('home-nomatch').textContent = filter === 'trash' ? 'Trash is empty.' : filter === 'archive' ? 'Nothing archived.' : 'No patterns in this group yet.';

        const cont = list.find((e) => state(e) === 'progress');
        $('home-continue').hidden = !cont;
        continueEntry = cont || null;
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
          if (cont.theme && cont.theme !== 'white') cc.dataset.tone = cont.theme;
          else delete cc.dataset.tone;
          cc.append(matMini(cont), info);
          continueEntry = cont;
          cc.onclick = () => {
            if (Date.now() < ignoreClickUntil) return;
            M.Router.go('#/p/' + cont.id);
          };
        }
        document.querySelectorAll('#home-filters .chipbtn[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
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
        const name = $('new-name').value.trim().slice(0, 60);
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
            $('new-name').value = M.Storage.library.uniqueName('Untitled');
            dlg.showModal();
            $('new-name').select();
          } else if (what === 'import') $('file-home-input').click();
          else if (what === 'open') $('file-project').click();
        })
      );

      /* ---------- settings ---------- */
      const sdlg = $('settings-dialog');
      $('home-settings').addEventListener('click', () => {
        const list = M.Storage.library.list();
        let bytes = 0;
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.indexOf('mochipixelu:') === 0) bytes += k.length + (localStorage.getItem(k) || '').length;
          }
        } catch (err) {
          /* storage blocked */
        }
        $('set-about').textContent =
          'Mochipixelu v' + U.VERSION + ' · ' + list.length + (list.length === 1 ? ' pattern' : ' patterns') + ' · about ' + Math.max(1, Math.round(bytes / 1024)) + ' KB used. Everything stays on this device.';
        sdlg.showModal();
      });
      $('settings-close').addEventListener('click', () => sdlg.close());
      const syncTheme = () => document.querySelectorAll('#set-theme [data-theme-opt]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeOpt === app.theme)));
      $('set-theme').addEventListener('click', (e) => {
        const b = e.target.closest('[data-theme-opt]');
        if (!b) return;
        app.applyTheme(b.dataset.themeOpt, true);
        syncTheme();
      });
      $('home-settings').addEventListener('click', syncTheme);
      $('set-open').addEventListener('click', () => {
        sdlg.close();
        $('file-project').click();
      });
      $('set-clear').addEventListener('click', async () => {
        sdlg.close();
        const n = M.Storage.library.list().length;
        if (!n) return app.toast('There is nothing to delete.');
        const ok = await app.confirm({ title: 'Delete all ' + n + ' patterns?', text: 'Every pattern and its progress will be removed from this device. Save backup files first if you want to keep any. This cannot be undone.', okLabel: 'Delete all' });
        if (!ok) return;
        M.Storage.library.list().forEach((e) => M.Storage.library.remove(e.id));
        app.toast('All patterns deleted');
        render();
      });

      $('home-version').textContent = 'v' + U.VERSION;

      M.Router.register('home', {
        el: $('screen-home'),
        enter() {
          setMenu(false);
          closeCardMenu();
          render();
          window.scrollTo(0, 0);
        },
      });
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
