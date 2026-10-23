/* Mochipixelu end-to-end test (real Chromium). Optional — needs Playwright installed somewhere:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node tests/e2e.cjs
 * Writes screenshots/downloads to a temp folder. The app itself needs no tooling. */
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const SP = fs.mkdtempSync(path.join(os.tmpdir(), 'mochipixelu-e2e-')) + path.sep;
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0;
const check = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  -> ' + extra)); if (!cond) fails++; };

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.mochipixelu);

  const st = () => page.evaluate(() => { const a = window.mochipixelu, d = a.store.design; return { w: d.width, h: d.height, px: Array.from(d.pixels), done: Array.from(d.done), pristine: a.store.pristine }; });
  const cellXY = async (x, y) => page.evaluate(([x, y]) => { const a = window.mochipixelu, r = a.renderer.canvas.getBoundingClientRect(), c = a.renderer.cell; return { x: r.left + (x + .5) * c, y: r.top + (y + .5) * c }; }, [x, y]);
  const click = async (x, y) => { const p = await cellXY(x, y); await page.mouse.click(p.x, p.y); };

  // 1. draw with pencil
  await page.evaluate(() => window.mochipixelu.setColor(0xff0000));
  await click(2, 2);
  let s = await st();
  check('pencil paints a cell', s.px[2 * s.w + 2] === 0xff0000, s.px[2 * s.w + 2]);

  // drag stroke
  let a = await cellXY(5, 5), b = await cellXY(10, 5);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 3 }); await page.mouse.up();
  s = await st();
  check('drag draws a continuous line (6 cells)', [5,6,7,8,9,10].every(x => s.px[5 * s.w + x] === 0xff0000));

  // undo removes whole stroke in one step
  await page.keyboard.press('Control+z');
  s = await st();
  check('undo removes the whole stroke', s.px[5 * s.w + 7] === -1 && s.px[2 * s.w + 2] === 0xff0000);
  await page.keyboard.press('Control+y');
  s = await st();
  check('redo restores stroke', s.px[5 * s.w + 7] === 0xff0000);

  // eraser
  await page.keyboard.press('e'); await click(7, 5);
  s = await st(); check('eraser clears a cell', s.px[5 * s.w + 7] === -1);

  // fill + fill-all
  await page.keyboard.press('g'); await page.evaluate(() => window.mochipixelu.setColor(0x00ff00)); await click(20, 20);
  s = await st(); check('fill floods the empty region', s.px[20 * 32 + 20] === 0x00ff00 && s.px.filter(v => v === 0x00ff00).length > 900, s.px.filter(v => v === 0x00ff00).length);
  await page.evaluate(() => window.mochipixelu.setColor(0x0000ff));
  await page.click('[data-tab=colors]'); await page.check('#fill-all');
  await click(20, 20);
  s = await st(); check('fill-all recolors every matching cell', s.px.filter(v => v === 0x00ff00).length === 0 && s.px.filter(v => v === 0x0000ff).length > 900);
  await page.uncheck('#fill-all');

  // 2. resolution change on blank/edited design (resample)
  await page.click('[data-tab=design]');
  await page.fill('#res-w', '16'); await page.waitForTimeout(400);
  s = await st(); check('resolution 16x16 changes the real pixel count', s.w === 16 && s.h === 16 && s.px.length === 256, s.w + 'x' + s.h);
  await page.click('#btn-undo'); s = await st(); check('undo restores 32x32', s.w === 32 && s.px.length === 1024);

  // 3. new custom canvas non-square
  await page.fill('#new-w', '20'); await page.fill('#new-h', '12'); await page.selectOption('#new-bg', 'white'); await page.click('#btn-create');
  s = await st(); check('custom blank canvas 20x12 white', s.w === 20 && s.h === 12 && s.px.every(v => v === 0xffffff));

  // 4. import image (generated in page): left red, right blue, top-left corner transparent
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 100;
    const x = c.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 100, 100); x.fillStyle = '#0000ff'; x.fillRect(100, 0, 100, 100);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    await window.mochipixelu.importImageFile(new File([blob], 'flag.png', { type: 'image/png' }));
  });
  await page.waitForTimeout(300);
  s = await st();
  check('import pixelates to aspect-correct grid (2:1)', s.w / s.h === 2, s.w + 'x' + s.h);
  check('import is pristine + colors correct', s.pristine && s.px[0] === 0xff0000 && s.px[s.w - 1] === 0x0000ff);
  const name = await page.inputValue('#design-name'); check('design named from file', name === 'flag', name);

  // live resolution with source: width 8 -> height 4, still pure colors
  await page.fill('#res-w', '8'); await page.waitForTimeout(400);
  s = await st(); check('live re-pixelate to 8x4', s.w === 8 && s.h === 4 && s.px[0] === 0xff0000 && s.px[7] === 0x0000ff && s.pristine, s.w + 'x' + s.h);
  await page.fill('#res-w', '64'); await page.waitForTimeout(400);
  s = await st(); check('upscale resolution to 64x32 increases pixels', s.w === 64 && s.h === 32 && s.px.length === 2048);
  // color limit
  await page.fill('#color-limit', '1'); await page.dispatchEvent('#color-limit', 'change'); await page.waitForTimeout(200);
  s = await st(); check('color limit 1 live', new Set(s.px).size === 1, new Set(s.px).size);
  await page.fill('#color-limit', '0'); await page.dispatchEvent('#color-limit', 'change'); await page.waitForTimeout(200);

  // edit then resize -> not pristine, resample keeps drawn data
  await page.evaluate(() => window.mochipixelu.setColor(0x123456));
  await page.keyboard.press('b'); await click(1, 1);
  s = await st(); check('editing clears pristine', !s.pristine);

  // 5. inspect + keyboard nav + mark
  await page.keyboard.press('q'); await click(3, 4);
  let info = await page.textContent('#insp-coords'); check('inspect shows 1-based coordinates', /Column 4, Row 5/.test(info), info);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown');
  info = await page.textContent('#insp-coords'); check('arrow keys move selection', /Column 5, Row 6/.test(info), info);
  await page.click('#nav-left'); info = await page.textContent('#insp-coords'); check('d-pad moves selection', /Column 4, Row 6/.test(info), info);
  await page.focus('#canvas'); await page.keyboard.press('Enter');
  s = await st(); check('Enter toggles done on selected cell', s.done[5 * s.w + 3] === 1);
  await page.keyboard.press('m'); a = await cellXY(0, 0); b = await cellXY(5, 0);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
  s = await st(); check('mark tool marks a dragged row', [0,1,2,3,4,5].every(x => s.done[x] === 1));
  await page.click('[data-tab=craft]');
  const prog = await page.textContent('#progress-text'); check('progress text updates', /\d+ of 2048 stitches done/.test(prog) && !/^0 of/.test(prog), prog);
  // spotlight
  await page.click('#legend-list button >> nth=0');
  check('legend spotlight sets filter', await page.evaluate(() => window.mochipixelu.renderer.filter !== null));
  await page.keyboard.press('Escape');
  check('Escape clears spotlight', await page.evaluate(() => window.mochipixelu.renderer.filter === null));
  // progress survives undo of marking
  // 6. export
  await page.click('[data-tab=export]');
  const [dl1] = await Promise.all([page.waitForEvent('download'), page.click('#btn-pattern-png')]);
  const p1 = SP + 'pattern.png'; await dl1.saveAs(p1);
  check('pattern PNG downloads', dl1.suggestedFilename() === 'flag-pattern.png', dl1.suggestedFilename());
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#btn-art-png')]);
  await dl2.saveAs(SP + 'art.png');
  const dims = await page.evaluate(async () => { const c = await new Promise(r => window.mochipixelu.renderer.canvas.toBlob(r)); return 0; });
  await page.click('[data-tab=files]');
  const [dl3] = await Promise.all([page.waitForEvent('download'), page.click('#btn-save-file')]);
  await dl3.saveAs(SP + 'proj.json');
  check('project file downloads', /\.mochipixelu\.json$/.test(dl3.suggestedFilename()));
  await page.click('[data-tab=export]'); await page.click('#btn-preview'); await page.waitForSelector('#preview-pages img');
  const pages = await page.locator('#preview-pages img').count();
  check('preview builds overview + 2 sections for 64 columns', pages === 3, pages);
  await page.screenshot({ path: SP + 'preview.png' });
  await page.click('#preview-close');

  // 7. persistence: reload restores autosave
  await page.waitForTimeout(800);
  await page.reload(); await page.waitForFunction(() => window.mochipixelu);
  s = await st(); check('autosave restores design after reload', s.w === 64 && s.h === 32 && s.done.some(v => v === 1));
  
  // 8. library save/load
  await page.click('[data-tab=files]'); await page.click('#btn-save-lib'); await page.click('#btn-library');
  check('library lists saved design', (await page.locator('#library-list li strong').count()) === 1);
  await page.click('#library-list .btn >> text=Open'); 
  s = await st(); check('library open works', s.w === 64);

  // 9. project file round trip via open
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.mochipixelu.store.load(window.Mochi.Design.create(5, 5), { checkpoint: true }));
  await page.setInputFiles('#file-project', SP + 'proj.json'); await page.waitForTimeout(300);
  s = await st(); check('open project file restores 64x32 with progress', s.w === 64 && s.done.some(v => v === 1));
  await page.screenshot({ path: SP + 'desktop.png' });

  // 10. bad project file
  require('fs').writeFileSync(SP + 'bad.json', '{"format":"nope"}');
  await page.setInputFiles('#file-project', SP + 'bad.json'); await page.waitForTimeout(200);
  check('bad project file shows error toast', /not a Mochipixelu/.test(await page.textContent('#toast')));
  // non-image import
  require('fs').writeFileSync(SP + 'x.txt', 'hello');
  await page.setInputFiles('#file-input', SP + 'x.txt'); await page.waitForTimeout(200);
  check('non-image import is rejected', /choose an image/.test(await page.textContent('#toast')), await page.textContent('#toast'));

  // 11. large design pages + mobile
  await page.evaluate(() => { const A = window.mochipixelu; const d = window.Mochi.Design.create(120, 90, 0xff9999); A.store.load(d, { source: null }); });
  await page.click('[data-tab=export]'); await page.click('#btn-preview'); await page.waitForSelector('#preview-pages img');
  const bigPages = await page.locator('#preview-pages img').count();
  check('large design splits into overview + sections', bigPages === 1 + 3 * 2, bigPages);
  await page.click('#preview-close');

  /* ---------- phone: bottom dock, sheet, gestures ---------- */
  const m = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const mp = await m.newPage(); mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  await mp.goto(URL); await mp.waitForFunction(() => window.mochipixelu);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('mobile: no horizontal overflow', overflow <= 1, overflow);
  check('mobile: page itself does not scroll', await mp.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1));
  const dock = await mp.evaluate(() => { const r = document.querySelector('.dock').getBoundingClientRect(); return { bottom: r.bottom, top: r.top, h: window.innerHeight }; });
  check('mobile: tool dock is fixed to the bottom edge', Math.abs(dock.bottom - dock.h) <= 1, JSON.stringify(dock));
  const cv = await mp.evaluate(() => { const r = document.getElementById('canvas-scroll').getBoundingClientRect(); return { w: r.width, h: r.height }; });
  check('mobile: canvas area is large (>= 300px tall)', cv.h >= 300, cv.h);
  check('mobile: side panel hidden until opened', await mp.evaluate(() => getComputedStyle(document.getElementById('sheet')).visibility === 'hidden'));
  check('mobile: desktop-only buttons hidden', await mp.evaluate(() => getComputedStyle(document.querySelector('.top-quick')).display === 'none'));
  check('mobile: no emoji left in the UI', await mp.evaluate(() => !/\p{Extended_Pictographic}/u.test(document.body.innerText.replace(/[✓]/g, ''))));
  await mp.screenshot({ path: SP + 'mobile.png' });

  // touch drawing
  await mp.evaluate(() => window.mochipixelu.setColor(0xff0000));
  const cellPt = (x, y) => mp.evaluate(([x, y]) => { const a = window.mochipixelu, r = a.renderer.canvas.getBoundingClientRect(), c = a.renderer.cell; return { x: r.left + (x + .5) * c, y: r.top + (y + .5) * c }; }, [x, y]);
  let bx = await cellPt(3, 3);
  await mp.touchscreen.tap(bx.x, bx.y);
  check('mobile: tap draws', (await mp.evaluate(() => window.mochipixelu.store.design.pixels[3 * 32 + 3])) === 0xff0000);

  // sheet open/close + live resolution preview
  await mp.tap('[data-open-tab=design]');
  await mp.waitForTimeout(400);
  check('mobile: tapping Design opens the sheet', await mp.evaluate(() => getComputedStyle(document.getElementById('sheet')).visibility === 'visible'));
  const geo = await mp.evaluate(() => { const s = document.getElementById('sheet').getBoundingClientRect(), d = document.querySelector('.dock').getBoundingClientRect(), c = document.getElementById('canvas-scroll').getBoundingClientRect(); return { sheetBottom: s.bottom, dockTop: d.top, canvasBottom: c.bottom, canvasH: c.height }; });
  check('mobile: sheet sits right above the dock, canvas still visible', Math.abs(geo.sheetBottom - geo.dockTop) <= 1 && geo.canvasH > 150, JSON.stringify(geo));
  const fitted = await mp.evaluate(() => { const a = window.mochipixelu, c = document.getElementById('canvas-scroll'); return a.renderer.canvas.width <= c.clientWidth && a.renderer.canvas.height <= c.clientHeight; });
  check('mobile: auto-fit keeps the whole canvas in view when the sheet opens', fitted);
  await mp.fill('#res-w', '16'); await mp.waitForTimeout(400);
  check('mobile: resolution changes live from the sheet', (await mp.evaluate(() => window.mochipixelu.store.design.width)) === 16);
  await mp.tap('[data-open-tab=design]'); await mp.waitForTimeout(400);
  check('mobile: tapping the active tab again closes the sheet', await mp.evaluate(() => getComputedStyle(document.getElementById('sheet')).visibility === 'hidden'));
  await mp.tap('[data-open-tab=colors]'); await mp.waitForTimeout(300);
  await mp.tap('#palette-grid .sw >> nth=18'); // a green swatch
  const gcol = await mp.evaluate(() => window.mochipixelu.settings.color);
  check('mobile: picking a palette swatch sets the color', gcol === 0x9cc58d, gcol.toString(16));
  const dotBg = await mp.evaluate(() => getComputedStyle(document.querySelector('[data-cur-color]')).backgroundColor);
  check('mobile: dock color dot follows the current color', dotBg === 'rgb(156, 197, 141)', dotBg);
  await mp.screenshot({ path: SP + 'mobile-sheet.png' });
  await mp.tap('#sheet-close');

  // pinch zoom + two-finger pan via synthetic touch pointer events
  await mp.evaluate(() => window.mochipixelu.fit());
  const cellBefore = await mp.evaluate(() => window.mochipixelu.renderer.cell);
  const pxBefore = await mp.evaluate(() => Array.from(window.mochipixelu.store.design.pixels).join());
  const hist = await mp.evaluate(() => window.mochipixelu.store.undoStack.length);
  await mp.evaluate(() => {
    const c = document.getElementById('canvas'), r = c.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 1 }));
    ev('pointerdown', 1, cx - 20, cy); ev('pointerdown', 2, cx + 20, cy);
    for (let i = 1; i <= 8; i++) { ev('pointermove', 1, cx - 20 - i * 8, cy); ev('pointermove', 2, cx + 20 + i * 8, cy); }
    ev('pointerup', 1, cx - 84, cy); ev('pointerup', 2, cx + 84, cy);
  });
  const cellAfter = await mp.evaluate(() => window.mochipixelu.renderer.cell);
  const pxAfter = await mp.evaluate(() => Array.from(window.mochipixelu.store.design.pixels).join());
  const histAfter = await mp.evaluate(() => window.mochipixelu.store.undoStack.length);
  check('mobile: pinch-out zooms in', cellAfter > cellBefore, cellBefore + ' -> ' + cellAfter);
  check('mobile: pinch does not paint pixels or add history', pxBefore === pxAfter && hist === histAfter, hist + ' vs ' + histAfter);
  check('mobile: manual zoom turns auto-fit off, Fit turns it back on', await mp.evaluate(() => { const a = window.mochipixelu; const off = a.autoFit === false; a.fit(); return off && a.autoFit === true; }));

  // a second finger landing mid-stroke cancels the stray dot
  const q0 = await cellPt(5, 5), q1 = await cellPt(8, 8);
  await mp.evaluate(([a, b]) => {
    const c = document.getElementById('canvas');
    const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true }));
    ev('pointerdown', 11, a.x, a.y); ev('pointerdown', 12, b.x, b.y); ev('pointerup', 11, a.x, a.y); ev('pointerup', 12, b.x, b.y);
  }, [q0, q1]);
  check('mobile: second finger cancels the accidental first-finger dot', (await mp.evaluate(() => window.mochipixelu.store.design.pixels[5 * 16 + 5])) === -1);

  // Move tool drags the view (zoom in first so there is something to scroll)
  await mp.evaluate(() => { window.mochipixelu.setZoom(40); window.mochipixelu.setTool('pan'); });
  const sc0 = await mp.evaluate(() => document.getElementById('canvas-scroll').scrollLeft);
  const mid = await cellPt(8, 8);
  await mp.evaluate(([a]) => {
    const c = document.getElementById('canvas');
    const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 21, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true }));
    ev('pointerdown', a.x, a.y); ev('pointermove', a.x + 60, a.y); ev('pointerup', a.x + 60, a.y);
  }, [mid]);
  const sc1 = await mp.evaluate(() => document.getElementById('canvas-scroll').scrollLeft);
  check('mobile: Move tool drags the view', sc1 < sc0, sc0 + ' -> ' + sc1);

  check('no console/page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
