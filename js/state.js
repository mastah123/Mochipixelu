/* Mochipixelu — design model, grid operations and undo/redo store. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const U = M.Utils;
  const EMPTY = U.EMPTY;
  const D = {};

  /**
   * A design is { name, width, height, pixels: Int32Array(w*h), done: Uint8Array(w*h) }.
   * pixels hold 0xRRGGBB or EMPTY (-1). done[i] = 1 when that stitch is completed.
   * Coordinates are 0-based internally and shown 1-based in the UI/patterns.
   */
  D.create = (width, height, fill, name) => {
    const w = U.clamp(Math.round(width), 1, U.MAX_SIZE);
    const h = U.clamp(Math.round(height), 1, U.MAX_SIZE);
    return {
      name: name || 'Untitled',
      width: w,
      height: h,
      pixels: new Int32Array(w * h).fill(fill === undefined ? EMPTY : fill),
      done: new Uint8Array(w * h),
    };
  };

  D.fromPixels = (pixels, width, height, name) => {
    const d = D.create(width, height, EMPTY, name);
    d.pixels.set(pixels.subarray ? pixels.subarray(0, d.pixels.length) : pixels);
    return d;
  };

  D.clone = (d) => {
    const c = { name: d.name, width: d.width, height: d.height, pixels: d.pixels.slice(), done: d.done.slice() };
    if (d.symbols) c.symbols = Object.assign({}, d.symbols);
    return c;
  };

  D.inBounds = (d, x, y) => x >= 0 && y >= 0 && x < d.width && y < d.height;
  D.index = (d, x, y) => y * d.width + x;

  /** Nearest-neighbour rescale of the existing pixels (keeps progress marks). */
  D.resample = (d, nw, nh) => {
    const out = D.create(nw, nh, EMPTY, d.name);
    if (d.symbols) out.symbols = Object.assign({}, d.symbols);
    for (let y = 0; y < out.height; y++) {
      const sy = Math.min(d.height - 1, Math.floor(((y + 0.5) * d.height) / out.height));
      for (let x = 0; x < out.width; x++) {
        const sx = Math.min(d.width - 1, Math.floor(((x + 0.5) * d.width) / out.width));
        const si = sy * d.width + sx;
        const di = y * out.width + x;
        out.pixels[di] = d.pixels[si];
        out.done[di] = d.done[si];
      }
    }
    return out;
  };

  /** Crop or pad to a new size. ax/ay in [0,1] choose the anchor (0 = top-left, .5 = center). */
  D.resizeCanvas = (d, nw, nh, ax, ay) => {
    const out = D.create(nw, nh, EMPTY, d.name);
    if (d.symbols) out.symbols = Object.assign({}, d.symbols);
    const ox = Math.round((out.width - d.width) * (ax || 0));
    const oy = Math.round((out.height - d.height) * (ay || 0));
    for (let y = 0; y < d.height; y++) {
      const ty = y + oy;
      if (ty < 0 || ty >= out.height) continue;
      for (let x = 0; x < d.width; x++) {
        const tx = x + ox;
        if (tx < 0 || tx >= out.width) continue;
        out.pixels[ty * out.width + tx] = d.pixels[y * d.width + x];
        out.done[ty * out.width + tx] = d.done[y * d.width + x];
      }
    }
    return out;
  };

  /** 4-connected flood fill. Returns the number of changed cells. */
  D.floodFill = (d, x, y, color) => {
    if (!D.inBounds(d, x, y)) return 0;
    const start = d.pixels[y * d.width + x];
    if (start === color) return 0;
    const stack = [x, y];
    let changed = 0;
    while (stack.length) {
      const cy = stack.pop();
      const cx = stack.pop();
      let i = cy * d.width + cx;
      if (d.pixels[i] !== start) continue;
      d.pixels[i] = color;
      changed++;
      if (cx > 0 && d.pixels[i - 1] === start) stack.push(cx - 1, cy);
      if (cx < d.width - 1 && d.pixels[i + 1] === start) stack.push(cx + 1, cy);
      if (cy > 0 && d.pixels[i - d.width] === start) stack.push(cx, cy - 1);
      if (cy < d.height - 1 && d.pixels[i + d.width] === start) stack.push(cx, cy + 1);
    }
    return changed;
  };

  /** Replace every cell of color `from` with `to`. Returns the number of changed cells. */
  D.replaceColor = (d, from, to) => {
    if (from === to) return 0;
    let n = 0;
    for (let i = 0; i < d.pixels.length; i++) {
      if (d.pixels[i] === from) {
        d.pixels[i] = to;
        n++;
      }
    }
    return n;
  };

  /** Bresenham line; calls fn(x, y) for every cell, endpoints included. */
  D.line = (x0, y0, x1, y1, fn) => {
    let dx = Math.abs(x1 - x0);
    let dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      fn(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  };

  /** Totals used by the progress bar: filled stitches and how many are done. */
  D.stats = (d) => {
    let filled = 0;
    let done = 0;
    for (let i = 0; i < d.pixels.length; i++) {
      if (d.pixels[i] !== EMPTY) {
        filled++;
        if (d.done[i]) done++;
      }
    }
    return { filled, done, total: d.pixels.length };
  };

  D.snapshot = (d, pristine) => ({
    width: d.width,
    height: d.height,
    pixels: d.pixels.slice(),
    done: d.done.slice(),
    pristine: !!pristine,
  });

  M.Design = D;

  /**
   * Store: holds the current design, the (optional, in-memory) imported source image,
   * and snapshot-based undo/redo. Events: 'change' (cells edited), 'replace'
   * (design swapped or resized), 'history' (undo/redo availability changed).
   */
  M.createStore = () => {
    const ev = U.emitter();
    const LIMIT = 60;
    const s = {
      design: D.create(32, 32, EMPTY, 'Untitled'),
      source: null, // { data: Uint8ClampedArray, width, height, name }
      pristine: false, // true while the grid is an untouched pixelation of `source`
      undoStack: [],
      redoStack: [],
      on: ev.on,
      emit: ev.emit,
    };

    s.canUndo = () => s.undoStack.length > 0;
    s.canRedo = () => s.redoStack.length > 0;

    /** Save the current state so the next edit can be undone. */
    s.checkpoint = () => {
      s.undoStack.push(D.snapshot(s.design, s.pristine));
      if (s.undoStack.length > LIMIT) s.undoStack.shift();
      s.redoStack.length = 0;
      ev.emit('history');
    };

    /** Drop the newest checkpoint (used when a stroke ended up changing nothing). */
    s.dropCheckpoint = () => {
      s.undoStack.pop();
      ev.emit('history');
    };

    /** Call after mutating cells. Progress-only edits keep the "pristine" flag. */
    s.touch = (opts) => {
      if (!opts || !opts.keepPristine) s.pristine = false;
      ev.emit('change');
    };

    const apply = (snap) => {
      const d = s.design;
      d.width = snap.width;
      d.height = snap.height;
      d.pixels = snap.pixels.slice();
      d.done = snap.done.slice();
      s.pristine = snap.pristine;
      ev.emit('replace');
      ev.emit('history');
    };

    /** Throw away the newest checkpoint and restore it (no redo entry) — used to cancel an accidental stroke. */
    s.rollback = () => {
      if (!s.undoStack.length) return false;
      apply(s.undoStack.pop());
      return true;
    };

    s.undo = () => {
      if (!s.undoStack.length) return false;
      s.redoStack.push(D.snapshot(s.design, s.pristine));
      apply(s.undoStack.pop());
      return true;
    };

    s.redo = () => {
      if (!s.redoStack.length) return false;
      s.undoStack.push(D.snapshot(s.design, s.pristine));
      apply(s.redoStack.pop());
      return true;
    };

    /** Swap in a whole new design (new canvas, import, resize, opened file). */
    s.load = (design, opts) => {
      opts = opts || {};
      if (opts.checkpoint) s.checkpoint();
      s.design = design;
      if (opts.source !== undefined) s.source = opts.source;
      s.pristine = !!opts.pristine;
      if (opts.resetHistory) {
        s.undoStack.length = 0;
        s.redoStack.length = 0;
      }
      ev.emit('replace');
      ev.emit('history');
    };

    return s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
