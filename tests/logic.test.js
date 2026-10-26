/* Mochipixelu logic tests. Run in Node:  node tests/logic.test.js
 * or in a browser by opening tests/index.html. No dependencies. */
(function () {
  'use strict';
  const isNode = typeof require !== 'undefined' && typeof module !== 'undefined';
  if (isNode) {
    const path = require('path');
    ['utils', 'state', 'palette', 'pixelate', 'storage'].forEach((f) => require(path.join(__dirname, '..', 'js', f + '.js')));
  }
  const root = isNode ? globalThis : window;
  const M = root.Mochi;
  const { Utils: U, Design: D, Palette: Q, Pixelate: P, Storage: S } = M;

  const results = [];
  const test = (name, fn) => {
    try {
      fn();
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, error: e && e.message ? e.message : String(e) });
    }
  };
  const eq = (a, b, msg) => {
    if (a !== b) throw new Error((msg || 'expected equal') + ': got ' + a + ', expected ' + b);
  };
  const ok = (c, msg) => {
    if (!c) throw new Error(msg || 'assertion failed');
  };
  const throws = (fn, re) => {
    try {
      fn();
    } catch (e) {
      if (re && !re.test(e.message)) throw new Error('wrong error: ' + e.message);
      return;
    }
    throw new Error('expected an error');
  };

  const rgba = (w, h, fn) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const [r, g, b, a] = fn(x, y);
        const i = (y * w + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a === undefined ? 255 : a;
      }
    return { data, width: w, height: h };
  };

  /* ----- utils ----- */
  test('hex conversion round-trips', () => {
    eq(U.toHex(0xe8737f), '#e8737f');
    eq(U.toHex(0), '#000000');
    eq(U.fromHex('#E8737F'), 0xe8737f);
    eq(U.fromHex('abc'), 0xaabbcc);
    eq(U.fromHex('#12'), null);
    eq(U.fromHex('zzzzzz'), null);
  });
  test('safeFilename strips unsafe characters', () => {
    eq(U.safeFilename('My/Cute: Cat?!'), 'MyCute-Cat');
    eq(U.safeFilename('???', 'x'), 'x');
  });

  /* ----- design ops ----- */
  test('create clamps size and starts empty', () => {
    const d = D.create(999, 0, undefined, 'a');
    eq(d.width, 256); eq(d.height, 1);
    ok(d.pixels.every((v) => v === U.EMPTY));
  });
  test('resample changes real cell count (nearest)', () => {
    const d = D.create(2, 2);
    d.pixels.set([1, 2, 3, 4]);
    const up = D.resample(d, 4, 4);
    eq(up.width, 4); eq(up.pixels.length, 16);
    eq(up.pixels[0], 1); eq(up.pixels[3], 2); eq(up.pixels[12], 3); eq(up.pixels[15], 4);
    const down = D.resample(up, 2, 2);
    eq(Array.from(down.pixels).join(), '1,2,3,4');
  });
  test('resizeCanvas crops and pads with anchors', () => {
    const d = D.create(3, 3, 7);
    const pad = D.resizeCanvas(d, 5, 5, 0.5, 0.5);
    eq(pad.pixels[0], U.EMPTY); eq(pad.pixels[2 * 5 + 2], 7); eq(pad.pixels[1 * 5 + 1], 7); eq(pad.pixels[0 * 5 + 1], U.EMPTY);
    const crop = D.resizeCanvas(pad, 3, 3, 0.5, 0.5);
    ok(crop.pixels.every((v) => v === 7));
  });
  test('floodFill fills a connected region only', () => {
    const d = D.create(4, 1);
    d.pixels.set([5, 5, 9, 5]);
    eq(D.floodFill(d, 0, 0, 1), 2);
    eq(Array.from(d.pixels).join(), '1,1,9,5');
    eq(D.floodFill(d, 0, 0, 1), 0, 'same color is a no-op');
  });
  test('floodFill handles a full empty canvas', () => {
    const d = D.create(10, 10);
    eq(D.floodFill(d, 5, 5, 3), 100);
  });
  test('replaceColor swaps every match', () => {
    const d = D.create(3, 1);
    d.pixels.set([1, 2, 1]);
    eq(D.replaceColor(d, 1, 8), 2);
    eq(Array.from(d.pixels).join(), '8,2,8');
  });
  test('line (Bresenham) hits both endpoints with no gaps', () => {
    const pts = [];
    D.line(0, 0, 5, 2, (x, y) => pts.push([x, y]));
    eq(pts[0].join(), '0,0'); eq(pts[pts.length - 1].join(), '5,2');
    for (let i = 1; i < pts.length; i++) ok(Math.abs(pts[i][0] - pts[i - 1][0]) <= 1 && Math.abs(pts[i][1] - pts[i - 1][1]) <= 1, 'gap');
    const single = [];
    D.line(2, 2, 2, 2, (x, y) => single.push([x, y]));
    eq(single.length, 1);
  });
  test('stats counts only filled stitches', () => {
    const d = D.create(2, 2);
    d.pixels.set([1, U.EMPTY, 2, 3]);
    d.done.set([1, 1, 0, 1]);
    const s = D.stats(d);
    eq(s.filled, 3); eq(s.done, 2);
  });

  /* ----- history store ----- */
  test('store undo/redo restores pixels and size', () => {
    const s = M.createStore();
    s.load(D.create(2, 2, 1), { resetHistory: true });
    s.checkpoint();
    s.design.pixels[0] = 9;
    s.touch();
    s.checkpoint();
    s.load(D.resample(s.design, 4, 4), {});
    eq(s.design.width, 4);
    ok(s.undo()); eq(s.design.width, 2); eq(s.design.pixels[0], 9);
    ok(s.undo()); eq(s.design.pixels[0], 1);
    ok(!s.undo(), 'nothing left to undo');
    ok(s.redo()); eq(s.design.pixels[0], 9);
    ok(s.redo()); eq(s.design.width, 4);
  });
  test('a new edit clears the redo stack; dropCheckpoint removes no-op strokes', () => {
    const s = M.createStore();
    s.load(D.create(2, 2), { resetHistory: true });
    s.checkpoint(); s.design.pixels[0] = 1; s.touch(); s.undo();
    ok(s.canRedo());
    s.checkpoint(); s.dropCheckpoint();
    s.checkpoint(); s.design.pixels[1] = 2; s.touch();
    ok(!s.canRedo()); eq(s.undoStack.length, 1);
  });
  test('progress edits keep the pristine flag, pixel edits clear it', () => {
    const s = M.createStore();
    s.load(D.create(2, 2), { pristine: true });
    s.touch({ keepPristine: true });
    ok(s.pristine);
    s.touch();
    ok(!s.pristine);
  });
  test('history is capped', () => {
    const s = M.createStore();
    for (let i = 0; i < 100; i++) s.checkpoint();
    eq(s.undoStack.length, 60);
  });

  /* ----- pixelate ----- */
  test('pixelate changes real grid size and averages areas', () => {
    // 4x4 source: left half red, right half blue
    const src = rgba(4, 4, (x) => (x < 2 ? [255, 0, 0] : [0, 0, 255]));
    const g2 = P.pixelate(src, 2, 2);
    eq(g2.length, 4);
    eq(g2[0], 0xff0000); eq(g2[1], 0x0000ff);
    const g1 = P.pixelate(src, 1, 1);
    eq(g1.length, 1);
    const [r, , b] = U.rgb(g1[0]);
    ok(Math.abs(r - 128) <= 1 && Math.abs(b - 128) <= 1, 'blend of red+blue');
    const g8 = P.pixelate(src, 8, 8);
    eq(g8.length, 64);
    eq(g8[0], 0xff0000); eq(g8[7], 0x0000ff);
  });
  test('pixelate handles non-integer ratios without dropping area', () => {
    const src = rgba(5, 3, () => [10, 200, 30]);
    const g = P.pixelate(src, 3, 2);
    ok(Array.from(g).every((v) => v === U.pack(10, 200, 30)));
  });
  test('pixelate maps transparent areas to EMPTY and ignores their color', () => {
    const src = rgba(2, 1, (x) => (x === 0 ? [255, 255, 255, 0] : [0, 128, 0, 255]));
    const g = P.pixelate(src, 2, 1);
    eq(g[0], U.EMPTY); eq(g[1], 0x008000);
    const half = P.pixelate(src, 1, 1); // 50% alpha averages to 127.5 < 128 -> empty
    ok(half[0] === U.EMPTY || half[0] === 0x008000);
  });
  test('fitSize keeps aspect ratio and clamps', () => {
    const a = P.fitSize(200, 100, 32); eq(a.w, 32); eq(a.h, 16);
    const b = P.fitSize(100, 200, 32); eq(b.w, 16); eq(b.h, 32);
    const c = P.fitSize(100, 1, 32); eq(c.h, 1);
  });

  /* ----- quantize / legend ----- */
  test('quantize limits colors and leaves EMPTY alone', () => {
    const px = new Int32Array(100);
    for (let i = 0; i < 100; i++) px[i] = i === 0 ? U.EMPTY : U.pack(i * 2, 255 - i * 2, (i * 7) % 255);
    const out = Q.quantize(px, 4);
    eq(out[0], U.EMPTY);
    eq(new Set(Array.from(out).filter((v) => v !== U.EMPTY)).size <= 4, true);
    eq(Q.quantize(px, 0)[5], px[5], 'limit 0 = unchanged');
    ok(Q.quantize(px, 500).every((v, i) => v === px[i]), 'limit above color count = unchanged');
  });
  test('quantize keeps clearly distinct colors distinct', () => {
    const px = Int32Array.from([0xff0000, 0xff0000, 0x00ff00, 0x0000ff, 0xfe0101]);
    const out = Q.quantize(px, 3);
    eq(new Set(out).size, 3);
    eq(out[0], out[4]);
  });
  test('legend orders by frequency, assigns unique symbols, counts done', () => {
    const d = D.create(3, 2);
    d.pixels.set([1, 1, 1, 2, 2, U.EMPTY]);
    d.done.set([1, 0, 0, 1, 1, 0]);
    const l = Q.legend(d);
    eq(l.entries.length, 2); eq(l.filled, 5);
    eq(l.entries[0].color, 1); eq(l.entries[0].count, 3); eq(l.entries[0].done, 1);
    eq(l.entries[1].done, 2);
    ok(l.entries[0].symbol !== l.entries[1].symbol);
    const many = D.create(20, 20);
    for (let i = 0; i < 400; i++) many.pixels[i] = i;
    eq(new Set(Q.legend(many).entries.map((e) => e.symbol)).size, 400, 'symbols stay unique even past the symbol set');
  });

  /* ----- storage ----- */
  test('serialize/deserialize round-trips pixels and progress', () => {
    const d = D.create(3, 2, U.EMPTY, 'Cat');
    d.pixels.set([0xff0000, 0xff0000, U.EMPTY, 0x00ff00, 0, 0xffffff]);
    d.done.set([1, 0, 0, 1, 0, 0]);
    const json = JSON.parse(JSON.stringify(S.serialize(d)));
    const back = S.deserialize(json);
    eq(back.name, 'Cat'); eq(back.width, 3); eq(back.height, 2);
    eq(Array.from(back.pixels).join(), Array.from(d.pixels).join());
    eq(Array.from(back.done).join(), '1,0,0,1,0,0');
  });
  test('deserialize rejects damaged or foreign files', () => {
    throws(() => S.deserialize(null), /not a Mochipixelu/);
    throws(() => S.deserialize({ format: 'other' }), /not a Mochipixelu/);
    const good = S.serialize(D.create(2, 2, 5));
    throws(() => S.deserialize(Object.assign({}, good, { width: 0 })), /size is invalid/);
    throws(() => S.deserialize(Object.assign({}, good, { width: 999 })), /size is invalid/);
    throws(() => S.deserialize(Object.assign({}, good, { data: [0] })), /damaged/);
    throws(() => S.deserialize(Object.assign({}, good, { data: [9, 9, 9, 9] })), /damaged/);
    throws(() => S.deserialize(Object.assign({}, good, { palette: ['nope'] })), /invalid color/);
    throws(() => S.deserialize(Object.assign({}, good, { version: 99 })), /newer version/);
    throws(() => S.fromFileText('{not json'), /not valid JSON/);
  });
  test('deserialize ignores progress on empty or out-of-range cells', () => {
    const d = D.create(2, 1);
    d.pixels.set([3, U.EMPTY]);
    const obj = S.serialize(d);
    obj.done = [0, 1, 99, -4, 'x'];
    const back = S.deserialize(obj);
    eq(Array.from(back.done).join(), '1,0');
  });

  if (isNode) {
    test('app version matches the newest CHANGELOG entry', () => {
      const log = require('fs').readFileSync(require('path').join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
      const m = /^## \[(\d+\.\d+\.\d+)\]/m.exec(log);
      ok(m, 'no version heading found in CHANGELOG.md');
      eq(m[1], U.VERSION);
    });
  }


  /* ----- library (needs a localStorage; Node gets an in-memory stub) ----- */
  const withStorage = (fn) => {
    const mem = {};
    const stub = {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
    };
    const prev = root.localStorage;
    try { Object.defineProperty(root, 'localStorage', { value: stub, configurable: true, writable: true }); } catch (e) { root.localStorage = stub; }
    try { fn(mem); } finally {
      try { Object.defineProperty(root, 'localStorage', { value: prev, configurable: true, writable: true }); } catch (e) { root.localStorage = prev; }
    }
  };
  const art = (name) => {
    const d = D.create(4, 2, U.EMPTY, name);
    d.pixels.set([1, 1, 2, U.EMPTY, 3, 3, 3, 2]);
    d.done.set([1, 0, 0, 0, 1, 1, 0, 0]);
    return d;
  };
  test('library save/list/load round-trips with progress stats', () => withStorage(() => {
    const r = S.library.save(art('Cat'));
    ok(r.ok && r.id);
    const [e] = S.library.list();
    eq(e.name, 'Cat'); eq(e.width, 4); eq(e.filled, 7); eq(e.done, 3); eq(e.colors, 3);
    const back = S.library.load(r.id);
    eq(Array.from(back.pixels).join(), Array.from(art('x').pixels).join());
    eq(Array.from(back.done).join(), '1,0,0,0,1,1,0,0');
  }));
  test('library saves update in place and list newest first', () => withStorage(() => {
    const a = S.library.save(art('A')).id;
    const b = S.library.save(art('B')).id;
    const l0 = S.library.list();
    eq(l0.length, 2);
    const again = art('A2'); again.done.fill(0);
    S.library.save(again, a);
    const l1 = S.library.list();
    eq(l1.length, 2, 'same id must not add an entry');
    ok(l1.some((e) => e.id === a && e.name === 'A2' && e.done === 0));
    ok(l1[0].updated >= l1[1].updated, 'sorted newest first');
    ok(b);
  }));
  test('library rename, duplicate (progress reset) and remove', () => withStorage(() => {
    const id = S.library.save(art('Cat')).id;
    S.library.rename(id, '  Kitty  ');
    eq(S.library.get(id).name, 'Kitty');
    S.library.rename(id, '   ');
    eq(S.library.get(id).name, 'Untitled');
    const copy = S.library.duplicate(id);
    ok(copy.ok && copy.id !== id);
    eq(S.library.list().length, 2);
    const c = S.library.get(copy.id);
    eq(c.done, 0); eq(c.filled, 7); eq(c.name, 'Untitled1');
    eq(S.library.get(id).done, 3, 'original keeps its progress');
    S.library.remove(id);
    eq(S.library.list().length, 1);
    throws(() => S.library.load(id), /could not be found/);
  }));
  test('a taken name gets the next number: Heart → Heart1 → Heart2', () => withStorage(() => {
    const a = S.library.save(art('Heart')).id;
    const b = S.library.save(art('heart')).id;
    eq(S.library.get(b).name, 'heart1');
    const c = S.library.save(art('HEART')).id;
    eq(S.library.get(c).name, 'HEART2');
    eq(S.library.get(a).name, 'Heart', 'the first keeps its name');
    eq(S.library.uniqueName('Dog'), 'Dog');
    eq(S.library.uniqueName(''), 'Untitled');
    eq(S.library.uniqueName('Heart1'), 'Heart3', 'a numbered name continues the count');
  }));
  test('duplicating a pattern names the copy name1 and resets progress', () => withStorage(() => {
    const id = S.library.save(art('Heart')).id;
    const copy = S.library.duplicate(id);
    eq(S.library.get(copy.id).name, 'Heart1');
    eq(S.library.get(S.library.duplicate(id).id).name, 'Heart2');
  }));
  test('theme, pin, folder, archive and trash are kept on the library entry', () => withStorage(() => {
    const d = D.create(4, 4, U.EMPTY, 'Cat');
    d.pixels[0] = 0xff0000;
    const id = S.library.save(d).id;
    eq(S.library.setMeta(id, { theme: 'pink', pinned: true, folder: ' Pets ' }).ok, true);
    let e = S.library.get(id);
    eq(e.theme, 'pink'); eq(e.pinned, true); eq(e.folder, 'Pets');
    S.library.setMeta(id, { theme: 'neon' });
    eq(S.library.get(id).theme, 'pink', 'an unknown theme is ignored');
    S.library.save(d, id, { keepName: true }); // autosave must not lose them
    e = S.library.get(id);
    eq(e.theme, 'pink', 'theme survives re-save'); eq(e.folder, 'Pets', 'folder survives re-save');
    eq(S.library.folders().join(), 'Pets');
    S.library.setMeta(id, { trashed: true, pinned: false, folder: '' });
    e = S.library.get(id);
    eq(e.trashed, true); eq(e.pinned, undefined); eq(e.folder, undefined);
    eq(S.library.folders().length, 0);
    eq(S.library.setMeta('nope', { pinned: true }).ok, false);
  }));
  test('the project file format is unchanged by themes', () => withStorage(() => {
    const d = D.create(2, 2, U.EMPTY, 'A');
    const id = S.library.save(d).id;
    S.library.setMeta(id, { theme: 'blue' });
    eq(JSON.stringify(Object.keys(S.serialize(d))), JSON.stringify(['format', 'version', 'name', 'width', 'height', 'palette', 'data', 'done']));
  }));
  test('renaming or dissolving a folder moves every pattern in it', () => withStorage(() => {
    const a = S.library.save(D.create(2, 2, U.EMPTY, 'A')).id;
    const b = S.library.save(D.create(2, 2, U.EMPTY, 'B')).id;
    S.library.setMeta(a, { folder: 'Old' }); S.library.setMeta(b, { folder: 'Old', trashed: true });
    S.library.renameFolder('Old', 'New');
    eq(S.library.get(a).folder, 'New'); eq(S.library.get(b).folder, 'New');
    S.library.renameFolder('New', '');
    eq(S.library.get(a).folder, undefined); eq(S.library.get(b).folder, undefined);
  }));
  test('an empty folder persists until it is removed', () => withStorage(() => {
    eq(S.library.addFolder('  Soft toys ').ok, true);
    eq(S.library.folders().join(), 'Soft toys');
    eq(S.library.addFolder('soft TOYS').name, 'Soft toys', 'same name in another case is the same folder');
    eq(S.library.folders().length, 1);
    eq(S.library.addFolder('   ').ok, false);
    S.library.renameFolder('Soft toys', 'Toys');
    eq(S.library.folders().join(), 'Toys');
    S.library.renameFolder('Toys', '');
    eq(S.library.folders().length, 0);
  }));
  test('duplicate keeps the theme and folder', () => withStorage(() => {
    const id = S.library.save(D.create(2, 2, U.EMPTY, 'A')).id;
    S.library.setMeta(id, { theme: 'green', folder: 'X' });
    const c = S.library.get(S.library.duplicate(id).id);
    eq(c.theme, 'green'); eq(c.folder, 'X');
  }));
  test('re-saving a pattern under its own name is not a duplicate', () => withStorage(() => {
    const id = S.library.save(art('Cat')).id;
    S.library.save(S.library.load(id), id);
    eq(S.library.get(id).name, 'Cat');
    eq(S.library.uniqueName('Cat', id), 'Cat');
  }));
  test('renaming onto an existing name numbers it; blank becomes Untitled', () => withStorage(() => {
    S.library.save(art('Cat'));
    const id = S.library.save(art('Dog')).id;
    S.library.rename(id, 'Cat');
    eq(S.library.get(id).name, 'Cat1');
    S.library.rename(id, '   ');
    eq(S.library.get(id).name, 'Untitled');
  }));
  test('library save reports failure when storage is full', () => withStorage(() => {
    root.localStorage.setItem = () => { throw new Error('quota'); };
    const r = S.library.save(art('X'));
    ok(!r.ok && /storage/i.test(r.error));
  }));
  test('1.1.0 autosave migrates into the library once', () => withStorage((mem) => {
    mem['mochipixelu:autosave'] = JSON.stringify(S.serialize(art('Old work')));
    const id = S.migrateAutosave();
    ok(id);
    eq(S.library.list().length, 1);
    eq(S.library.get(id).name, 'Old work');
    ok(!('mochipixelu:autosave' in mem), 'autosave cleared after migration');
    eq(S.migrateAutosave(), null);
  }));
  test('migration ignores an empty autosave', () => withStorage((mem) => {
    mem['mochipixelu:autosave'] = JSON.stringify(S.serialize(D.create(8, 8)));
    eq(S.migrateAutosave(), null);
    eq(S.library.list().length, 0);
  }));

  /* ----- report ----- */
  const failed = results.filter((r) => !r.ok);
  if (isNode) {
    results.forEach((r) => console.log((r.ok ? '  ok   ' : '  FAIL ') + r.name + (r.ok ? '' : '\n         ' + r.error)));
    console.log('\n' + (results.length - failed.length) + '/' + results.length + ' tests passed');
    if (failed.length) process.exit(1);
  } else {
    const pre = document.getElementById('out');
    pre.textContent =
      results.map((r) => (r.ok ? '✔ ' : '✘ ') + r.name + (r.ok ? '' : '\n    ' + r.error)).join('\n') +
      '\n\n' + (results.length - failed.length) + '/' + results.length + ' tests passed';
    document.title = (failed.length ? 'FAIL ' : 'PASS ') + document.title;
  }
})();
