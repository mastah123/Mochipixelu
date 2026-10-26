/* Mochipixelu — shared helpers (colors, math, events). No DOM access here. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const U = {};

  U.VERSION = '1.10.0';

  /** Marker for "no color / no stitch" in a pixel grid. */
  U.EMPTY = -1;
  U.MAX_SIZE = 256;

  U.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /** 0xRRGGBB -> "#rrggbb" */
  U.toHex = (n) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');

  /** "#rgb" | "#rrggbb" (hash optional) -> 0xRRGGBB, or null when invalid. */
  U.fromHex = (s) => {
    if (typeof s !== 'string') return null;
    const t = s.trim();
    let m = /^#?([0-9a-f]{6})$/i.exec(t);
    if (m) return parseInt(m[1], 16);
    m = /^#?([0-9a-f]{3})$/i.exec(t);
    if (m) {
      const h = m[1];
      return parseInt(h[0] + h[0] + h[1] + h[1] + h[2] + h[2], 16);
    }
    return null;
  };

  U.rgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  U.pack = (r, g, b) => ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);

  U.dist2 = (a, b) => {
    const dr = ((a >> 16) & 255) - ((b >> 16) & 255);
    const dg = ((a >> 8) & 255) - ((b >> 8) & 255);
    const db = (a & 255) - (b & 255);
    // Weighted so greens count more, closer to perceived difference.
    return dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
  };

  U.luma = (n) => {
    const [r, g, b] = U.rgb(n);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };

  /** Readable text color (black/white) for a given background color. */
  U.textOn = (n) => (U.luma(n) > 150 ? '#2b2019' : '#ffffff');

  U.debounce = (fn, ms) => {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  U.safeFilename = (name, fallback) => {
    const cleaned = String(name || '')
      .replace(/[^a-z0-9 _.-]+/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60);
    return cleaned || fallback || 'mochipixelu';
  };

  U.escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Tiny event emitter. */
  U.emitter = () => {
    const map = {};
    return {
      on(evt, fn) {
        (map[evt] = map[evt] || []).push(fn);
      },
      emit(evt, arg) {
        (map[evt] || []).slice().forEach((fn) => fn(arg));
      },
    };
  };

  M.Utils = U;
})(typeof window !== 'undefined' ? window : globalThis);
