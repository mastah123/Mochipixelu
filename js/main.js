/* Mochipixelu — app bootstrap: shared app object, screens, routing, drag-and-drop. */
(function (root) {
  'use strict';
  const M = root.Mochi;
  const U = M.Utils;

  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const prefs = M.Storage.loadPrefs();

    const store = M.createStore(); // the pattern open in the editor
    const renderer = new M.Renderer($('canvas'));
    const ui = U.emitter();

    const app = {
      $,
      store,
      renderer,
      ui,
      settings: {
        tool: 'pencil',
        color: Number.isInteger(prefs.color) ? prefs.color : 0xe8737f,
        recent: Array.isArray(prefs.recent) ? prefs.recent.filter(Number.isInteger).slice(0, 14) : [],
        fillAll: false,
      },
      selected: null,
      hover: null,
      route: null,
      projectId: null, // library id of the pattern open in the editor
      pendingSource: null, // {id, source}: an image imported from the home page, handed to the editor
      loading: false,
    };

    /* legend cache for the editor — recomputed only after the grid changes */
    let legend = null;
    store.on('change', () => (legend = null));
    store.on('replace', () => (legend = null));
    app.getLegend = () => legend || (legend = M.Palette.legend(store.design));

    /* toast */
    let toastTimer = null;
    app.toast = (msg, isError) => {
      const t = $('toast');
      t.textContent = msg;
      t.classList.toggle('error', !!isError);
      t.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (t.hidden = true), isError ? 5000 : 2600);
    };

    /* prefs */
    app.theme = ['system', 'light', 'dark'].includes(prefs.theme) ? prefs.theme : 'system';
    app.homePrefs = Object.assign({ sort: 'recent', layout: 'grid', flayout: 'grid' }, prefs.home && typeof prefs.home === 'object' ? prefs.home : {});
    app.savePrefs = () => M.Storage.savePrefs({ color: app.settings.color, recent: app.settings.recent, theme: app.theme, home: app.homePrefs });
    ui.on('color', U.debounce(app.savePrefs, 400));

    /* legend symbols drawn inside the cells: one switch for both screens, remembered on the device */
    app.symbolsOn = () => app.homePrefs.symbols !== false;
    renderer.showSymbols = app.symbolsOn();
    app.setSymbols = (on) => {
      app.homePrefs.symbols = !!on;
      app.savePrefs();
      [renderer, app.viewRenderer].forEach((r) => {
        if (!r) return;
        r.showSymbols = !!on;
        if (r.design) r.draw();
      });
      ui.emit('symbols', !!on);
    };
    /** The eye button that starts every legend row. */
    app.makeEye = () => {
      const on = app.symbolsOn();
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'eye';
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? 'Hide symbols on the canvas' : 'Show symbols on the canvas');
      b.title = b.getAttribute('aria-label');
      b.innerHTML = '<svg class="ic"><use href="#' + (on ? 'i-eye' : 'i-eye-off') + '"/></svg>';
      b.addEventListener('click', () => app.setSymbols(!app.symbolsOn()));
      return b;
    };

    /** The tone color (hex) a screen currently wears, or null for the plain look. */
    app.toneHex = (screenEl) => {
      if (!screenEl || !screenEl.dataset.tone) return null;
      const v = getComputedStyle(screenEl).getPropertyValue('--tone').trim();
      return /^#[0-9a-f]{6}$/i.test(v) ? v : null;
    };

    /* appearance: System follows the phone, Light / Dark force it */
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    app.applyTheme = (mode, save) => {
      app.theme = mode;
      const dark = mode === 'dark' || (mode === 'system' && mq && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#1a1822' : '#fbfaff');
      if (save) app.savePrefs();
      if (app.retone) app.retone();
    };
    if (mq && mq.addEventListener) mq.addEventListener('change', () => app.theme === 'system' && app.applyTheme('system'));
    app.applyTheme(app.theme);

    // the editor needs a design object before its first route
    store.load(M.Design.create(32, 32, U.EMPTY, 'Untitled'), { resetHistory: true });

    M.Actions.init(app);
    M.Dialogs.init(app);
    M.Editor.init(app);
    M.Panels.init(app);
    M.ChartImport.init(app);
    M.Home.init(app);
    M.View.init(app);

    /* drag & drop: images become a new pattern (or replace the artwork inside the editor); project files open */
    const hint = $('drop-hint');
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    const inEditor = () => app.route && app.route.name === 'editor';
    document.addEventListener('dragenter', (e) => {
      if (!hasFiles(e)) return;
      depth++;
      if (inEditor()) hint.hidden = false;
    });
    document.addEventListener('dragleave', (e) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) hint.hidden = true;
    });
    document.addEventListener('dragover', (e) => hasFiles(e) && e.preventDefault());
    document.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      hint.hidden = true;
      const f = e.dataTransfer.files[0];
      if (!f) return;
      if (/\.(json|mochi)$/i.test(f.name)) app.openProjectFile(f);
      else if (inEditor()) app.importIntoEditor(f);
      else app.importAsProject(f);
    });

    // 1.1.0 kept a single autosaved design — carry it into the new library once
    const migrated = M.Storage.migrateAutosave();

    M.Router.start(app);
    if (migrated) app.toast('Your last design was moved into My patterns');

    root.mochipixelu = app; // handy for debugging / tests
  });
})(window);
