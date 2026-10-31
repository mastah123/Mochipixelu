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
      // the most frequent color that really exists in the box (never a blend)
      let top = box[0];
      for (const e of box) if (e.n > top.n || (e.n === top.n && e.c < top.c)) top = e;
      return top.c;
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

  /** Friendly colour names: the nearest of a small craft-style list (weighted RGB distance). */
  const NAMES = [
    ['White', 0xffffff], ['Ivory', 0xfffff0], ['Cream', 0xfdf3dc], ['Light grey', 0xd3d3d3], ['Grey', 0x8c8c8c], ['Charcoal', 0x444444], ['Black', 0x111111],
    ['Red', 0xe02020], ['Crimson', 0xb01030], ['Burgundy', 0x7a1230], ['Maroon', 0x5a1a1a], ['Coral', 0xff7f6e], ['Salmon', 0xfa9a85], ['Blush pink', 0xf6a5b4], ['Pink', 0xff9ec4],
    ['Hot pink', 0xff4fa0], ['Magenta', 0xd81b8c], ['Rose', 0xd9577a], ['Light pink', 0xffd1dc], ['Orange', 0xff8c1a], ['Peach', 0xffc9a0], ['Apricot', 0xf7b778], ['Gold', 0xe6b422],
    ['Yellow', 0xffe135], ['Light yellow', 0xfff3a0], ['Mustard', 0xd1a21a], ['Lime', 0xa6d60f], ['Light green', 0xa8e08c], ['Green', 0x3cb44b], ['Forest green', 0x1f6b3a], ['Olive', 0x7a7a1a],
    ['Mint', 0xb2f0d0], ['Teal', 0x138a8a], ['Turquoise', 0x30d5c8], ['Aqua', 0x7fe5f0], ['Sky blue', 0x87ceeb], ['Light blue', 0xb5d8f5], ['Blue', 0x2f6fb5], ['Royal blue', 0x2040c0],
    ['Navy', 0x14305a], ['Indigo', 0x3a2a8a], ['Violet', 0x8a4fd0], ['Purple', 0x7b2fa0], ['Lavender', 0xc9b6ec], ['Lilac', 0xe0c4ee], ['Plum', 0x6a2a5a], ['Brown', 0x7a4a2a],
    ['Tan', 0xc89c6a], ['Beige', 0xe8d8b8], ['Chocolate', 0x4a2a1a], ['Terracotta', 0xc8623c],
  ];
  Q.colorName = (color) => {
    const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
    let best = NAMES[0][0], bd = Infinity;
    for (const [n, c] of NAMES) {
      const dr = r - ((c >> 16) & 255), dg = g - ((c >> 8) & 255), db = b - (c & 255);
      const rm = (r + ((c >> 16) & 255)) / 2; // redmean: closer to how colours look
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  };

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
