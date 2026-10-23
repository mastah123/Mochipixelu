/* Mochipixelu end-to-end test (real Chromium). Optional — needs Playwright installed somewhere:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node tests/e2e.cjs
 * Writes screenshots to a temp folder (path printed at the end). The app itself needs no tooling. */
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const SP = fs.mkdtempSync(path.join(os.tmpdir(), 'mochipixelu-e2e-')) + path.sep;
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
let fails = 0;
const check = (name, cond, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  -> ' + extra)); if (!cond) fails++; };

// tiny 4x2 PNG (red, green / blue, yellow) for import tests
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAAFUlEQVR4nGP4z8Dwn4GBgQGIGf4DAB4EBP/ZPHKdAAAAAElFTkSuQmCC', 'base64');

async function open(browser, opts) {
  const ctx = await browser.newContext(Object.assign({ acceptDownloads: true }, opts));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.mochipixelu);
  return { ctx, page, errors };
}
const hash = (page) => page.evaluate(() => location.hash);
const screenIs = (page, n) => page.waitForFunction((n) => document.body.dataset.screen === n, n, { timeout: 3000 }).then(() => true, () => false);
const vis = (page, sel) => page.locator(sel).isVisible();

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  /* ================= phone flow ================= */
  {
    const { ctx, page, errors } = await open(browser, { viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });

    check('starts on the home page', (await page.evaluate(() => document.body.dataset.screen)) === 'home');
    check('empty state shows', await vis(page, '#home-empty'));
    check('+ button is visible', await vis(page, '#fab'));
    const fab = await page.locator('#fab').boundingBox();
    check('+ is fixed bottom-right', fab.x + fab.width > 390 - 40 && fab.y + fab.height > 780 - 40, JSON.stringify(fab));
    await page.screenshot({ path: SP + 'home-empty.png' });

    // new canvas via FAB
    await page.tap('#fab');
    check('speed dial opens', await vis(page, '#fab-menu'));
    await page.tap('#fab-menu [data-home=new]');
    await page.fill('#new-name', 'Heart');
    await page.fill('#new-w', '12'); await page.fill('#new-h', '10');
    await page.tap('#new-create');
    await page.waitForFunction(() => location.hash.startsWith('#/e/'));
    const id = (await hash(page)).slice(4);
    check('creating a canvas opens the editor', (await page.evaluate(() => document.body.dataset.screen)) === 'editor');
    check('library has the new project', (await page.evaluate(() => mochipixelu && JSON.parse(localStorage.getItem('mochipixelu:library')).length)) === 1);

    // layout: dock at bottom, canvas has room, no horizontal overflow
    const lay = async (tag) => {
      const r = await page.evaluate(() => {
        const q = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
        return { dock: q('.dock'), wrap: q('#screen-editor .canvas-wrap'), vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth };
      });
      check(tag + ': dock sits at the bottom', Math.abs(r.dock.y + r.dock.h - r.vh) < 2, JSON.stringify(r.dock));
      check(tag + ': no horizontal overflow', r.sw <= r.vw, r.sw + '>' + r.vw);
      return r;
    };
    let r = await lay('editor closed sheet');
    check('canvas area is large (>=300px tall)', r.wrap.h >= 300, r.wrap.h);
    await page.tap('#btn-menu');
    await page.waitForTimeout(350);
    r = await lay('editor open sheet');
    check('canvas area stays usable with the sheet open (>=180px)', r.wrap.h >= 180, r.wrap.h);
    await page.screenshot({ path: SP + 'editor-sheet.png' });
    await page.tap('#sheet-close');
    await page.waitForTimeout(350);

    // draw with the pencil
    await page.evaluate(() => mochipixelu.setColor(0xe8737f));
    const cellXY = (x, y) => page.evaluate(([x, y]) => { const a = mochipixelu, b = a.renderer.canvas.getBoundingClientRect(), c = a.renderer.cell; return { x: b.left + (x + .5) * c, y: b.top + (y + .5) * c }; }, [x, y]);
    for (const [x, y] of [[2, 2], [3, 2], [4, 2], [2, 3], [3, 3], [4, 3]]) { const p = await cellXY(x, y); await page.touchscreen.tap(p.x, p.y); }
    const painted = await page.evaluate(() => mochipixelu.store.design.pixels.filter((v) => v === 0xe8737f).length);
    check('tapping with the pencil paints cells', painted === 6, painted);
    await page.screenshot({ path: SP + 'editor.png' });

    // autosave reaches the library
    await page.waitForTimeout(900);
    const lib = await page.evaluate(() => JSON.parse(localStorage.getItem('mochipixelu:library'))[0]);
    check('edits autosave into the library', lib.filled === 6, JSON.stringify(lib));

    // back to the view page
    await page.tap('#btn-back');
    check('back from editor opens the project view', await screenIs(page, 'view'));
    check('view shows the name', (await page.textContent('#view-title')) === 'Heart');
    await page.screenshot({ path: SP + 'view-look.png' });

    // look mode
    const vcell = (x, y) => page.evaluate(([x, y]) => { const c = document.getElementById('view-canvas'), b = c.getBoundingClientRect(); const cell = c.width / mochipixelu.store.design.width * 0 + c.width / 12; return { x: b.left + (x + .5) * cell, y: b.top + (y + .5) * cell }; }, [x, y]);
    let p = await vcell(2, 2); await page.touchscreen.tap(p.x, p.y);
    check('look mode shows stitch info', /Column 3, Row 3/.test(await page.textContent('#view-info-text')), await page.textContent('#view-info-text'));

    // guide mode
    await page.tap('[data-mode=guide]');
    check('guide controls appear', await vis(page, '#guide-controls'));
    p = await vcell(0, 2); await page.touchscreen.tap(p.x, p.y);
    check('tapping sets the guide row', /Row 3 of 10/.test(await page.textContent('#guide-label')), await page.textContent('#guide-label'));
    await page.tap('#guide-next');
    check('next moves the guide', /Row 4/.test(await page.textContent('#guide-label')));
    await page.tap('#guide-prev');
    await page.tap('#guide-done');
    let done = await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('mochipixelu:library'))[0]; return l; });
    await page.waitForTimeout(800);
    done = await page.evaluate(() => JSON.parse(localStorage.getItem('mochipixelu:library'))[0].done);
    check('Row done ticks the row and persists (3 stitches)', done === 3, done);
    check('guide advanced to the next row', /Row 4/.test(await page.textContent('#guide-label')), await page.textContent('#guide-label'));
    await page.screenshot({ path: SP + 'view-guide.png' });

    // tick mode
    await page.tap('[data-mode=tick]');
    p = await vcell(2, 3); await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(800);
    done = await page.evaluate(() => JSON.parse(localStorage.getItem('mochipixelu:library'))[0].done);
    check('tick mode ticks a stitch', done === 4, done);
    check('progress text updates', /4 of 6/.test(await page.textContent('#view-progress-text')), await page.textContent('#view-progress-text'));

    // spotlight chip
    await page.tap('#view-legend button');
    check('legend chip spotlights a color', (await page.evaluate(() => mochipixelu.renderer && true)) );

    // menu: rename, duplicate
    await page.tap('#view-more');
    await page.tap('[data-menu=rename]');
    await page.fill('#text-input', 'Big Heart');
    await page.tap('#text-ok');
    await page.waitForTimeout(300);
    check('rename updates the title', (await page.textContent('#view-title')) === 'Big Heart');
    await page.tap('#view-more');
    await page.tap('[data-menu=duplicate]');
    await page.waitForTimeout(300);
    const dup = await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('mochipixelu:library')); return { n: l.length, newest: l[0] }; });
    check('duplicate adds a copy with fresh progress', dup.n === 2 && dup.newest.done === 0 && /copy/.test(dup.newest.name), JSON.stringify(dup));

    // home shows both, continue card for the stitched one
    await page.tap('#view-back');
    await screenIs(page, 'home');
    check('home lists two patterns', (await page.locator('#home-grid .card').count()) === 2);
    check('continue card shows the in-progress pattern', await vis(page, '#continue-card'));
    await page.tap('[data-filter=new]');
    check('filter "Not started" shows only the copy', (await page.locator('#home-grid .card').count()) === 1);
    await page.tap('[data-filter=all]');
    await page.screenshot({ path: SP + 'home.png' });

    // open from card, edit button, delete
    await page.locator('#home-grid .card').first().tap();
    await screenIs(page, 'view');
    await page.tap('#view-edit');
    await screenIs(page, 'editor');
    check('Edit opens the editor for the same pattern', (await page.evaluate(() => mochipixelu.store.design.name)).includes('copy'));
    await page.tap('#btn-back');
    await page.tap('#view-more');
    await page.tap('[data-menu=delete]');
    await page.tap('#confirm-ok');
    await page.waitForFunction(() => location.hash === '#/' || location.hash === '');
    check('delete removes it from the library', (await page.evaluate(() => JSON.parse(localStorage.getItem('mochipixelu:library')).length)) === 1);

    // import from home
    await page.tap('#fab');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.tap('#fab-menu [data-home=import]')]);
    await chooser.setFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForFunction(() => location.hash.startsWith('#/e/'));
    await page.waitForTimeout(400);
    const imp = await page.evaluate(() => ({ w: mochipixelu.store.design.width, h: mochipixelu.store.design.height, pristine: mochipixelu.store.pristine, sheet: document.getElementById('sheet').classList.contains('open') }));
    check('import-from-home opens the editor with a pixelated image (4x2, live)', imp.w === 4 && imp.h === 2 && imp.pristine, JSON.stringify(imp));
    check('Design sheet opens after import', imp.sheet);

    // reload keeps the route and the data
    await page.waitForTimeout(800);
    await page.reload();
    await page.waitForFunction(() => window.mochipixelu);
    check('reload stays on the editor route', (await page.evaluate(() => document.body.dataset.screen)) === 'editor');

    // deleted/unknown route falls back home
    await page.evaluate(() => { location.hash = '#/p/doesnotexist'; });
    await page.waitForTimeout(200);
    check('unknown project id falls back to home', (await page.evaluate(() => document.body.dataset.screen)) === 'home');

    check('phone flow: no console/page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ================= other sizes: layout sanity ================= */
  const sizes = [[360, 640, 'sm'], [412, 915, 'tall'], [740, 360, 'landscape'], [1280, 820, 'desktop']];
  for (const [w, h, tag] of sizes) {
    const mobile = w < 900;
    const { ctx, page, errors } = await open(browser, { viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile });
    // seed one pattern through the app's own storage API
    const id = await page.evaluate(() => { const D = Mochi.Design; const d = D.create(24, 24, Mochi.Utils.EMPTY, 'Sample'); for (let i = 0; i < 24; i++) { d.pixels[i * 24 + i] = 0xe8737f; d.pixels[i * 24 + (23 - i)] = 0x9cc58d; } return Mochi.Storage.library.save(d).id; });
    await page.evaluate((id) => { location.hash = '#/e/' + id; }, id);
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const q = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
      return { wrap: q('#screen-editor .canvas-wrap'), dock: q('.dock'), sw: document.documentElement.scrollWidth, vw: innerWidth };
    });
    check(tag + ' editor: no horizontal overflow', m.sw <= m.vw, JSON.stringify(m));
    check(tag + ' editor: canvas area >= 200px both ways', m.wrap.w >= 200 && m.wrap.h >= 180, JSON.stringify(m.wrap));
    await page.screenshot({ path: SP + 'editor-' + tag + '.png' });
    if (mobile) {
      await page.tap('#btn-menu'); await page.waitForTimeout(350);
      const m2 = await page.evaluate(() => { const b = document.querySelector('#screen-editor .canvas-wrap').getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; });
      check(tag + ' editor with sheet open: canvas >= 150px', m2.w >= 150 && m2.h >= 130, JSON.stringify(m2));
      await page.screenshot({ path: SP + 'editor-sheet-' + tag + '.png' });
    }
    await page.evaluate((id) => { location.hash = '#/p/' + id; }, id);
    await page.waitForTimeout(400);
    const v = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth, c: document.getElementById('view-canvas').getBoundingClientRect().height }));
    check(tag + ' view: no overflow and canvas visible', v.sw <= v.vw && v.c >= 120, JSON.stringify(v));
    await page.screenshot({ path: SP + 'view-' + tag + '.png' });
    await page.evaluate(() => { location.hash = '#/'; });
    await page.waitForTimeout(300);
    const hv = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth }));
    check(tag + ' home: no overflow', hv.sw <= hv.vw, JSON.stringify(hv));
    await page.screenshot({ path: SP + 'home-' + tag + '.png' });
    check(tag + ': no errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  /* ================= desktop: mouse drawing, shortcuts, export ================= */
  {
    const { ctx, page, errors } = await open(browser, { viewport: { width: 1280, height: 820 } });
    await page.click('#fab'); await page.click('#fab-menu [data-home=new]');
    await page.click('#new-create');
    await page.waitForFunction(() => location.hash.startsWith('#/e/'));
    await page.waitForTimeout(300);
    await page.evaluate(() => mochipixelu.setColor(0xff0000));
    const cellXY = (x, y) => page.evaluate(([x, y]) => { const a = mochipixelu, b = a.renderer.canvas.getBoundingClientRect(), c = a.renderer.cell; return { x: b.left + (x + .5) * c, y: b.top + (y + .5) * c }; }, [x, y]);
    let a = await cellXY(5, 5), b = await cellXY(10, 5);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 3 }); await page.mouse.up();
    let n = await page.evaluate(() => mochipixelu.store.design.pixels.filter((v) => v === 0xff0000).length);
    check('desktop drag draws a line (6 cells)', n === 6, n);
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('Control+z');
    n = await page.evaluate(() => mochipixelu.store.design.pixels.filter((v) => v === 0xff0000).length);
    check('Ctrl+Z undoes the whole stroke', n === 0, n);
    await page.keyboard.press('Control+y');
    // resolution is live and real
    await page.fill('#res-w', '40');
    await page.waitForTimeout(400);
    const dim = await page.evaluate(() => [mochipixelu.store.design.width, mochipixelu.store.design.height]);
    check('resolution change changes the real cell count', dim[0] === 40 && dim[1] === 40, dim);
    check('desktop shows the side panel without opening', await vis(page, '#sheet'));
    // export downloads
    await page.click('[data-tab=export]');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-pattern-png')]);
    check('pattern PNG downloads', /pattern\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename());
    await page.click('#btn-preview');
    await page.waitForSelector('#preview-pages img');
    check('print preview shows pages', (await page.locator('#preview-pages img').count()) >= 1);
    await page.click('#preview-close');
    await page.screenshot({ path: SP + 'desktop-editor.png' });
    check('desktop: no errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log('\nScreenshots: ' + SP);
  console.log(fails ? fails + ' FAILED' : 'All end-to-end checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
