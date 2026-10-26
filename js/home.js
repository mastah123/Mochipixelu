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
      let query = '';
      let showAllTiles = false;

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
                $('home-grid').hidden = total === 0;

        const inFolder = /^f:/.test(filter);
        const tiles = $('home-folder-tiles');
        tiles.textContent = '';
        const showTiles = filter === 'all' && folders.length > 0 && !query;
        $('home-folders-sec').hidden = !showTiles;
        const fl = app.homePrefs.flayout === 'list' ? 'list' : 'grid';
        tiles.classList.toggle('list', fl === 'list');
        $('folders-layout').innerHTML = '<svg class="ic sm"><use href="#' + (fl === 'list' ? 'i-grid' : 'i-list') + '"/></svg>';
        $('folders-layout').setAttribute('aria-label', 'Folder layout: ' + fl);
        $('folders-all').hidden = folders.length <= 2;
        $('folders-all').textContent = showAllTiles ? 'Show less' : 'Show all';
        const byCount = folders.slice().sort((a, b) => live.filter((e) => e.folder === b).length - live.filter((e) => e.folder === a).length);
        byCount.slice(0, showAllTiles ? byCount.length : 2).forEach((f, i) => {
          const n = live.filter((e) => e.folder === f).length;
          const t = el('button', 'folder-tile tone-' + (i % 4));
          t.type = 'button';
          t.dataset.folder = f;
          t.innerHTML = '<svg class="ic"><use href="#i-folder"/></svg>';
          const tx = el('span', 'ft');
          tx.append(el('b', '', f), el('small', '', n + (n === 1 ? ' pattern' : ' patterns')));
          t.appendChild(tx);
          t.addEventListener('click', () => {
            filter = 'f:' + f;
            render();
            $('home-main').scrollTop = 0;
          });
          tiles.appendChild(t);
        });
        $('folder-head').hidden = !inFolder;
        if (inFolder) $('folder-title').textContent = filter.slice(2);

        let shown;
        if (filter === 'archive') shown = all.filter((e) => e.archived && !e.trashed);
        else if (filter === 'trash') shown = all.filter((e) => e.trashed);
        else if (filter === 'pinned') shown = live.filter((e) => e.pinned);
        else if (/^f:/.test(filter)) shown = live.filter((e) => e.folder === filter.slice(2));
        else shown = filter === 'all' ? live : live.filter((e) => state(e) === filter);
        if (query) shown = shown.filter((e) => e.name.toLowerCase().includes(query));
        const sortBy = app.homePrefs.sort;
        const cmp = {
          recent: (a, b) => b.updated - a.updated,
          oldest: (a, b) => a.updated - b.updated,
          name: (a, b) => a.name.localeCompare(b.name),
          progress: (a, b) => pct(b) - pct(a) || b.updated - a.updated,
          size: (a, b) => b.width * b.height - a.width * a.height,
        }[sortBy] || ((a, b) => b.updated - a.updated);
        shown = shown.slice().sort(cmp);
        const lay = app.homePrefs.layout === 'list' ? 'list' : 'grid';
        $('home-grid').classList.toggle('list', lay === 'list');
        $('grid-layout').innerHTML = '<svg class="ic sm"><use href="#' + (lay === 'list' ? 'i-grid' : 'i-list') + '"/></svg>';
        $('grid-layout').setAttribute('aria-label', 'Pattern layout: ' + lay);
        shown = shown.filter((e) => e.pinned).concat(shown.filter((e) => !e.pinned));
        $('home-grid').textContent = '';
        shown.forEach((e) => $('home-grid').appendChild(card(e)));
        $('home-nomatch').hidden = !(total > 0 && shown.length === 0);
        $('home-nomatch').textContent = query ? 'No pattern matches “' + query + '”.' : filter === 'trash' ? 'Trash is empty.' : filter === 'archive' ? 'Nothing archived.' : 'No patterns in this group yet.';

        const cont = list.find((e) => state(e) === 'progress');
        $('home-continue').hidden = !cont || filter !== 'all' || !!query;
        continueEntry = cont || null;
        const cc = $('continue-card');
        cc.textContent = '';
        if (cont) {
          const info = el('div', 'info');
          const bar = el('span', 'mini');
          bar.appendChild(el('i'));
          bar.firstChild.style.width = pct(cont) + '%';
          info.append(el('div', 'kicker', 'Continue stitching'), el('div', 'name', cont.name), el('div', 'meta', pct(cont) + '% stitched · ' + metaText(cont)), bar);
          if (cont.theme && cont.theme !== 'white') cc.dataset.tone = cont.theme;
          else delete cc.dataset.tone;
          cc.append(info, matMini(cont));
          continueEntry = cont;
          cc.onclick = () => {
            if (Date.now() < ignoreClickUntil) return;
            M.Router.go('#/p/' + cont.id);
          };
        }
        renderDrawer(all, live, folders);
      };
      app.renderHome = render;

      $('folder-back').addEventListener('click', () => {
        filter = 'all';
        render();
      });
      $('folder-rename').addEventListener('click', async () => {
        const old = filter.slice(2);
        const name = await app.askText({ title: 'Rename folder', label: 'Folder name', value: old });
        if (name === null || !name.trim()) return;
        const r = M.Storage.library.renameFolder(old, name);
        if (!r.ok) return app.toast(r.error, true);
        filter = 'f:' + name.trim().slice(0, 30);
        render();
      });
      $('folder-remove').addEventListener('click', async () => {
        const old = filter.slice(2);
        const ok = await app.confirm({ title: 'Remove folder “' + old + '”?', text: 'The patterns inside are kept — they just move back to All.', okLabel: 'Remove folder' });
        if (!ok) return;
        M.Storage.library.renameFolder(old, '');
        filter = 'all';
        render();
        app.toast('Folder removed');
      });
      /* ---------- side drawer: views, folders, progress, settings ---------- */
      const drawer = $('drawer');
      let showAllFolders = false;
      const wide = () => window.matchMedia('(min-width: 900px)').matches;
      const setDrawer = (open) => {
        drawer.classList.toggle('open', open);
        $('drawer-scrim').hidden = !open || wide();
        $('home-menu').setAttribute('aria-expanded', String(open));
      };
      const TITLES = { all: 'Recent patterns', pinned: 'Pinned', archive: 'Archive', trash: 'Trash', progress: 'In progress', done: 'Finished', new: 'Not started' };
      const renderDrawer = (all, live, folders) => {
        const count = (id, n) => ($(id).textContent = n ? String(n) : '');
        count('dc-all', live.length);
        count('dc-pinned', live.filter((e) => e.pinned).length);
        count('dc-archive', all.filter((e) => e.archived && !e.trashed).length);
        count('dc-trash', all.filter((e) => e.trashed).length);
        count('dc-progress', live.filter((e) => state(e) === 'progress').length);
        count('dc-done', live.filter((e) => state(e) === 'done').length);
        count('dc-new', live.filter((e) => state(e) === 'new').length);
        const host = $('drawer-folders');
        host.textContent = '';
        const cap = showAllFolders ? folders.length : 4;
        folders.slice(0, cap).forEach((f) => {
          const b = el('button');
          b.type = 'button';
          b.dataset.view = 'f:' + f;
          b.innerHTML = '<svg class="ic"><use href="#i-folder"/></svg>';
          b.append(el('span', 'dl', f), el('span', 'dc', String(live.filter((e) => e.folder === f).length || '')));
          host.appendChild(b);
        });
        $('drawer-showall').hidden = folders.length <= 4;
        $('drawer-showall').textContent = showAllFolders ? 'Show less' : 'Show all';
        drawer.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.view === filter)));
        $('home-title').textContent = /^f:/.test(filter) ? filter.slice(2) : TITLES[filter] || 'Recent patterns';
      };
      $('home-menu').addEventListener('click', () => setDrawer(!drawer.classList.contains('open')));
      $('drawer-scrim').addEventListener('click', () => setDrawer(false));
      document.addEventListener('keydown', (e) => e.key === 'Escape' && drawer.classList.contains('open') && setDrawer(false));
      $('drawer-showall').addEventListener('click', () => {
        showAllFolders = !showAllFolders;
        render();
      });
      $('drawer-newfolder').addEventListener('click', async () => {
        const name = await app.askText({ title: 'New folder', label: 'Folder name', value: '', okLabel: 'Create' });
        if (name === null || !name.trim()) return;
        const r = M.Storage.library.addFolder(name);
        if (!r.ok) return app.toast(r.error, true);
        filter = 'f:' + r.name;
        setDrawer(false);
        render();
      });
      drawer.addEventListener('click', (e) => {
        const b = e.target.closest('[data-view]');
        if (!b) return;
        filter = b.dataset.view;
        if (searchBox && !searchBox.hidden) setSearch(false);
        setDrawer(false);
        render();
        $('home-main').scrollTop = 0;
      });

      /* ---------- Folders / patterns headers: show all, layout toggles, sort menu ---------- */
      $('folders-all').addEventListener('click', () => {
        showAllTiles = !showAllTiles;
        render();
      });
      $('folders-layout').addEventListener('click', () => {
        app.homePrefs.flayout = app.homePrefs.flayout === 'list' ? 'grid' : 'list';
        app.savePrefs();
        render();
      });
      $('grid-layout').addEventListener('click', () => {
        app.homePrefs.layout = app.homePrefs.layout === 'list' ? 'grid' : 'list';
        app.savePrefs();
        render();
      });
      const SORTS = [['recent', 'Recently edited'], ['oldest', 'Oldest first'], ['name', 'Name A–Z'], ['progress', 'Most progress'], ['size', 'Largest']];
      const sortMenu = $('sort-menu');
      const setSortMenu = (open) => {
        sortMenu.hidden = !open;
        $('sort-btn').setAttribute('aria-expanded', String(open));
        if (!open) return;
        sortMenu.textContent = '';
        SORTS.forEach(([k, label]) => {
          const b = el('button');
          b.type = 'button';
          b.setAttribute('role', 'menuitemradio');
          b.setAttribute('aria-checked', String(app.homePrefs.sort === k));
          b.append(el('span', '', label), el('span', 'tick', app.homePrefs.sort === k ? '✓' : ''));
          b.addEventListener('click', () => {
            app.homePrefs.sort = k;
            app.savePrefs();
            setSortMenu(false);
            render();
          });
          sortMenu.appendChild(b);
        });
      };
      $('sort-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        setSortMenu(sortMenu.hidden);
      });
      document.addEventListener('click', (e) => {
        if (!sortMenu.hidden && !sortMenu.contains(e.target)) setSortMenu(false);
      });
      document.addEventListener('keydown', (e) => e.key === 'Escape' && !sortMenu.hidden && setSortMenu(false));

      /* ---------- search ---------- */
      const searchBox = $('home-search');
      const setSearch = (open) => {
        searchBox.hidden = !open;
        $('home-search-btn').setAttribute('aria-expanded', String(open));
        if (open) $('home-search-input').focus();
        else {
          $('home-search-input').value = '';
          query = '';
          render();
        }
      };
      $('home-search-btn').addEventListener('click', () => setSearch(searchBox.hidden));
      $('home-search-clear').addEventListener('click', () => setSearch(false));
      $('home-search-input').addEventListener('input', (e) => {
        query = e.target.value.trim().toLowerCase();
        render();
      });
      $('home-search-input').addEventListener('keydown', (e) => e.key === 'Escape' && setSearch(false));

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
      $('drawer-settings').addEventListener('click', () => {
        setDrawer(false);
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
      $('drawer-settings').addEventListener('click', syncTheme);
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
