/* Mochipixelu — local-first persistence: autosave, library, project files. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const U = M.Utils;
  const D = M.Design;
  const S = {};

  const FORMAT = 'mochipixelu';
  const FORMAT_VERSION = 1;
  const KEY_AUTOSAVE = 'mochipixelu:autosave';
  const KEY_LIBRARY = 'mochipixelu:library';
  const KEY_PROJECT = 'mochipixelu:project:';
  const KEY_PREFS = 'mochipixelu:prefs';

  /* ---------- (de)serialisation ---------- */

  /** Design -> plain JSON-safe object (palette + index grid + completed cells). */
  S.serialize = (design) => {
    const palette = [];
    const lookup = new Map();
    const data = new Array(design.pixels.length);
    const done = [];
    for (let i = 0; i < design.pixels.length; i++) {
      const c = design.pixels[i];
      if (c === U.EMPTY) {
        data[i] = -1;
      } else {
        let idx = lookup.get(c);
        if (idx === undefined) {
          idx = palette.length;
          palette.push(U.toHex(c));
          lookup.set(c, idx);
        }
        data[i] = idx;
      }
      if (design.done[i]) done.push(i);
    }
    return {
      format: FORMAT,
      version: FORMAT_VERSION,
      name: design.name,
      width: design.width,
      height: design.height,
      palette,
      data,
      done,
    };
  };

  /** Validate + rebuild a design. Throws Error with a readable message on bad input. */
  S.deserialize = (obj) => {
    if (!obj || typeof obj !== 'object' || obj.format !== FORMAT) throw new Error('This is not a Mochipixelu project file.');
    if (typeof obj.version !== 'number' || obj.version > FORMAT_VERSION) throw new Error('This project was made with a newer version of Mochipixelu.');
    const w = obj.width;
    const h = obj.height;
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > U.MAX_SIZE || h > U.MAX_SIZE) {
      throw new Error('Project size is invalid (1–' + U.MAX_SIZE + ' cells per side).');
    }
    if (!Array.isArray(obj.palette) || !Array.isArray(obj.data) || obj.data.length !== w * h) {
      throw new Error('Project pixel data is damaged.');
    }
    const palette = obj.palette.map((hex) => {
      const c = U.fromHex(hex);
      if (c === null) throw new Error('Project palette contains an invalid color.');
      return c;
    });
    const d = D.create(w, h, U.EMPTY, typeof obj.name === 'string' ? obj.name.slice(0, 80) : 'Untitled');
    for (let i = 0; i < obj.data.length; i++) {
      const idx = obj.data[i];
      if (idx === -1) continue;
      if (!Number.isInteger(idx) || idx < 0 || idx >= palette.length) throw new Error('Project pixel data is damaged.');
      d.pixels[i] = palette[idx];
    }
    if (Array.isArray(obj.done)) {
      for (const i of obj.done) {
        if (Number.isInteger(i) && i >= 0 && i < d.done.length && d.pixels[i] !== U.EMPTY) d.done[i] = 1;
      }
    }
    return d;
  };

  /* ---------- localStorage helpers ---------- */

  const read = (key) => {
    try {
      const raw = root.localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  /** Returns true on success; false when storage is blocked or full. */
  const write = (key, value) => {
    try {
      root.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  };

  const remove = (key) => {
    try {
      root.localStorage.removeItem(key);
    } catch (e) {
      /* ignore */
    }
  };

  S.loadAutosave = () => {
    const obj = read(KEY_AUTOSAVE);
    if (!obj) return null;
    try {
      return S.deserialize(obj);
    } catch (e) {
      return null;
    }
  };

  S.savePrefs = (prefs) => write(KEY_PREFS, prefs);
  S.loadPrefs = () => read(KEY_PREFS) || {};

  /* ---------- library (every project lives here) ---------- */

  /** Progress numbers shown on home-page cards. */
  S.stats = (design) => {
    let filled = 0;
    let done = 0;
    const colors = new Set();
    for (let i = 0; i < design.pixels.length; i++) {
      const c = design.pixels[i];
      if (c === U.EMPTY) continue;
      filled++;
      colors.add(c);
      if (design.done[i]) done++;
    }
    return { filled, done, colors: colors.size };
  };

  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  S.library = {
    /** Newest first. */
    list() {
      const l = read(KEY_LIBRARY);
      return Array.isArray(l) ? l.slice().sort((a, b) => b.updated - a.updated) : [];
    },

    get(id) {
      return S.library.list().find((e) => e.id === id) || null;
    },

    /** Small PNG data URL of the design (browser only). */
    thumb(design) {
      if (typeof document === 'undefined') return '';
      const side = 120;
      const scale = Math.max(1, Math.floor(side / Math.max(design.width, design.height)));
      const c = document.createElement('canvas');
      c.width = design.width * scale;
      c.height = design.height * scale;
      const ctx = c.getContext('2d');
      for (let y = 0; y < design.height; y++) {
        for (let x = 0; x < design.width; x++) {
          const v = design.pixels[y * design.width + x];
          if (v === U.EMPTY) continue;
          ctx.fillStyle = U.toHex(v);
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
      return c.toDataURL('image/png');
    },

    /**
     * A name no other pattern uses (case-insensitive; the pattern's own id is ignored).
     * A taken name gets the next free number added: Heart → Heart1 → Heart2…
     * An empty name becomes Untitled, then Untitled1, Untitled2…
     */
    uniqueName(name, excludeId) {
      const taken = new Set(S.library.list().filter((e) => e.id !== excludeId).map((e) => String(e.name).toLowerCase()));
      let clean = String(name || '').trim().slice(0, 60);
      if (!clean) clean = 'Untitled';
      if (!taken.has(clean.toLowerCase())) return clean;
      const stem = (clean.replace(/\d+$/, '') || clean).slice(0, 55);
      let n = 1;
      while (taken.has((stem + n).toLowerCase())) n++;
      return stem + n;
    },

    /** Save (or overwrite when id is given). Returns {ok, id, error}. opts.keepName skips the unique-name rule. */
    save(design, id, opts) {
      id = id || newId();
      if (!(opts && opts.keepName)) design.name = S.library.uniqueName(design.name, id);
      const st = S.stats(design);
      const list = S.library.list().filter((e) => e.id !== id);
      list.unshift({
        id,
        name: design.name,
        width: design.width,
        height: design.height,
        updated: Date.now(),
        thumb: S.library.thumb(design),
        filled: st.filled,
        done: st.done,
        colors: st.colors,
      });
      if (!write(KEY_PROJECT + id, S.serialize(design)) || !write(KEY_LIBRARY, list)) {
        return { ok: false, error: 'Browser storage is full or unavailable. Use “Save file” to keep a copy instead.' };
      }
      return { ok: true, id };
    },

    load(id) {
      const obj = read(KEY_PROJECT + id);
      if (!obj) throw new Error('That pattern could not be found.');
      return S.deserialize(obj);
    },

    rename(id, name) {
      const design = S.library.load(id);
      design.name = name;
      return S.library.save(design, id);
    },

    /** Copy of a pattern with progress reset (a fresh start on the same art). */
    duplicate(id) {
      const design = S.library.load(id);
      design.done.fill(0);
      return S.library.save(design);
    },

    remove(id) {
      remove(KEY_PROJECT + id);
      write(
        KEY_LIBRARY,
        S.library.list().filter((e) => e.id !== id)
      );
    },
  };

  /** 1.1.0 kept one autosaved design; move it into the library the first time 1.2.0 runs. */
  S.migrateAutosave = () => {
    const old = S.loadAutosave();
    if (!old) return null;
    if (S.library.list().length === 0 && S.stats(old).filled > 0) {
      const res = S.library.save(old);
      if (res.ok) {
        remove(KEY_AUTOSAVE);
        return res.id;
      }
      return null;
    }
    remove(KEY_AUTOSAVE);
    return null;
  };

  /* ---------- project files ---------- */

  S.toFileText = (design) => JSON.stringify(S.serialize(design));
  S.fromFileText = (text) => {
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      throw new Error('That file is not valid JSON.');
    }
    return S.deserialize(obj);
  };

  M.Storage = S;
})(typeof window !== 'undefined' ? window : globalThis);
