/* Mochipixelu — canvas renderer for the live editor grid. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const U = M.Utils;
  const EMPTY = U.EMPTY;

  const MAX_CANVAS_SIDE = 4096;
  const MAJOR = 10; // heavier grid line every N cells

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.design = null;
      this.cell = 16;
      this.grid = true;
      this.showDone = true;
      this.filter = null; // color int to spotlight, or null
      this.selected = null; // {x,y}
      this.hover = null; // {x,y}
      this.guide = null; // {row, col} (either may be null) — highlights a stitching row / column
    }

    maxCell(design) {
      const d = design || this.design;
      return Math.max(2, Math.min(64, Math.floor(MAX_CANVAS_SIDE / Math.max(d.width, d.height))));
    }

    /** Attach a design and (re)size the canvas to it. */
    setDesign(design) {
      this.design = design;
      this.selected = this.selected && M.Design.inBounds(design, this.selected.x, this.selected.y) ? this.selected : null;
      this.hover = null;
      this.setCell(this.cell, true);
    }

    setCell(cell, force) {
      const c = U.clamp(Math.round(cell), 2, this.maxCell());
      if (c === this.cell && !force) return false;
      this.cell = c;
      this.canvas.width = this.design.width * c;
      this.canvas.height = this.design.height * c;
      this.canvas.style.width = this.canvas.width + 'px';
      this.canvas.style.height = this.canvas.height + 'px';
      this.draw();
      return true;
    }

    /** Largest cell size that fits the design inside w×h CSS pixels. */
    fitCell(w, h) {
      const d = this.design;
      return U.clamp(Math.floor(Math.min(w / d.width, h / d.height)), 2, this.maxCell());
    }

    cellFromPoint(clientX, clientY) {
      const r = this.canvas.getBoundingClientRect();
      const x = Math.floor(((clientX - r.left) * (this.canvas.width / r.width)) / this.cell);
      const y = Math.floor(((clientY - r.top) * (this.canvas.height / r.height)) / this.cell);
      return M.Design.inBounds(this.design, x, y) ? { x, y } : null;
    }

    draw() {
      const d = this.design;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) this.drawCell(x, y);
      this.drawFrame();
    }

    /** Closing grid lines on the right/bottom edge. */
    drawFrame() {
      if (!this.grid || this.cell < 4) return;
      const ctx = this.ctx;
      ctx.fillStyle = 'rgba(29,26,43,.55)';
      ctx.fillRect(this.canvas.width - 1, 0, 1, this.canvas.height);
      ctx.fillRect(0, this.canvas.height - 1, this.canvas.width, 1);
    }

    drawCell(x, y) {
      const d = this.design;
      const c = this.cell;
      const ctx = this.ctx;
      const px = x * c;
      const py = y * c;
      const i = y * d.width + x;
      const v = d.pixels[i];

      if (v === EMPTY) ctx.fillStyle = (x + y) & 1 ? '#e6e3ee' : '#f8f7fc';
      else ctx.fillStyle = U.toHex(v);
      ctx.fillRect(px, py, c, c);

      if (this.filter !== null && v !== this.filter) {
        ctx.fillStyle = 'rgba(244,242,250,.86)';
        ctx.fillRect(px, py, c, c);
      }

      if (this.showDone && v !== EMPTY && d.done[i]) {
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.fillRect(px, py, c, c);
        if (c >= 8) {
          ctx.strokeStyle = '#2f8a64';
          ctx.lineWidth = Math.max(1.5, c / 8);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(px + c * 0.25, py + c * 0.55);
          ctx.lineTo(px + c * 0.44, py + c * 0.74);
          ctx.lineTo(px + c * 0.76, py + c * 0.3);
          ctx.stroke();
        }
      }

      const g = this.guide;
      if (g) {
        const inRow = g.row !== null && g.row === y;
        const inCol = g.col !== null && g.col === x;
        if (inRow || inCol) {
          ctx.fillStyle = 'rgba(122,92,214,.22)';
          ctx.fillRect(px, py, c, c);
          const t = Math.max(2, Math.round(c / 8));
          ctx.fillStyle = '#6b4fc4';
          if (inRow) {
            ctx.fillRect(px, py, c, t);
            ctx.fillRect(px, py + c - t, c, t);
          }
          if (inCol) {
            ctx.fillRect(px, py, t, c);
            ctx.fillRect(px + c - t, py, t, c);
          }
        }
      }

      if (this.grid && c >= 4) {
        ctx.fillStyle = x % MAJOR === 0 ? 'rgba(29,26,43,.55)' : 'rgba(29,26,43,.18)';
        ctx.fillRect(px, py, 1, c);
        ctx.fillStyle = y % MAJOR === 0 ? 'rgba(29,26,43,.55)' : 'rgba(29,26,43,.18)';
        ctx.fillRect(px, py, c, 1);
        if (x === d.width - 1 || y === d.height - 1) this.drawFrame();
      }

      const sel = this.selected;
      const hov = this.hover;
      if (sel && sel.x === x && sel.y === y) this.outline(px, py, '#1d1a2b', '#ffffff', 2);
      else if (hov && hov.x === x && hov.y === y) this.outline(px, py, 'rgba(43,32,25,.7)', 'rgba(255,255,255,.7)', 1);
    }

    outline(px, py, dark, light, w) {
      const c = this.cell;
      const ctx = this.ctx;
      const t = Math.min(w, Math.max(1, Math.floor(c / 6)));
      ctx.lineWidth = t;
      ctx.strokeStyle = light;
      ctx.strokeRect(px + t * 1.5, py + t * 1.5, c - t * 3, c - t * 3);
      ctx.strokeStyle = dark;
      ctx.strokeRect(px + t / 2, py + t / 2, c - t, c - t);
    }

    /** Show a stitching guide: a row and/or a column (null = off). Redraws only the affected lines. */
    setGuide(g) {
      const d = this.design;
      const old = this.guide;
      this.guide = g && (g.row !== null || g.col !== null) ? { row: g.row, col: g.col } : null;
      const redraw = (gd) => {
        if (!gd) return;
        if (gd.row !== null && gd.row >= 0 && gd.row < d.height) for (let x = 0; x < d.width; x++) this.drawCell(x, gd.row);
        if (gd.col !== null && gd.col >= 0 && gd.col < d.width) for (let y = 0; y < d.height; y++) this.drawCell(gd.col, y);
      };
      redraw(old);
      redraw(this.guide);
    }

    setSelected(cellOrNull) {
      const old = this.selected;
      this.selected = cellOrNull;
      if (old) this.drawCell(old.x, old.y);
      if (cellOrNull) this.drawCell(cellOrNull.x, cellOrNull.y);
    }

    setHover(cellOrNull) {
      const old = this.hover;
      if (old === cellOrNull || (old && cellOrNull && old.x === cellOrNull.x && old.y === cellOrNull.y)) return;
      this.hover = cellOrNull;
      if (old) this.drawCell(old.x, old.y);
      if (cellOrNull) this.drawCell(cellOrNull.x, cellOrNull.y);
    }
  }

  M.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
