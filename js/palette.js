/* Mochipixelu — palettes, color quantization (median cut) and the pattern legend. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const U = M.Utils;
  const EMPTY = U.EMPTY;
  const Q = {};

  /** A cozy default swatch set (hex strings). */
  Q.DEFAULT_PALETTE = [
    '#2b2019', '#5a4638', '#8b6b4f', '#c49a6c', '#f1d9b5', '#fff7e8',
    '#ffffff', '#b8b2aa', '#7d7770', '#46434a', '#e8737f', '#c2415a',
    '#f4a6a0', '#ffd1c9', '#f28c4b', '#f6b94a', '#f6d98c', '#fff0a8',
    '#9cc58d', '#5e9c63', '#2f6e4a', '#a8dccb', '#6bb5b0', '#9fc9e6',
    '#5b8fd1', '#3b5ba5', '#b9a6e0', '#8a6fc4', '#e6b3dc', '#c46fb3',
    '#d4a373', '#7a3e2b',
  ];

  /**
   * Reduce the colors in `pixels` (Int32Array, EMPTY ignored) to at most maxColors
   * using median cut, then map every pixel to its nearest palette color.
   * Returns a new Int32Array. maxColors <= 0 (or already few enough colors) is a copy.
   */
  Q.quantize = (pixels, maxColors) => {
    const out = pixels.slice();
    maxColors = Math.floor(maxColors);
    if (!(maxColors >= 1)) return out;

    const counts = new Map();
    for (let i = 0; i < pixels.length; i++) {
      const c = pixels[i];
      if (c !== EMPTY) counts.set(c, (counts.get(c) || 0) + 1);
    }
    if (counts.size <= maxColors) return out;

    const entries = [];
    counts.forEach((n, c) => {
      const [r, g, b] = U.rgb(c);
      entries.push({ c, n, r, g, b });
    });

    const rangeOf = (box) => {
      let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
      for (const e of box) {
        if (e.r < rMin) rMin = e.r;
        if (e.r > rMax) rMax = e.r;
        if (e.g < gMin) gMin = e.g;
        if (e.g > gMax) gMax = e.g;
        if (e.b < bMin) bMin = e.b;
        if (e.b > bMax) bMax = e.b;
      }
      const rr = rMax - rMin, gr = gMax - gMin, br = bMax - bMin;
      const max = Math.max(rr, gr, br);
      return { max, channel: max === rr ? 'r' : max === gr ? 'g' : 'b' };
    };

    let boxes = [entries];
    while (boxes.length < maxColors) {
      // split the splittable box with the largest color range
      let best = -1, bestRange = -1, bestChannel = 'r';
      boxes.forEach((box, i) => {
        if (box.length < 2) return;
        const r = rangeOf(box);
        if (r.max > bestRange) {
          bestRange = r.max;
          best = i;
          bestChannel = r.channel;
        }
      });
      if (best < 0) break;
      const box = boxes[best].slice().sort((a, b) => a[bestChannel] - b[bestChannel]);
      const total = box.reduce((s, e) => s + e.n, 0);
      let acc = 0, cut = 1;
      for (let i = 0; i < box.length - 1; i++) {
        acc += box[i].n;
        cut = i + 1;
        if (acc >= total / 2) break;
      }
      boxes.splice(best, 1, box.slice(0, cut), box.slice(cut));
    }

    const palette = boxes.map((box) => {
      let n = 0, r = 0, g = 0, b = 0;
      for (const e of box) {
        n += e.n;
        r += e.r * e.n;
        g += e.g * e.n;
        b += e.b * e.n;
      }
      return U.pack(Math.round(r / n), Math.round(g / n), Math.round(b / n));
    });

    const map = new Map();
    counts.forEach((_, c) => {
      let best = palette[0], bd = Infinity;
      for (const p of palette) {
        const d = U.dist2(c, p);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      map.set(c, best);
    });
    for (let i = 0; i < out.length; i++) if (out[i] !== EMPTY) out[i] = map.get(out[i]);
    return out;
  };

  const SYMBOLS = (
    '●■▲◆★♥✚✖○□△◇☆♡+xoABCDEFGHJKLMNPRSTUVWYZ' +
    'abcdefghjkmnpqrstuvwyz23456789'
  ).split('');
  Q.SYMBOLS = SYMBOLS;

  /**
   * Legend: one entry per used color, most-used first, each with a stable symbol and number.
   * Returns { entries: [{index, color, hex, count, done, symbol}], filled, total, byColor: Map }.
   */
  Q.legend = (design) => {
    const counts = new Map();
    const dones = new Map();
    let filled = 0;
    for (let i = 0; i < design.pixels.length; i++) {
      const c = design.pixels[i];
      if (c === EMPTY) continue;
      filled++;
      counts.set(c, (counts.get(c) || 0) + 1);
      if (design.done[i]) dones.set(c, (dones.get(c) || 0) + 1);
    }
    const colors = Array.from(counts.keys()).sort((a, b) => counts.get(b) - counts.get(a) || a - b);
    const byColor = new Map();
    const entries = colors.map((color, i) => {
      const e = {
        index: i + 1,
        color,
        hex: U.toHex(color),
        count: counts.get(color),
        done: dones.get(color) || 0,
        symbol: (design.symbols && design.symbols[U.toHex(color)]) || (i < SYMBOLS.length ? SYMBOLS[i] : String(i + 1)),
      };
      byColor.set(color, e);
      return e;
    });
    return { entries, filled, total: design.pixels.length, byColor };
  };

  M.Palette = Q;
})(typeof window !== 'undefined' ? window : globalThis);
