/* Mochipixelu — pattern rendering (grid, symbols, coordinates, legend), PNG export and print pages. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const U = M.Utils;
  const EMPTY = U.EMPTY;
  const X = {};

  const INK = '#2b2019';
  const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
  const MAX_SIDE = 4096; // keeps exported canvases within browser limits

  X.DEFAULT_OPTS = {
    cell: 24,
    symbols: true, // draw a symbol per color (works in black & white too)
    colors: true, // fill cells with their color
    coords: true, // numbered rows/columns around the grid
    grid: true,
    major: 10, // heavier line every N cells
    title: true,
  };

  const makeCanvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };

  /** Cell size that keeps the pattern under the canvas limits. */
  X.safeCell = (design, wanted) => {
    const cap = Math.floor((MAX_SIDE - 100) / Math.max(design.width, design.height));
    return U.clamp(Math.min(Math.round(wanted), cap), 4, 64);
  };

  /**
   * Render a (region of a) design as a craft pattern.
   * region = {x0,y0,x1,y1} (x1/y1 exclusive); coordinates shown are 1-based and absolute.
   */
  X.renderPattern = (design, options, region) => {
    const o = Object.assign({}, X.DEFAULT_OPTS, options);
    const legend = o.legend || M.Palette.legend(design);
    const r = region || { x0: 0, y0: 0, x1: design.width, y1: design.height };
    const cols = r.x1 - r.x0;
    const rows = r.y1 - r.y0;
    const cell = X.safeCell(design, o.cell);
    const label = o.coords ? Math.round(cell * 1.15) + 4 : 0;
    const pad = 4;
    const canvas = makeCanvas(cols * cell + label * 2 + pad * 2, rows * cell + label * 2 + pad * 2);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const ox = pad + label;
    const oy = pad + label;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(cell * 0.58) + 'px ' + FONT;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const gx = r.x0 + x;
        const gy = r.y0 + y;
        const i = gy * design.width + gx;
        const v = design.pixels[i];
        const px = ox + x * cell;
        const py = oy + y * cell;
        if (v === EMPTY) continue;
        if (o.colors) {
          ctx.fillStyle = U.toHex(v);
          ctx.fillRect(px, py, cell, cell);
        }
        if (o.symbols) {
          const e = legend.byColor.get(v);
          ctx.fillStyle = o.colors ? U.textOn(v) : INK;
          if (e) ctx.fillText(e.symbol, px + cell / 2, py + cell / 2 + 1);
        }
        if (o.marks && design.done[i]) {
          ctx.strokeStyle = '#2f7a4a';
          ctx.lineWidth = Math.max(2, cell / 7);
          ctx.beginPath();
          ctx.moveTo(px + cell * 0.2, py + cell * 0.55);
          ctx.lineTo(px + cell * 0.42, py + cell * 0.78);
          ctx.lineTo(px + cell * 0.82, py + cell * 0.25);
          ctx.stroke();
        }
      }
    }

    if (o.grid) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(70,55,45,.45)';
      ctx.beginPath();
      for (let x = 0; x <= cols; x++) {
        ctx.moveTo(ox + x * cell + 0.5, oy);
        ctx.lineTo(ox + x * cell + 0.5, oy + rows * cell);
      }
      for (let y = 0; y <= rows; y++) {
        ctx.moveTo(ox, oy + y * cell + 0.5);
        ctx.lineTo(ox + cols * cell, oy + y * cell + 0.5);
      }
      ctx.stroke();
      if (o.major > 0) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.beginPath();
        for (let x = 0; x <= cols; x++) {
          const g = r.x0 + x;
          if (g % o.major === 0 || x === 0 || x === cols) {
            ctx.moveTo(ox + x * cell + 0.5, oy);
            ctx.lineTo(ox + x * cell + 0.5, oy + rows * cell);
          }
        }
        for (let y = 0; y <= rows; y++) {
          const g = r.y0 + y;
          if (g % o.major === 0 || y === 0 || y === rows) {
            ctx.moveTo(ox, oy + y * cell + 0.5);
            ctx.lineTo(ox + cols * cell, oy + y * cell + 0.5);
          }
        }
        ctx.stroke();
      }
    }

    if (o.coords) {
      const every = cell >= 20 ? 1 : cell >= 12 ? 2 : 5;
      ctx.fillStyle = INK;
      ctx.font = Math.round(Math.min(cell * 0.5, label * 0.55)) + 'px ' + FONT;
      for (let x = 0; x < cols; x++) {
        const n = r.x0 + x + 1;
        if (n % every !== 0 && n !== 1 && x !== cols - 1) continue;
        const cx = ox + x * cell + cell / 2;
        ctx.fillText(String(n), cx, pad + label / 2);
        ctx.fillText(String(n), cx, oy + rows * cell + label / 2);
      }
      for (let y = 0; y < rows; y++) {
        const n = r.y0 + y + 1;
        if (n % every !== 0 && n !== 1 && y !== rows - 1) continue;
        const cy = oy + y * cell + cell / 2;
        ctx.fillText(String(n), pad + label / 2, cy);
        ctx.fillText(String(n), ox + cols * cell + label / 2, cy);
      }
    }
    return canvas;
  };

  /** Legend table: swatch + symbol, number, hex, stitch count. */
  X.renderLegend = (design, options, width) => {
    const o = Object.assign({}, X.DEFAULT_OPTS, options);
    const legend = o.legend || M.Palette.legend(design);
    const rowH = 34;
    const colW = 250;
    const cols = Math.max(1, Math.floor((width - 16) / colW));
    const rows = Math.max(1, Math.ceil(legend.entries.length / cols));
    const headH = 40;
    const canvas = makeCanvas(width, headH + rows * rowH + 12);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = INK;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillText('Color legend — ' + legend.entries.length + ' color' + (legend.entries.length === 1 ? '' : 's') + ', ' + legend.filled + ' stitches', 8, headH / 2);
    legend.entries.forEach((e, i) => {
      const cx = 8 + (i % cols) * colW;
      const cy = headH + Math.floor(i / cols) * rowH;
      ctx.fillStyle = U.toHex(e.color);
      ctx.fillRect(cx, cy + 3, 28, 28);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx + 0.5, cy + 3.5, 27, 27);
      ctx.textAlign = 'center';
      ctx.font = 'bold 17px ' + FONT;
      ctx.fillStyle = U.textOn(e.color);
      ctx.fillText(e.symbol, cx + 14, cy + 18);
      ctx.textAlign = 'left';
      ctx.fillStyle = INK;
      ctx.font = '15px ' + FONT;
      ctx.fillText('#' + e.index + '  ' + e.hex + '  ×' + e.count, cx + 38, cy + 18);
    });
    return canvas;
  };

  const headerCanvas = (design, width, legend) => {
    const c = makeCanvas(width, 56);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = INK;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 26px ' + FONT;
    ctx.fillText(design.name || 'Untitled', 8, 20);
    ctx.font = '15px ' + FONT;
    ctx.fillText(design.width + ' × ' + design.height + ' cells · ' + legend.filled + ' stitches · made with Mochipixelu', 8, 43);
    return c;
  };

  /** Whole pattern (title + grid + legend) on one canvas. */
  X.renderFullPattern = (design, options) => {
    const o = Object.assign({}, X.DEFAULT_OPTS, options);
    o.legend = M.Palette.legend(design);
    const grid = X.renderPattern(design, o);
    const width = Math.max(grid.width, 520);
    const head = o.title ? headerCanvas(design, width, o.legend) : null;
    const legend = X.renderLegend(design, o, width);
    const out = makeCanvas(width, (head ? head.height : 0) + grid.height + legend.height + 8);
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    let y = 0;
    if (head) {
      ctx.drawImage(head, 0, 0);
      y += head.height;
    }
    ctx.drawImage(grid, Math.round((width - grid.width) / 2), y);
    y += grid.height;
    ctx.drawImage(legend, 0, y);
    return out;
  };

  /** Plain image of the artwork. scale = pixels per cell; transparent keeps empty cells see-through. */
  X.renderArt = (design, scale, transparent) => {
    scale = U.clamp(Math.round(scale), 1, Math.max(1, Math.floor(MAX_SIDE / Math.max(design.width, design.height))));
    const c = makeCanvas(design.width * scale, design.height * scale);
    const ctx = c.getContext('2d');
    if (!transparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
    }
    for (let y = 0; y < design.height; y++) {
      for (let x = 0; x < design.width; x++) {
        const v = design.pixels[y * design.width + x];
        if (v === EMPTY) continue;
        ctx.fillStyle = U.toHex(v);
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return c;
  };

  /** Split a design into printable sections. Small designs give a single region. */
  X.sections = (design, maxCols, maxRows) => {
    const out = [];
    for (let y = 0; y < design.height; y += maxRows) {
      for (let x = 0; x < design.width; x += maxCols) {
        out.push({ x0: x, y0: y, x1: Math.min(design.width, x + maxCols), y1: Math.min(design.height, y + maxRows) });
      }
    }
    return out;
  };

  /**
   * Printable pages: [{title, canvas}]. A design up to 60×80 is one page (grid + legend).
   * Bigger designs get an overview page followed by numbered detail sections.
   */
  X.buildPages = (design, options) => {
    const o = Object.assign({}, X.DEFAULT_OPTS, options);
    const legend = M.Palette.legend(design);
    o.legend = legend;
    const MAXC = 40;
    const MAXR = 50;
    if (design.width <= 60 && design.height <= 80) {
      return [{ title: design.name, canvas: X.renderFullPattern(design, o) }];
    }
    const pages = [];
    const overview = Object.assign({}, o, { cell: Math.min(o.cell, 10), symbols: false, coords: true });
    const grid = X.renderPattern(design, overview);
    const width = Math.max(grid.width, 520);
    const head = headerCanvas(design, width, legend);
    const leg = X.renderLegend(design, o, width);
    const page1 = makeCanvas(width, head.height + grid.height + leg.height + 8);
    const c1 = page1.getContext('2d');
    c1.fillStyle = '#ffffff';
    c1.fillRect(0, 0, page1.width, page1.height);
    c1.drawImage(head, 0, 0);
    c1.drawImage(grid, Math.round((width - grid.width) / 2), head.height);
    c1.drawImage(leg, 0, head.height + grid.height);
    pages.push({ title: design.name + ' — overview', canvas: page1 });
    const secs = X.sections(design, MAXC, MAXR);
    secs.forEach((r, n) => {
      const body = X.renderPattern(design, o, r);
      const h = makeCanvas(Math.max(body.width, 520), 34);
      const hc = h.getContext('2d');
      hc.fillStyle = '#fff';
      hc.fillRect(0, 0, h.width, h.height);
      hc.fillStyle = INK;
      hc.font = 'bold 18px ' + FONT;
      hc.textBaseline = 'middle';
      hc.fillText(
        design.name + ' — section ' + (n + 1) + '/' + secs.length + ' (columns ' + (r.x0 + 1) + '–' + r.x1 + ', rows ' + (r.y0 + 1) + '–' + r.y1 + ')',
        8,
        17
      );
      const page = makeCanvas(h.width, h.height + body.height);
      const pc = page.getContext('2d');
      pc.fillStyle = '#fff';
      pc.fillRect(0, 0, page.width, page.height);
      pc.drawImage(h, 0, 0);
      pc.drawImage(body, Math.round((h.width - body.width) / 2), h.height);
      pages.push({ title: 'Section ' + (n + 1), canvas: page });
    });
    return pages;
  };

  /** Trigger a browser download of a canvas as PNG. */
  X.downloadCanvas = (canvas, filename) =>
    new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('The browser could not create the image (it may be too large).'));
        X.downloadBlob(blob, filename);
        resolve();
      }, 'image/png');
    });

  X.downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  M.Exporter = X;
})(typeof window !== 'undefined' ? window : globalThis);
