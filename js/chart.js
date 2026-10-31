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
    // sub-pixel refit: the comb search only knows the pitch to ~0.1px, which drifts a whole column over a big chart.
    // Find each strong line's real position (centroid around the expected one) and fit pos = a + p*k by least squares.
    const pts = [];
    for (let i = bestA; i <= bestB; i++) {
      if (s[i] < 0.5 * top) continue;
      const c = Math.round(pos[i]);
      let sw = 0, sx = 0;
      for (let k = c - 2; k <= c + 2; k++) if (k >= 0 && k < arr.length) { sw += arr[k]; sx += arr[k] * k; }
      if (sw > 0) pts.push([i - bestA, sx / sw]);
    }
    if (pts.length >= 4) {
      let n = 0, sk = 0, sp = 0, skk = 0, skp = 0;
      pts.forEach(([k, x]) => { n++; sk += k; sp += x; skk += k * k; skp += k * x; });
      const den = n * skk - sk * sk;
      if (den > 0) {
        const slope = (n * skp - sk * sp) / den;
        const icpt = (sp - slope * sk) / n;
        if (Math.abs(slope - per.p) < 0.06 * per.p) {
          const first = icpt;
          return { first, count: bestB - bestA, pos, s, a: bestA, b: bestB, p: slope };
        }
      }
    }
    return { first: pos[bestA], count: bestB - bestA, pos, s, a: bestA, b: bestB, p: per.p };
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
    if (confidence < 2 && !(opts && opts.beads)) return null; // no regular grid lines (round beads need opts.beads)
    return {
      x: ex.first, y: ey.first, cols: ex.count, rows: ey.count, cellW: ex.p, cellH: ey.p,
      confidence,
    };
  };

  /**
   * Separate patterns on one image (e.g. several bead designs on a plain sheet): everything that differs from the
   * background colour (the most common colour on the image border) is grouped into blobs. Returns rectangles
   * {x,y,w,h} in image pixels, biggest first, or [] when there is no plain background.
   */
  C.findRegions = (src, opts) => {
    const { data, width: W, height: H } = src;
    const step = 2, w = Math.ceil(W / step), h = Math.ceil(H / step);
    const px = (x, y) => { const i = (Math.min(H - 1, y * step) * W + Math.min(W - 1, x * step)) * 4; return [data[i], data[i + 1], data[i + 2]]; };
    const votes = new Map();
    const vote = (x, y) => { const c = px(x, y); const k = ((c[0] >> 4) << 8) | ((c[1] >> 4) << 4) | (c[2] >> 4); votes.set(k, (votes.get(k) || 0) + 1); };
    for (let x = 0; x < w; x++) { vote(x, 0); vote(x, h - 1); }
    for (let y = 0; y < h; y++) { vote(0, y); vote(w - 1, y); }
    let bk = -1, bn = 0;
    votes.forEach((n, k) => { if (n > bn) { bn = n; bk = k; } });
    if (bn < 0.5 * (2 * (w + h))) return []; // the border is not one plain colour
    const bg = [(((bk >> 8) & 15) << 4) + 8, (((bk >> 4) & 15) << 4) + 8, ((bk & 15) << 4) + 8];
    const tol = (opts && opts.tolerance) || 48;
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = px(x, y);
      if (Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]) > tol) mask[y * w + x] = 1;
    }
    // close small gaps (between beads, around text) so one pattern is one blob
    const r = (opts && opts.gap) || Math.max(3, Math.round(Math.max(W, H) / 220));
    const dil = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) dil[ny * w + nx] = 1;
      }
    }
    const seen = new Uint8Array(w * h);
    const out = [];
    const stack = [];
    for (let s0 = 0; s0 < w * h; s0++) {
      if (!dil[s0] || seen[s0]) continue;
      let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
      stack.push(s0); seen[s0] = 1;
      while (stack.length) {
        const q = stack.pop(); const qx = q % w, qy = (q - qx) / w;
        n++; if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
        if (qx > 0 && dil[q - 1] && !seen[q - 1]) { seen[q - 1] = 1; stack.push(q - 1); }
        if (qx < w - 1 && dil[q + 1] && !seen[q + 1]) { seen[q + 1] = 1; stack.push(q + 1); }
        if (qy > 0 && dil[q - w] && !seen[q - w]) { seen[q - w] = 1; stack.push(q - w); }
        if (qy < h - 1 && dil[q + w] && !seen[q + w]) { seen[q + w] = 1; stack.push(q + w); }
      }
      const rx = Math.max(0, (x0 + r) * step), ry = Math.max(0, (y0 + r) * step);
      const rw = Math.min(W, (x1 - r + 1) * step) - rx, rh = Math.min(H, (y1 - r + 1) * step) - ry; // undo the dilation
      if (rw >= 24 && rh >= 24 && rw * rh >= 0.004 * W * H) out.push({ x: rx, y: ry, w: rw, h: rh });
    }
    return out.sort((a, b) => b.w * b.h - a.w * a.h);
  };

  /**
   * Find every separate chart on an image and check that each really holds a grid (lines or beads), so text,
   * photos and tables on a page are not offered as patterns. Returns [{ rect, grid }], biggest first.
   */
  C.findPatterns = (src) => {
    const out = [];
    C.findRegions(src).forEach((rect) => {
      const g = C.detectGrid(src, { rect }) || C.detectGrid(src, { rect, beads: true });
      if (g && g.cols >= 3 && g.rows >= 3 && g.cols <= 256 && g.rows <= 256) out.push({ rect, grid: g });
    });
    return out;
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
      // only the background around the pattern is empty: background-coloured cells that are enclosed by the
      // design (an eye highlight, a white stitch) are real stitches
      if (emptyColors.length) {
        const outside = new Uint8Array(cols * rows);
        const stack = [];
        const push = (i, j) => { const k = j * cols + i; if (i >= 0 && j >= 0 && i < cols && j < rows && !outside[k] && emptyColors.indexOf(pixels[k]) >= 0) { outside[k] = 1; stack.push(k); } };
        for (let i = 0; i < cols; i++) { push(i, 0); push(i, rows - 1); }
        for (let j = 0; j < rows; j++) { push(0, j); push(cols - 1, j); }
        while (stack.length) { const k = stack.pop(), i = k % cols, j = (k - i) / cols; push(i - 1, j); push(i + 1, j); push(i, j - 1); push(i, j + 1); }
        for (let k = 0; k < pixels.length; k++) if (outside[k]) pixels[k] = -2;
        for (let k = 0; k < pixels.length; k++) if (pixels[k] === -2) pixels[k] = -1;
        return finish(pixels, cols, rows, top);
      }
    }
    if (emptyColors.length) for (let i = 0; i < pixels.length; i++) if (emptyColors.indexOf(pixels[i]) >= 0) pixels[i] = -1;
    return finish(pixels, cols, rows, emptyColors.length ? emptyColors[0] : null);
  };
  const finish = (pixels, cols, rows, empty) => {
    const counts = new Map();
    pixels.forEach((c) => c >= 0 && counts.set(c, (counts.get(c) || 0) + 1));
    const palette = Array.from(counts.keys()).sort((a, b) => counts.get(b) - counts.get(a)).map((color) => ({ color, count: counts.get(color) }));
    return { cols, rows, pixels, palette, empty };
  };

  /* ---------- Batch Y: symbol charts (symbols on a plain background, no colours) ---------- */

  const GLYPH = 10; // glyph fingerprints are GLYPH × GLYPH ink maps
  const SYMBOL_COLORS = [0xe4572e, 0x2e86ab, 0x4caf50, 0xf2b705, 0x8e44ad, 0x17bebb, 0xd81b60, 0x6d4c41, 0x7cb342, 0x3949ab, 0xff8f00, 0x00897b, 0xc0ca33, 0x5e35b1, 0xf06292, 0x455a64, 0x26c6da, 0x9ccc65, 0xab47bc, 0xffa726, 0x8d6e63, 0x42a5f5, 0xec407a, 0x78909c];

  /** How much each point of a cell's inner area differs from the background colour, as a GLYPH×GLYPH map (0..1). */
  const inkMap = (src, x0, y0, x1, y1, bg, inset) => {
    const { data, width, height } = src;
    const w = x1 - x0, h = y1 - y0;
    const ax = x0 + w * inset, bx = x1 - w * inset, ay = y0 + h * inset, by = y1 - h * inset;
    const sum = new Float64Array(GLYPH * GLYPH), cnt = new Float64Array(GLYPH * GLYPH);
    const br = (bg >> 16) & 255, bgc = (bg >> 8) & 255, bb = bg & 255;
    for (let y = Math.max(0, Math.floor(ay)); y < Math.min(height, Math.ceil(by)); y++) {
      const gy = Math.min(GLYPH - 1, Math.max(0, Math.floor(((y + 0.5 - ay) / (by - ay)) * GLYPH)));
      for (let x = Math.max(0, Math.floor(ax)); x < Math.min(width, Math.ceil(bx)); x++) {
        const gx = Math.min(GLYPH - 1, Math.max(0, Math.floor(((x + 0.5 - ax) / (bx - ax)) * GLYPH)));
        const i = (y * width + x) * 4;
        const d = (Math.abs(data[i] - br) + Math.abs(data[i + 1] - bgc) + Math.abs(data[i + 2] - bb)) / 765;
        sum[gy * GLYPH + gx] += d;
        cnt[gy * GLYPH + gx]++;
      }
    }
    const m = new Float64Array(GLYPH * GLYPH);
    for (let k = 0; k < m.length; k++) m[k] = cnt[k] ? sum[k] / cnt[k] : 0;
    return m;
  };

  /**
   * Read a chart whose cells are symbols on a plain background (e.g. black-and-white cross-stitch charts).
   * Cells with the same symbol shape are grouped; every group gets its own colour; blank cells are empty.
   * opts: threshold (how different two symbols must look to be different, default 0.05), inset (default 0.18).
   * Returns the same shape as readCells plus { mode: 'symbols', symbols: number of different symbols }.
   */
  C.readSymbols = (src, grid, opts) => {
    opts = opts || {};
    const thr = opts.threshold !== undefined ? opts.threshold : 0.05;
    const inset = opts.inset !== undefined ? opts.inset : 0.18;
    const cols = grid.cols, rows = grid.rows;
    // background = the colour most cells have
    const base = C.readCells(src, grid, { empty: 'none', inset });
    const bg = base.palette.length ? base.palette[0].color : 0xffffff;
    const maps = new Array(cols * rows);
    const ink = new Float64Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x0 = grid.x + i * grid.cellW, y0 = grid.y + j * grid.cellH;
      const m = inkMap(src, x0, y0, x0 + grid.cellW, y0 + grid.cellH, bg, inset);
      let t = 0;
      for (let k = 0; k < m.length; k++) t += m[k];
      maps[j * cols + i] = m;
      ink[j * cols + i] = t / m.length;
    }
    // blank cells have (almost) no ink; the rest are grouped by shape (greedy, running mean)
    const groups = [];
    const label = new Int32Array(cols * rows).fill(-1);
    for (let n = 0; n < maps.length; n++) {
      if (ink[n] < (opts.blank !== undefined ? opts.blank : 0.03)) continue;
      let best = -1, bd = Infinity;
      for (let g = 0; g < groups.length; g++) {
        let d = 0;
        const c = groups[g].mean;
        for (let k = 0; k < c.length; k++) d += Math.abs(c[k] - maps[n][k]);
        d /= c.length;
        if (d < bd) { bd = d; best = g; }
      }
      if (best >= 0 && bd <= thr) {
        const g = groups[best];
        g.n++;
        for (let k = 0; k < g.mean.length; k++) g.mean[k] += (maps[n][k] - g.mean[k]) / g.n;
        label[n] = best;
      } else {
        groups.push({ mean: Float64Array.from(maps[n]), n: 1 });
        label[n] = groups.length - 1;
      }
    }
    // biggest group first gets the first colour
    const order = groups.map((g, i) => i).sort((a, b) => groups[b].n - groups[a].n || a - b);
    const color = new Map();
    order.forEach((g, rank) => color.set(g, SYMBOL_COLORS[rank % SYMBOL_COLORS.length]));
    const pixels = new Int32Array(cols * rows);
    for (let n = 0; n < pixels.length; n++) pixels[n] = label[n] < 0 ? -1 : color.get(label[n]);
    const r = finish(pixels, cols, rows, null);
    r.mode = 'symbols';
    r.symbols = groups.length;
    return r;
  };

  /**
   * Read a chart as colours or as symbols. opts.mode: 'auto' (default) | 'colors' | 'symbols'; other opts go to the readers.
   * Auto switches to symbols when the cells are (nearly) all one colour but many of them carry marks.
   */
  C.read = (src, grid, opts) => {
    opts = opts || {};
    const mode = opts.mode || 'auto';
    if (mode === 'symbols') return C.readSymbols(src, grid, opts);
    if (mode === 'colors') { const r = C.readCells(src, grid, opts); r.mode = 'colors'; return r; }
    const probe = C.readCells(src, grid, { empty: 'none', inset: 0.18 });
    if (probe.palette.length <= 2) {
      const s = C.readSymbols(src, grid, opts);
      const marked = s.pixels.reduce((n, v) => n + (v >= 0 ? 1 : 0), 0);
      if (marked >= 0.1 * s.pixels.length && s.symbols >= 2) return s;
    }
    const r = C.readCells(src, grid, opts);
    r.mode = 'colors';
    return r;
  };

  M.Chart = C;
})(typeof window !== 'undefined' ? window : globalThis);
