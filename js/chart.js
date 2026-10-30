/* Mochipixelu — read an existing pattern chart (screenshot/photo of a grid) back into cells.
 * Batch U: find the grid (cell size, origin, columns, rows). Pure logic, no DOM.
 * src: { data: Uint8ClampedArray (RGBA), width, height }. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const C = {};

  const EDGE = 18; // summed |dR|+|dG|+|dB| between neighbours that counts as an edge

  /** For each x (edge between x-1 and x) count rows whose neighbour colours differ; likewise for y. */
  const profiles = (src, rect) => {
    const { data, width: w } = src;
    const x0 = rect.x, y0 = rect.y, x1 = rect.x + rect.w, y1 = rect.y + rect.h;
    // noise floor: photos/JPEGs wiggle by a few levels everywhere; real grid edges are far above that
    const sample = [];
    for (let y = y0; y < y1; y += 3) for (let x = x0 + 1; x < x1; x += 3) { const i = (y * w + x) * 4; sample.push(Math.abs(data[i] - data[i - 4]) + Math.abs(data[i + 1] - data[i - 3]) + Math.abs(data[i + 2] - data[i - 2])); }
    sample.sort((a, b) => a - b);
    const T = Math.max(EDGE, 4 * (sample[Math.floor(sample.length / 2)] || 0));
    const cx = new Float64Array(src.width + 1);
    const cy = new Float64Array(src.height + 1);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        if (x > x0) {
          const d = Math.abs(data[i] - data[i - 4]) + Math.abs(data[i + 1] - data[i - 3]) + Math.abs(data[i + 2] - data[i - 2]);
          if (d > T) cx[x]++;
        }
        if (y > y0) {
          const j = i - w * 4;
          const d = Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2]);
          if (d > T) cy[y]++;
        }
      }
    }
    return { cx, cy };
  };

  /** Strongest value within ±1 of position p (lines are 1–3px wide and anti-aliased). */
  const near = (arr, p) => {
    const i = Math.round(p);
    let m = 0;
    for (let k = i - 1; k <= i + 1; k++) if (k >= 0 && k < arr.length && arr[k] > m) m = arr[k];
    return m;
  };

  /** Period (cell size, sub-pixel) and phase of the regular grid in an edge profile, within [lo, hi). */
  const period = (arr, lo, hi) => {
    const n = hi - lo;
    let mean = 0;
    for (let i = lo; i < hi; i++) mean += arr[i];
    mean /= n || 1;
    const a = new Float64Array(n);
    for (let i = 0; i < n; i++) a[i] = arr[lo + i] - mean;
    const maxLag = Math.min(Math.floor(n / 3), 160);
    const R = new Float64Array(maxLag + 2);
    for (let l = 3; l <= maxLag + 1; l++) {
      let s = 0;
      for (let i = 0; i + l < n; i++) s += a[i] * a[i + l];
      R[l] = s / (n - l); // normalise by overlap so long lags are not punished
    }
    let best = 0;
    for (let l = 4; l <= maxLag; l++) if (R[l] > best) best = R[l];
    if (best <= 0) return null;
    let lag = 0;
    for (let l = 4; l <= maxLag; l++) {
      if (R[l] >= 0.55 * best && R[l] >= R[l - 1] && R[l] >= R[l + 1]) { lag = l; break; } // smallest strong period
    }
    if (!lag) return null;
    // refine: comb score over the whole range
    let bp = lag, bph = 0, bs = -1;
    for (let p = lag - 1.5; p <= lag + 1.5; p += 0.02) {
      if (p < 3) continue;
      for (let ph = 0; ph < p; ph += 0.5) {
        let s = 0;
        for (let x = lo + ph; x < hi; x += p) s += near(arr, x);
        if (s > bs) { bs = s; bp = p; bph = ph; }
      }
    }
    // keep the phase of the first boundary inside the range, then tidy ±1px using the real peak
    return { p: bp, phase: lo + bph };
  };

  /** Boundaries at phase + k*p over [lo, hi); returns the contiguous strong run: {first, count, strengths}. */
  const extent = (arr, per, lo, hi, frac) => {
    const pos = [];
    for (let x = per.phase; x < hi; x += per.p) if (x >= lo - 1) pos.push(x);
    const s = pos.map((x) => near(arr, x));
    const top = s.reduce((m, v) => Math.max(m, v), 0);
    if (top <= 0) return null;
    const thr = frac * top;
    let bestA = -1, bestB = -1, a = -1, last = -1;
    for (let i = 0; i < s.length; i++) {
      if (s[i] >= thr) {
        if (a < 0 || i - last > 2) a = i; // gaps of up to 2 weak lines stay in the run
        last = i;
        if (last - a > bestB - bestA) { bestA = a; bestB = last; }
      }
    }
    if (bestA < 0 || bestB <= bestA) return null;
    return { first: pos[bestA], count: bestB - bestA, pos, s, a: bestA, b: bestB };
  };

  /**
   * Find the grid. opts.rect restricts the search to a crop {x,y,w,h} (default: whole image).
   * Returns { x, y, cols, rows, cellW, cellH, confidence } or null when no regular grid is found.
   */
  C.detectGrid = (src, opts) => {
    const r = (opts && opts.rect) || { x: 0, y: 0, w: src.width, h: src.height };
    const rect = { x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)), w: 0, h: 0 };
    rect.w = Math.min(src.width - rect.x, Math.round(r.w));
    rect.h = Math.min(src.height - rect.y, Math.round(r.h));
    if (opts && opts.rect) { // a crop drawn right on the outer grid lines would cut them off: look 3px beyond it
      const px0 = Math.max(0, rect.x - 3), py0 = Math.max(0, rect.y - 3);
      rect.w = Math.min(src.width - px0, rect.w + (rect.x - px0) + 3);
      rect.h = Math.min(src.height - py0, rect.h + (rect.y - py0) + 3);
      rect.x = px0; rect.y = py0;
    }
    if (rect.w < 16 || rect.h < 16) return null;
    const { cx, cy } = profiles(src, rect);
    const px = period(cx, rect.x, rect.x + rect.w);
    const py = period(cy, rect.y, rect.y + rect.h);
    if (!px || !py) return null;
    // with a crop from the user the whole crop is the pattern, so only barely-there lines are ignored;
    // without one this is just a suggestion for the crop and must not run into text/tables around the chart
    const frac = opts && opts.rect ? 0.06 : 0.25;
    const ex = extent(cx, px, rect.x, rect.x + rect.w, frac);
    const ey = extent(cy, py, rect.y, rect.y + rect.h, frac);
    if (!ex || !ey || ex.count < 2 || ey.count < 2) return null;
    const conf = (e, arr, per) => {
      let on = 0, off = 0, n = 0;
      for (let i = e.a; i <= e.b; i++) {
        on += e.s[i];
        off += near(arr, e.pos[i] + per.p / 2);
        n++;
      }
      return off > 0 ? on / off : 99;
    };
    const confidence = Math.min(conf(ex, cx, px), conf(ey, cy, py));
    if (confidence < 2) return null; // no regular grid lines (e.g. round beads)
    return {
      x: ex.first, y: ey.first, cols: ex.count, rows: ey.count, cellW: px.p, cellH: py.p,
      confidence,
    };
  };

  /* ---------- Batch V: read the cells ---------- */

  const dist = (a, b) => {
    const dr = ((a >> 16) & 255) - ((b >> 16) & 255), dg = ((a >> 8) & 255) - ((b >> 8) & 255), db = (a & 255) - (b & 255);
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };
  const median = (arr) => { arr.sort((p, q) => p - q); return arr[arr.length >> 1]; };

  /** The dominant colour of one cell's inner area, or null if it has no opaque pixels. Grid lines sit on the
   *  cell border and symbols/text only cover part of the cell, so the most common colour is the cell's own. */
  const cellColor = (src, x0, y0, x1, y1, inset) => {
    const { data, width, height } = src;
    const w = x1 - x0, h = y1 - y0;
    const ax = Math.max(0, Math.round(x0 + w * inset)), bx = Math.min(width, Math.max(ax + 1, Math.round(x1 - w * inset)));
    const ay = Math.max(0, Math.round(y0 + h * inset)), by = Math.min(height, Math.max(ay + 1, Math.round(y1 - h * inset)));
    if (bx <= ax || by <= ay) return null;
    const bins = new Map(); // coarse bin (4 bits per channel) -> pixels in it; noise stays inside a bin
    for (let y = ay; y < by; y++) for (let x = ax; x < bx; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      let b = bins.get(key);
      if (!b) bins.set(key, (b = { r: [], g: [], b: [] }));
      b.r.push(data[i]); b.g.push(data[i + 1]); b.b.push(data[i + 2]);
    }
    let best = null;
    bins.forEach((b) => { if (!best || b.r.length > best.r.length) best = b; });
    if (!best) return null;
    // neighbouring bins can split one noisy colour in two: take the median of the winning bin (exact when clean)
    return { color: (median(best.r) << 16) | (median(best.g) << 8) | median(best.b), share: best.r.length / ((bx - ax) * (by - ay)) };
  };

  const isWhite = (c) => ((c >> 16) & 255) >= 235 && ((c >> 8) & 255) >= 235 && (c & 255) >= 235;
  const isGrey = (c) => {
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    return Math.max(r, g, b) - Math.min(r, g, b) <= 20 && (r + g + b) / 3 > 40; // white, light or mid greys, checker; not black
  };

  /**
   * Read a chart into cells using a grid from detectGrid (or one the user adjusted).
   * opts: tolerance (colour distance that counts as the same colour, default 16),
   *       empty: 'auto' | 'white' | 'none' | [colors]  (default 'auto'): which colour means "no stitch".
   *         auto = the outer ring of the chart is mostly white or grey (or checker) -> that is the background.
   * Returns { cols, rows, pixels: Int32Array (0xRRGGBB or -1), palette: [{color, count}], empty: color|null }.
   */
  C.readCells = (src, grid, opts) => {
    opts = opts || {};
    const tol = opts.tolerance !== undefined ? opts.tolerance : 16;
    const cols = grid.cols, rows = grid.rows;
    const raw = new Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x0 = grid.x + i * grid.cellW, y0 = grid.y + j * grid.cellH;
      const r = cellColor(src, x0, y0, x0 + grid.cellW, y0 + grid.cellH, opts.inset !== undefined ? opts.inset : 0.2);
      raw[j * cols + i] = r ? r.color : -1;
    }
    // merge colours that only differ by compression noise: most frequent first, the first one within tolerance wins
    const freq = new Map();
    raw.forEach((c) => c >= 0 && freq.set(c, (freq.get(c) || 0) + 1));
    const order = Array.from(freq.keys()).sort((a, b) => freq.get(b) - freq.get(a) || a - b);
    const reps = [];
    const map = new Map();
    order.forEach((c) => {
      let rep = null;
      for (const r of reps) if (dist(c, r) <= tol) { rep = r; break; }
      if (rep === null) reps.push((rep = c));
      map.set(c, rep);
    });
    const pixels = new Int32Array(cols * rows);
    for (let i = 0; i < pixels.length; i++) pixels[i] = raw[i] < 0 ? -1 : map.get(raw[i]);

    // which colours mean "empty"?
    let emptyColors = [];
    let rule = opts.empty === undefined ? 'auto' : opts.empty;
    if (Array.isArray(rule)) emptyColors = rule.map((c) => { const m = reps.find((r) => dist(r, c) <= tol); return m === undefined ? c : m; });
    else if (rule === 'white') emptyColors = reps.filter(isWhite);
    else if (rule === 'auto') {
      const ring = new Map();
      let n = 0;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        if (i && j && i < cols - 1 && j < rows - 1) continue;
        const c = pixels[j * cols + i];
        n++;
        if (c >= 0) ring.set(c, (ring.get(c) || 0) + 1);
      }
      let top = null;
      ring.forEach((k, c) => { if (top === null || k > ring.get(top)) top = c; });
      if (top !== null && ring.get(top) >= 0.4 * n && (isWhite(top) || isGrey(top))) emptyColors = [top];
    }
    if (emptyColors.length) for (let i = 0; i < pixels.length; i++) if (emptyColors.indexOf(pixels[i]) >= 0) pixels[i] = -1;
    const counts = new Map();
    pixels.forEach((c) => c >= 0 && counts.set(c, (counts.get(c) || 0) + 1));
    const palette = Array.from(counts.keys()).sort((a, b) => counts.get(b) - counts.get(a)).map((color) => ({ color, count: counts.get(color) }));
    return { cols, rows, pixels, palette, empty: emptyColors.length ? emptyColors[0] : null };
  };

  M.Chart = C;
})(typeof window !== 'undefined' ? window : globalThis);
