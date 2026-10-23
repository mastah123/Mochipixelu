/* Mochipixelu — export actions that work on any design (the editor's or the project view's). */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const U = M.Utils;

  M.Actions = {
    init(app) {
      const X = M.Exporter;
      const base = (d) => U.safeFilename(d.name);

      const empty = (d) => {
        if (M.Palette.legend(d).filled) return false;
        app.toast('The pattern is empty — draw something first.', true);
        return true;
      };

      app.act = {
        async patternPng(d) {
          if (empty(d)) return;
          const o = app.exportOptions();
          if (!o.colors && !o.symbols) return app.toast('Turn on colors or symbols so the pattern shows something.', true);
          try {
            await X.downloadCanvas(X.renderFullPattern(d, o), base(d) + '-pattern.png');
            app.toast('Pattern PNG saved');
          } catch (err) {
            app.toast(err.message, true);
          }
        },

        async artPng(d) {
          if (empty(d)) return;
          const scale = Number(document.getElementById('art-scale').value) || 16;
          const transparent = document.getElementById('art-transparent').checked;
          try {
            await X.downloadCanvas(X.renderArt(d, scale, transparent), base(d) + '.png');
            app.toast('Artwork PNG saved');
          } catch (err) {
            app.toast(err.message, true);
          }
        },

        saveFile(d) {
          X.downloadBlob(new Blob([M.Storage.toFileText(d)], { type: 'application/json' }), base(d) + '.mochipixelu.json');
          app.toast('Backup file saved');
        },

        preview(d) {
          app.openPreview(d);
        },
      };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
