/* Mochipixelu — shared canvas viewport: zoom, auto-fit, pinch, two-finger pan, drag-to-pan.
 * Used by the editor and by the project view so both feel the same on touch screens. */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});
  const U = M.Utils;

  M.Viewport = {
    /**
     * opts: { canvas, scroller, renderer, onZoom(), onGestureStart() }
     * The owner forwards pointer events: down(e) / move(e) return true when the viewport
     * consumed the event (second finger, active pinch or pan drag).
     */
    create(opts) {
      const { canvas, scroller, renderer } = opts;
      const vp = {
        autoFit: true, // keep the whole design in view until the user zooms by hand
        touches: new Map(),
        gesture: null,
        panDrag: null,
      };
      const notify = () => opts.onZoom && opts.onZoom();

      const capture = (e) => {
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch (err) {
          /* the pointer may already be gone — never fatal */
        }
      };
      vp.capture = capture;

      vp.setZoom = (cell) => {
        vp.autoFit = false;
        scroller.classList.add('roomy');
        // keep the view centred on the same spot while zooming
        const before = renderer.cell;
        const cx = (scroller.scrollLeft + scroller.clientWidth / 2) / before;
        const cy = (scroller.scrollTop + scroller.clientHeight / 2) / before;
        renderer.setCell(cell);
        const after = renderer.cell;
        scroller.scrollLeft = cx * after - scroller.clientWidth / 2;
        scroller.scrollTop = cy * after - scroller.clientHeight / 2;
        notify();
      };

      vp.fit = () => {
        vp.autoFit = true;
        scroller.classList.remove('roomy');
        if (!renderer.design) return;
        const w = Math.max(60, scroller.clientWidth - 36);
        const h = Math.max(60, scroller.clientHeight - 36);
        renderer.setCell(renderer.fitCell(w, h));
        notify();
      };

      vp.zoomBy = (dir) => vp.setZoom(renderer.cell + dir * Math.max(1, Math.round(renderer.cell / 6)));

      // when the stage changes size (panel opens, phone rotates) keep an auto-fitted design fitted
      if (typeof ResizeObserver !== 'undefined') {
        let raf = 0;
        new ResizeObserver(() => {
          if (!vp.autoFit || !renderer.design || !scroller.clientWidth) return;
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            if (vp.autoFit) vp.fit();
          });
        }).observe(scroller);
      }

      scroller.addEventListener(
        'wheel',
        (e) => {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          vp.setZoom(renderer.cell + (e.deltaY < 0 ? 1 : -1) * Math.max(1, Math.round(renderer.cell / 8)));
        },
        { passive: false }
      );

      /* ---------- two fingers: pinch-zoom + pan ---------- */
      const twoTouch = () => {
        const pts = Array.from(vp.touches.values());
        const a = pts[0];
        const b = pts[1];
        return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
      };
      const startGesture = () => {
        const { mid, dist } = twoTouch();
        const r = canvas.getBoundingClientRect();
        vp.gesture = { dist, cell: renderer.cell, ax: (mid.x - r.left) / renderer.cell, ay: (mid.y - r.top) / renderer.cell };
      };
      const updateGesture = () => {
        const { mid, dist } = twoTouch();
        const next = Math.round((vp.gesture.cell * dist) / vp.gesture.dist);
        if (next !== renderer.cell && renderer.setCell(next)) {
          vp.autoFit = false;
          scroller.classList.add('roomy');
          notify();
        }
        // keep the content point that started under the fingers under the fingers
        const r = canvas.getBoundingClientRect();
        scroller.scrollLeft += r.left + vp.gesture.ax * renderer.cell - mid.x;
        scroller.scrollTop += r.top + vp.gesture.ay * renderer.cell - mid.y;
      };

      vp.down = (e) => {
        if (e.pointerType !== 'touch') return false;
        vp.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (vp.touches.size === 2) {
          e.preventDefault();
          if (opts.onGestureStart) opts.onGestureStart();
          vp.panDrag = null;
          startGesture();
          return true;
        }
        return vp.touches.size > 2;
      };

      vp.move = (e) => {
        if (e.pointerType === 'touch' && vp.touches.has(e.pointerId)) vp.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (vp.gesture && vp.touches.size >= 2) {
          updateGesture();
          return true;
        }
        if (vp.panDrag && e.pointerId === vp.panDrag.id) {
          scroller.scrollLeft = vp.panDrag.sl - (e.clientX - vp.panDrag.x);
          scroller.scrollTop = vp.panDrag.st - (e.clientY - vp.panDrag.y);
          return true;
        }
        return false;
      };

      vp.up = (e) => {
        if (e.pointerType === 'touch') {
          vp.touches.delete(e.pointerId);
          if (vp.touches.size < 2) vp.gesture = null;
        }
        if (vp.panDrag && e.pointerId === vp.panDrag.id) vp.panDrag = null;
      };

      /** One-finger / mouse drag that scrolls the view. */
      vp.startPan = (e) => {
        capture(e);
        vp.panDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, sl: scroller.scrollLeft, st: scroller.scrollTop };
      };

      return vp;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
