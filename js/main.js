/* Mochipixelu — app bootstrap: shared app object, autosave, initial design. */
(function (root) {
  'use strict';
  const M = root.Mochi;
  const U = M.Utils;

  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    const prefs = M.Storage.loadPrefs();

    const store = M.createStore();
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
      libraryId: null,
    };

    /* legend cache — recomputed only after the grid changes */
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
    app.savePrefs = () => M.Storage.savePrefs({ color: app.settings.color, recent: app.settings.recent });
    ui.on('color', U.debounce(app.savePrefs, 400));

    /* autosave (design + progress) */
    let warned = false;
    const autosave = U.debounce(() => {
      if (!M.Storage.saveAutosave(store.design) && !warned) {
        warned = true;
        app.toast('Autosave is unavailable (browser storage blocked or full). Use “Save file” to keep your work.', true);
      }
    }, 500);
    store.on('change', autosave);
    store.on('replace', autosave);

    M.Editor.init(app);
    M.Panels.init(app);
    M.Dialogs.init(app);

    /* initial design: restore autosave, otherwise a blank 32×32 */
    const saved = M.Storage.loadAutosave();
    store.load(saved || M.Design.create(32, 32, U.EMPTY, 'Untitled'), { resetHistory: true });
    if (saved) app.toast('Welcome back — your last design was restored');

    root.mochipixelu = app; // handy for debugging / tests
  });
})(window);
