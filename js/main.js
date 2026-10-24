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
    app.savePrefs = () => M.Storage.savePrefs({ color: app.settings.color, recent: app.settings.recent, theme: app.theme });
    ui.on('color', U.debounce(app.savePrefs, 400));

    /* appearance: System follows the phone, Light / Dark force it */
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    app.applyTheme = (mode, save) => {
      app.theme = mode;
      const dark = mode === 'dark' || (mode === 'system' && mq && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#1a1822' : '#fbfaff');
      if (save) app.savePrefs();
    };
    if (mq && mq.addEventListener) mq.addEventListener('change', () => app.theme === 'system' && app.applyTheme('system'));
    app.applyTheme(app.theme);

    /* full screen (not available in every browser, e.g. iPhone Safari) */
    const fsButtons = ['zoom-full', 'view-full'];
    app.toggleFullscreen = () => {
      const de = document.documentElement;
      if (document.fullscreenElement) return document.exitFullscreen();
      if (!de.requestFullscreen) return app.toast('Full screen is not supported in this browser.', true);
      de.requestFullscreen().catch(() => app.toast('Could not enter full screen.', true));
    };
    fsButtons.forEach((id) => $(id).addEventListener('click', app.toggleFullscreen));
    document.addEventListener('fullscreenchange', () => fsButtons.forEach((id) => $(id).setAttribute('aria-pressed', String(!!document.fullscreenElement))));

    // the editor needs a design object before its first route
    store.load(M.Design.create(32, 32, U.EMPTY, 'Untitled'), { resetHistory: true });

    M.Actions.init(app);
    M.Dialogs.init(app);
    M.Editor.init(app);
    M.Panels.init(app);
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
