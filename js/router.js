/* Mochipixelu — tiny hash router between the three screens: home, project view, editor.
 *   #/            home (my patterns)
 *   #/p/<id>      project view (stitch highlight, Edit)
 *   #/e/<id>      editor
 */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});

  M.Router = {
    screens: {},
    current: null,

    register(name, screen) {
      this.screens[name] = screen; // { el, enter(params), leave() }
    },

    parse(hash) {
      const m = /^#\/(p|e)\/([A-Za-z0-9_-]+)$/.exec(hash || '');
      if (!m) return { name: 'home', id: null };
      return { name: m[1] === 'p' ? 'view' : 'editor', id: m[2] };
    },

    go(hash) {
      if (location.hash === hash) this.render();
      else location.hash = hash;
    },

    /** Replace the current history entry (used when a route is invalid). */
    redirect(hash) {
      history.replaceState(null, '', hash);
      this.render();
    },

    start(app) {
      this.app = app;
      window.addEventListener('hashchange', () => this.render());
      this.render();
    },

    render() {
      const app = this.app;
      let route = this.parse(location.hash);
      if (route.id && !M.Storage.library.get(route.id)) {
        // unknown / deleted project: fall back to the home page
        history.replaceState(null, '', '#/');
        route = { name: 'home', id: null };
      }
      const prev = this.current;
      if (prev && this.screens[prev.name] && this.screens[prev.name].leave) this.screens[prev.name].leave();
      this.current = route;
      app.route = route;
      Object.keys(this.screens).forEach((n) => (this.screens[n].el.hidden = n !== route.name));
      document.body.dataset.screen = route.name;
      this.screens[route.name].enter(route);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
