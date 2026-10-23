/* Mochipixelu — read an image file into RGBA source data (browser-native decoding). */
(function (root) {
  'use strict';
  const M = (root.Mochi = root.Mochi || {});

  M.Images = {
    /** Resolves to { data, width, height, name } with the longest side capped for speed. */
    readFile(file) {
      return new Promise((resolve, reject) => {
        if (!file || !/^image\//.test(file.type)) return reject(new Error('Please choose an image file (PNG, JPG, GIF, WebP…).'));
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          const nw = img.naturalWidth || img.width;
          const nh = img.naturalHeight || img.height;
          if (!nw || !nh) return reject(new Error('That image has no size.'));
          const k = Math.min(1, M.Pixelate.SOURCE_MAX / Math.max(nw, nh));
          const sw = Math.max(1, Math.round(nw * k));
          const sh = Math.max(1, Math.round(nh * k));
          const c = document.createElement('canvas');
          c.width = sw;
          c.height = sh;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, sw, sh);
          resolve({ data: ctx.getImageData(0, 0, sw, sh).data, width: sw, height: sh, name: file.name });
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('That file could not be read as an image.'));
        };
        img.src = url;
      });
    },

    baseName(file) {
      return (file.name || '').replace(/\.[^.]+$/, '').slice(0, 60) || 'Imported image';
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
