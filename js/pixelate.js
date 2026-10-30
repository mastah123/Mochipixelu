/* Mochipixelu — turn source image data into a real pixel grid (dominant exact colors, no feathering). */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const U = M.Utils;
  const EMPTY = U.EMPTY;
  const P = {};

  /** Longest side of the working copy kept of an imported image. */
  P.SOURCE_MAX = 1024;

  /** Width/height that keep the source aspect ratio when the longest side is `longest`. */
  P.fitSize = (sw, sh, longest) => {
    longest = U.clamp(Math.round(longest), 1, U.MAX_SIZE);
    if (sw >= sh) return { w: longest, h: U.clamp(Math.round((longest * sh) / sw), 1, U.MAX_SIZE) };
    return { w: U.clamp(Math.round((longest * sw) / sh), 1, U.MAX_SIZE), h: longest };
  };

  /**
   * Convert RGBA source data into a tw×th grid. Every target cell averages the
   * source area it covers (alpha-weighted), so the result changes the real number of
   * cells instead of just zooming. Cells that are mostly transparent become EMPTY.
   * src: { data: Uint8ClampedArray (RGBA), width, height }.
   */
  P.pixelate = (src, tw, th, opts) => {
    if (!opts || opts.mode !== 'average') return P.dominant(src, tw, th, opts);
    const cutoff = opts && opts.alphaCutoff !== undefined ? opts.alphaCutoff : 128;
    tw = U.clamp(Math.round(tw), 1, U.MAX_SIZE);
    th = U.clamp(Math.round(th), 1, U.MAX_SIZE);
    const { data, width: sw, height: sh } = src;
    const out = new Int32Array(tw * th);

    // Precompute per-column coverage once; it is identical for every row.
    const colSpans = new Array(tw);
    for (let x = 0; x < tw; x++) {
      const a = (x * sw) / tw;
      const b = ((x + 1) * sw) / tw;
      const spans = [];
      for (let sx = Math.floor(a); sx < Math.min(sw, Math.ceil(b)); sx++) {
        const w = Math.min(sx + 1, b) - Math.max(sx, a);
        if (w > 0) spans.push(sx, w);
      }
      colSpans[x] = spans;
    }

    for (let y = 0; y < th; y++) {
      const ya = (y * sh) / th;
      const yb = ((y + 1) * sh) / th;
      for (let x = 0; x < tw; x++) {
        const spans = colSpans[x];
        let wSum = 0, aSum = 0, rSum = 0, gSum = 0, bSum = 0;
        for (let sy = Math.floor(ya); sy < Math.min(sh, Math.ceil(yb)); sy++) {
          const wy = Math.min(sy + 1, yb) - Math.max(sy, ya);
          if (wy <= 0) continue;
          const row = sy * sw;
          for (let k = 0; k < spans.length; k += 2) {
            const w = spans[k + 1] * wy;
            const i = (row + spans[k]) * 4;
            const a = data[i + 3];
            wSum += w;
            aSum += a * w;
            const aw = a * w;
            rSum += data[i] * aw;
            gSum += data[i + 1] * aw;
            bSum += data[i + 2] * aw;
          }
        }
        const alpha = wSum > 0 ? aSum / wSum : 0;
        out[y * tw + x] =
          alpha < cutoff || aSum === 0
            ? EMPTY
            : U.pack(Math.round(rSum / aSum), Math.round(gSum / aSum), Math.round(bSum / aSum));
      }
    }
    return out;
  };

  /**
   * Default import: no feathering. Each target cell takes the dominant (most frequent, area-weighted)
   * exact color of the source area it covers, so only colors that exist in the image are used —
   * nothing is blended, dithered or anti-aliased. A cell that is mostly transparent becomes EMPTY.
   */
  P.dominant = (src, tw, th, opts) => {
    const cutoff = opts && opts.alphaCutoff !== undefined ? opts.alphaCutoff : 128;
    tw = U.clamp(Math.round(tw), 1, U.MAX_SIZE);
    th = U.clamp(Math.round(th), 1, U.MAX_SIZE);
    const { data, width: sw, height: sh } = src;
    const out = new Int32Array(tw * th);
    for (let y = 0; y < th; y++) {
      const ya = (y * sh) / th, yb = ((y + 1) * sh) / th;
      for (let x = 0; x < tw; x++) {
        const xa = (x * sw) / tw, xb = ((x + 1) * sw) / tw;
        const counts = new Map();
        let clear = 0, solid = 0;
        for (let sy = Math.floor(ya); sy < Math.min(sh, Math.ceil(yb)); sy++) {
          const wy = Math.min(sy + 1, yb) - Math.max(sy, ya);
          if (wy <= 0) continue;
          for (let sx = Math.floor(xa); sx < Math.min(sw, Math.ceil(xb)); sx++) {
            const w = (Math.min(sx + 1, xb) - Math.max(sx, xa)) * wy;
            if (w <= 0) continue;
            const i = (sy * sw + sx) * 4;
            if (data[i + 3] < cutoff) { clear += w; continue; }
            solid += w;
            const c = U.pack(data[i], data[i + 1], data[i + 2]);
            counts.set(c, (counts.get(c) || 0) + w);
          }
        }
        if (solid === 0 || clear > solid) { out[y * tw + x] = EMPTY; continue; }
        let best = EMPTY, bw = -1;
        counts.forEach((w, c) => { if (w > bw + 1e-9 || (Math.abs(w - bw) <= 1e-9 && c < best)) { bw = w; best = c; } });
        out[y * tw + x] = best;
      }
    }
    return out;
  };

  /** Build a design from a source image: pixelate, then optionally limit colors. */
  P.designFromSource = (src, tw, th, maxColors, name) => {
    let px = P.pixelate(src, tw, th);
    if (maxColors > 0) px = M.Palette.quantize(px, maxColors);
    const d = M.Design.create(tw, th, EMPTY, name);
    d.pixels.set(px);
    return d;
  };

  M.Pixelate = P;
})(typeof window !== 'undefined' ? window : globalThis);
