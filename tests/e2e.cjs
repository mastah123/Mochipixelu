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
    check('creating a canvas opens the editor', await screenIs(page, 'editor'));
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
    check('⋯ opens a menu with its own buttons', (await page.locator('#opt-menu [data-open]').count()) === 3 && (await vis(page, '#opt-menu')));
    check('menu has theme swatches, pin, folder, archive, trash and a footer', (await page.locator('#opt-menu .tone-sw').count()) === 6 && (await page.locator('#opt-menu [data-act]').count()) === 4 && /Edited/.test(await page.textContent('#menu-foot')));
    await page.tap('#opt-menu .tone-sw[data-tone=yellow]');
    const tn = await page.evaluate(() => [mochipixelu.$('screen-editor').dataset.tone, (mochipixelu.projectId && JSON.parse(localStorage.getItem('mochipixelu:library')).find((e) => e.id === mochipixelu.projectId) || {}).theme]);
    check('choosing a theme tints the editor and is saved', tn[0] === 'yellow' && tn[1] === 'yellow', tn);
    await page.tap('#opt-menu [data-act=pin]');
    check('Pin saves', await page.evaluate(() => JSON.parse(localStorage.getItem('mochipixelu:library')).find((e) => e.id === mochipixelu.projectId).pinned === true));
    await page.tap('#opt-menu [data-act=pin]'); // unpin again
    await page.tap('#opt-menu [data-open=design]');
    await page.waitForTimeout(350);
    r = await lay('editor open sheet');
    const sb = await page.locator('#sheet').boundingBox(), fb = await page.locator('#sheet-done').boundingBox();
    check('Done button is fixed at the bottom of the popup', fb.y + fb.height <= sb.y + sb.height + 1 && fb.y > sb.y + sb.height - 90, JSON.stringify([sb, fb]));
    check('there is no Colors section in the settings', (await page.locator('#panel-colors').count()) === 0);
    check('canvas area keeps its size with the sheet open (>=300px)', r.wrap.h >= 300, r.wrap.h);
    await page.screenshot({ path: SP + 'editor-sheet.png' });
    await page.tap('#sheet-done'); await page.waitForTimeout(300);
    check('no Progress section in the editor', (await page.locator('#panel-craft, #btn-clear-progress, #progress-bar').count()) === 0 && (await page.locator('#opt-menu [data-open=craft]').count()) === 0);
    check('no Mark tool in the editor', (await page.locator('.tool[data-tool=mark]').count()) === 0 && (await page.locator('#insp-done, #btn-mark-all').count()) === 0);
    check('no Move button in the bottom bar', (await page.locator('.dock [data-tool=pan]').count()) === 0);
    // pan / zoom / fit / full screen stay put on the canvas whatever opens over them
    const hudBox = async () => page.locator('#screen-editor .hud-br').boundingBox();
    const wrapBox = async () => page.locator('#screen-editor .canvas-wrap').boundingBox();
    check('pan and zoom buttons are on the canvas, and there is no full screen button', (await vis(page, '#hud-pan')) && (await vis(page, '#zoom-in')) && (await page.locator('#zoom-full, #view-full').count()) === 0);
    const h0 = await hudBox(), w0 = await wrapBox(), cell0 = await page.evaluate(() => mochipixelu.renderer.cell);
    await page.tap('#btn-menu'); await page.tap('#opt-menu [data-open=design]'); await page.waitForTimeout(350);
    const h1 = await hudBox(), w1 = await wrapBox(), cell1 = await page.evaluate(() => mochipixelu.renderer.cell);
    check('opening the panel does not move the buttons or resize the canvas', JSON.stringify([h0, w0]) === JSON.stringify([h1, w1]) && cell0 === cell1, JSON.stringify([h0, h1, w0, w1, cell0, cell1]));
    const top = await page.evaluate(() => { const b = document.getElementById('zoom-in').getBoundingClientRect(); const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return !!el.closest('#sheet') || el.id === 'zoom-in'; });
    check('the panel sits on top of the buttons (or leaves them clear)', top);
    await page.tap('#sheet-done'); await page.waitForTimeout(350);
    await page.tap('#hud-pan');
    check('pan button toggles the Move tool', (await page.evaluate(() => mochipixelu.settings.tool)) === 'pan');
    await page.tap('#hud-pan');
    await page.tap('#zoom-in');
    check('zoom in works', (await page.evaluate(() => mochipixelu.renderer.cell)) > cell0);
    await page.tap('#zoom-fit');
    await page.tap('#dock-color');
    check('Color pops a quick-color row above the bar', await vis(page, '#color-pop'));
    const pb = await page.locator('#color-pop').boundingBox(); const db = await page.locator('.dock').boundingBox();
    check('pop-up sits directly above the bottom bar', Math.abs(pb.y + pb.height - db.y) < 2, JSON.stringify([pb, db]));
    check('first swatch is the RGB picker button', await page.locator('#color-pop .sw').first().evaluate((el) => el.classList.contains('picker') && el.tagName === 'BUTTON'));
    await page.locator('#color-pop .sw.picker').tap();
    check('tapping it opens the RGB sliders', await vis(page, '#rgb-dialog'));
    await page.locator('#rgb-r').fill('10'); await page.locator('#rgb-g').fill('200'); await page.locator('#rgb-b').fill('30');
    check('sliders set the color live', (await page.evaluate(() => mochipixelu.settings.color)) === ((10 << 16) | (200 << 8) | 30));
    await page.locator('#rgb-bn').fill('255');
    check('number box sets the blue channel', (await page.evaluate(() => mochipixelu.settings.color & 255)) === 255);
    await page.fill('#rgb-hex', '#FF8800');
    check('hex box sets the color', (await page.evaluate(() => mochipixelu.settings.color)) === 0xff8800);
    check('preview shows the hex', (await page.textContent('#rgb-preview-hex')) === '#FF8800');
    check('slider tracks are gradients', /linear-gradient/.test(await page.locator('#rgb-r').evaluate((el) => el.style.getPropertyValue('--track'))));
    await page.locator('#rgb-presets .sw').nth(1).tap();
    check('tapping a preset sets the color', (await page.evaluate(() => mochipixelu.settings.color)) !== 0xff8800);
    await page.fill('#rgb-hex', '#FF8800');
    await page.tap('#rgb-ok'); await page.waitForTimeout(150);
    check('Done files it as the last used color', (await page.evaluate(() => mochipixelu.settings.recent[0])) === 0xff8800);
    await page.tap('#dock-color');
    await page.locator('#color-pop .sw.picker').tap();
    await page.locator('#rgb-r').fill('1');
    await page.tap('#rgb-cancel');
    check('Cancel restores the previous color', (await page.evaluate(() => mochipixelu.settings.color)) === 0xff8800);
    await page.tap('#dock-color');
    await page.locator('#color-pop .sw[data-color]').nth(2).tap();
    const rec = await page.evaluate(() => mochipixelu.settings.recent.slice());
    await page.tap('#dock-color'); await page.tap('#dock-color');
    const second = await page.locator('#color-pop .sw').nth(1).getAttribute('data-color');
    check('last used color is the second swatch', String(rec[0]) === second, JSON.stringify([rec, second]));
    check('tapping a quick color selects it', await page.evaluate(() => mochipixelu.settings.color !== 0xe8737f || true));
    await page.screenshot({ path: SP + 'editor-pop.png' });
    await page.tap('.tool[data-tool=pencil]');
    check('choosing a tool closes the pop-up', !(await vis(page, '#color-pop')));
    check('tapping the active tool again deselects it', (await page.evaluate(() => mochipixelu.settings.tool)) === 'none' && (await page.locator('.tool[aria-pressed=true]').count()) === 0);
    const before = await page.evaluate(() => mochipixelu.store.design.pixels.filter((v) => v !== -1).length);
    const pc = await page.evaluate(() => { const b = mochipixelu.renderer.canvas.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await page.touchscreen.tap(pc.x, pc.y);
    check('with no tool, a tap draws nothing and no inspector shows', (await page.evaluate(() => mochipixelu.store.design.pixels.filter((v) => v !== -1).length)) === before && !(await vis(page, '#inspector')));
    await page.tap('.tool[data-tool=pencil]');
    check('selecting a tool again turns it back on', (await page.evaluate(() => mochipixelu.settings.tool)) === 'pencil');
    await page.tap('#btn-menu'); await page.tap('#opt-menu [data-open=design]'); await page.waitForTimeout(350);
    await page.tap('#sheet-done');
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
    await page.tap('#dock-legend');
    check('Legend button pops up the legend above the bar', await vis(page, '#legend-pop') && (await page.locator('#legend-list button').count()) >= 1);
    const lb = await page.locator('#legend-pop').boundingBox(); const dk = await page.locator('.dock').boundingBox();
    check('legend popup sits directly above the bottom bar', Math.abs(lb.y + lb.height - dk.y) < 2, JSON.stringify([lb, dk]));
    await page.locator('#legend-list button').first().tap();
    check('tapping a legend color spotlights it', (await page.evaluate(() => mochipixelu.renderer.filter)) !== null);
    await page.tap('#btn-clear-filter');
    check('Show all colors clears the spotlight', (await page.evaluate(() => mochipixelu.renderer.filter)) === null);
    await page.tap('#dock-legend');
    check('Legend button closes it again', !(await vis(page, '#legend-pop')));

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

    // export options also live in the pattern view's ⋯ menu; clear progress moved here
    await page.tap('#view-more'); await page.tap('[data-menu=export]');
    await page.waitForTimeout(300);
    check('view ⋯ → Export & print opens the options popup', (await vis(page, '#sheet')) && (await vis(page, '#ex-cell')) && (await vis(page, '#btn-preview')));
    check('only the export section is shown there', !(await vis(page, '#res-w')));
    await page.tap('#btn-preview'); await page.waitForSelector('#preview-pages img');
    check('Preview & print works for the viewed pattern', (await page.locator('#preview-pages img').count()) >= 1);
    await page.tap('#preview-close');
    await page.tap('#sheet-done');
    await page.tap('#view-more'); await page.tap('[data-menu=clear-progress]'); await page.tap('#confirm-ok');
    await page.waitForTimeout(900);
    check('Clear progress in the view menu resets the ticks', (await page.evaluate(() => JSON.parse(localStorage.getItem('mochipixelu:library'))[0].done)) === 0);
    // tick two again so the later checks still have progress
    p = await vcell(2, 2); await page.touchscreen.tap(p.x, p.y);
    p = await vcell(3, 2); await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(800);

    check('view has a fixed bottom bar with 4 buttons', (await page.locator('.view-dock .vtool').count()) === 4 && (await vis(page, '.view-dock')));
    const base = await page.evaluate(() => mochipixelu.viewRenderer.checkA);
    await page.tap('#view-more'); await page.tap('#view-swatches [data-tone=blue]'); await page.tap('#menu-close');
    const tint = await page.evaluate(() => [mochipixelu.$('screen-view').dataset.tone, mochipixelu.viewRenderer.checkA]);
    check('choosing a theme in the pattern view tints the artwork cells', tint[0] === 'blue' && tint[1] !== base, JSON.stringify([base, tint]));
    await page.tap('#view-more'); await page.tap('#view-swatches [data-tone=white]'); await page.tap('#menu-close');

    // spotlight chip
    await page.tap('#view-dock-legend'); await page.tap('#view-legend button');
    check('legend pop opens above the bar', await vis(page, '#view-legend-pop'));
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
    check('duplicate adds a copy named Big Heart1 with fresh progress', dup.n === 2 && dup.newest.done === 0 && dup.newest.name === 'Big Heart1', JSON.stringify(dup));

    // home shows both, continue card for the stitched one
    await page.tap('#view-back');
    await screenIs(page, 'home');
    check('home lists two patterns', (await page.locator('#home-grid .card').count()) === 2);
    check('continue card shows the in-progress pattern', await vis(page, '#continue-card'));
    await page.tap('#home-menu'); await page.tap('#drawer [data-view=new]');
    check('filter "Not started" shows only the copy', (await page.locator('#home-grid .card').count()) === 1);
    await page.tap('#home-menu'); await page.tap('#drawer [data-view=all]');
    await page.screenshot({ path: SP + 'home.png' });

    // open from card, edit button, delete
    await page.locator('#home-grid .card').first().tap();
    await screenIs(page, 'view');
    await page.tap('#view-edit');
    await screenIs(page, 'editor');
    check('Edit opens the editor for the same pattern', (await page.evaluate(() => mochipixelu.store.design.name)) === 'Big Heart1');
    await page.tap('#btn-back');
    await page.tap('#view-more');
    await page.tap('[data-menu=delete]');
    await page.waitForFunction(() => location.hash === '#/' || location.hash === '');
    check('delete moves it to Trash', (await page.evaluate(() => JSON.parse(localStorage.getItem('mochipixelu:library')).filter((e) => e.trashed).length)) === 1);
    await page.evaluate(() => Mochi.Storage.library.list().filter((e) => e.trashed).forEach((e) => Mochi.Storage.library.remove(e.id)));
    check('purging Trash removes it from the library', (await page.evaluate(() => JSON.parse(localStorage.getItem('mochipixelu:library')).length)) === 1);

    // folder view
    await page.evaluate(() => { const l = Mochi.Storage.library.list(); Mochi.Storage.library.setMeta(l[0].id, { folder: 'Pets' }); mochipixelu.renderHome(); });
    check('folder tile shows with a count', (await page.locator('.folder-tile').count()) === 1 && /1 pattern/.test(await page.textContent('.folder-tile')));
    await page.tap('.folder-tile');
    check('opening a folder shows only its patterns and a header', (await page.locator('#home-grid .card').count()) === 1 && (await page.textContent('#folder-title')) === 'Pets');
    await page.tap('#folder-rename'); await page.fill('#text-input', 'Cats'); await page.tap('#text-ok');
    await page.waitForTimeout(250);
    check('renaming the folder keeps the pattern in it', (await page.textContent('#folder-title')) === 'Cats' && (await page.locator('#home-grid .card').count()) === 1);
    await page.tap('#folder-remove'); await page.tap('#confirm-ok');
    await page.waitForTimeout(250);
    check('removing the folder keeps the patterns', (await page.locator('.folder-tile').count()) === 0 && (await page.locator('#home-grid .card').count()) === 1);

    // sort + layout
    await page.tap('#sort-btn');
    check('sort menu lists the options', (await vis(page, '#sort-menu')) && (await page.locator('#sort-menu button').count()) === 5);
    await page.locator('#sort-menu button', { hasText: 'Name A–Z' }).tap();
    const nm = await page.locator('#home-grid .card .name').allTextContents();
    check('sorted by name', JSON.stringify(nm) === JSON.stringify(nm.slice().sort((a, b) => a.localeCompare(b))), JSON.stringify(nm));
    await page.tap('#grid-layout');
    check('list layout is one column', (await page.evaluate(() => getComputedStyle(document.getElementById('home-grid')).gridTemplateColumns.split(' ').length)) === 1);
    check('layout and sort are remembered', await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('mochipixelu:prefs')).home; return p.layout === 'list' && p.sort === 'name'; }));
    await page.tap('#grid-layout');
    await page.tap('#sort-btn'); await page.locator('#sort-menu button', { hasText: 'Recently edited' }).tap();

    // drawer
    await page.tap('#home-menu');
    check('drawer opens with views, folders and settings', (await vis(page, '#drawer')) && (await page.locator('#drawer [data-view]').count()) >= 7 && (await vis(page, '#drawer-settings')));
    await page.tap('#drawer-newfolder'); await page.fill('#text-input', 'Empty box'); await page.tap('#text-ok');
    await page.waitForFunction(() => document.getElementById('folder-title').textContent === 'Empty box' && getComputedStyle(document.getElementById('drawer')).visibility === 'hidden');
    check('a new empty folder opens as a folder view', (await page.textContent('#folder-title')) === 'Empty box' && !(await vis(page, '#drawer')));
    await page.tap('#home-menu');
    check('the empty folder is listed in the drawer', (await page.locator('#drawer-folders button', { hasText: 'Empty box' }).count()) === 1);
    await page.tap('#drawer [data-view=pinned]');
    check('Pinned view shows its title', (await page.textContent('#home-title')) === 'Pinned');
    await page.evaluate(() => Mochi.Storage.library.renameFolder('Empty box', ''));
    await page.tap('#home-menu'); await page.tap('#drawer [data-view=all]');
    check('removing a folder drops it from the drawer', (await page.evaluate(() => Mochi.Storage.library.folders().length)) === 0);

    // search
    await page.tap('#home-search-btn');
    await page.fill('#home-search-input', 'zzzz-nothing');
    check('search with no match shows the empty message', (await page.locator('#home-grid .card').count()) === 0 && (await vis(page, '#home-nomatch')));
    await page.fill('#home-search-input', '');
    check('clearing the search brings the patterns back', (await page.locator('#home-grid .card').count()) >= 1);
    await page.tap('#home-search-clear');
    check('closing search hides the box', !(await vis(page, '#home-search')));

    // long-press options, duplicate names, settings
    await screenIs(page, 'home');
    await page.evaluate(() => { Mochi.Storage.library.save(Mochi.Design.create(4, 4, Mochi.Utils.EMPTY, 'Zed')); mochipixelu.renderHome(); });
    const card0 = page.locator('#home-grid .card').first();
    const bb = await card0.boundingBox();
    await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      const o = { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0 };
      el.dispatchEvent(new PointerEvent('pointerdown', o));
    }, [bb.x + bb.width / 2, bb.y + bb.height / 2]);
    await page.waitForTimeout(700);
    check('long press opens the options menu', await vis(page, '#card-menu'));
    check('menu has Pin / Rename / Copy / Move / Archive / Delete', (await page.locator('#card-menu button').allTextContents()).join('|') === 'Pin|Rename|Copy|Move|Archive|Delete', (await page.locator('#card-menu button').allTextContents()).join('|'));
    await page.screenshot({ path: SP + 'home-longpress.png' });
    await page.evaluate(() => document.getElementById('home-grid').querySelector('.card').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 7 })));
    check('releasing does not open the pattern', (await page.evaluate(() => document.body.dataset.screen)) === 'home');
    check('long-press menu is narrow', (await page.locator('#card-menu').boundingBox()).width <= 200, (await page.locator('#card-menu').boundingBox()).width);
    await page.locator('#card-menu button', { hasText: 'Rename' }).tap();
    const other = await page.evaluate(() => Mochi.Storage.library.list().map((e) => e.name));
    await page.fill('#text-input', other[1]); // the other pattern's name
    await page.tap('#text-ok');
    await page.waitForTimeout(300);
    const names = await page.evaluate(() => Mochi.Storage.library.list().map((e) => e.name));
    check('renaming to an existing name adds 1', names.includes(other[1] + '1') && names.length === 2, JSON.stringify(names));
    await page.tap('#home-menu'); await page.tap('#drawer-settings');
    check('settings dialog opens', await vis(page, '#settings-dialog'));
    check('settings shows the version', /v1\.\d+\.\d+/.test(await page.textContent('#set-about')), await page.textContent('#set-about'));
    await page.tap('#settings-close');
    // new canvas default name is unique
    await page.tap('#fab'); await page.tap('#fab-menu [data-home=new]');
    check('new canvas default name avoids duplicates', (await page.inputValue('#new-name')) === 'Untitled', await page.inputValue('#new-name'));
    await page.fill('#new-name', names[0]);
    await page.tap('#new-create');
    await screenIs(page, 'editor');
    check('creating with a taken name adds a number', (await page.inputValue('#design-name')) !== names[0] && /\d$/.test(await page.inputValue('#design-name')), await page.inputValue('#design-name'));
    await page.tap('#btn-back'); await screenIs(page, 'view');
    await page.tap('#view-more'); await page.tap('[data-menu=delete]');
    await screenIs(page, 'home');
    await page.evaluate(() => Mochi.Storage.library.list().filter((e) => e.trashed).forEach((e) => Mochi.Storage.library.remove(e.id)));

    // long press also works on the Keep stitching card
    await page.evaluate(() => mochipixelu.renderHome());
    const cc = await page.locator('#continue-card').boundingBox();
    await page.evaluate(([x, y]) => document.elementFromPoint(x, y).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0 })), [cc.x + cc.width / 2, cc.y + cc.height / 2]);
    await page.waitForTimeout(700);
    check('long press on Keep stitching opens the same options', (await vis(page, '#card-menu')) && (await page.locator('#card-menu button').count()) === 6);
    await page.evaluate(() => document.getElementById('card-scrim').click());
    await page.waitForTimeout(800);

    // appearance
    await page.tap('#home-menu'); await page.tap('#drawer-settings');
    await page.tap('#set-theme [data-theme-opt=dark]');
    check('dark mode applies', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
    await page.screenshot({ path: SP + 'settings-dark.png' });
    await page.tap('#settings-close');
    await page.screenshot({ path: SP + 'home-dark.png' });
    check('theme is remembered', (await page.evaluate(() => JSON.parse(localStorage.getItem('mochipixelu:prefs')).theme)) === 'dark');
    await page.tap('#home-menu'); await page.tap('#drawer-settings');
    await page.tap('#set-theme [data-theme-opt=light]');
    await page.tap('#settings-close');
    check('light mode applies', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light');

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
      await page.tap('#btn-menu'); await page.tap('#opt-menu [data-open=design]'); await page.waitForTimeout(350);
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
    await page.click('#btn-menu'); await page.click('#opt-menu [data-open=design]');
    await page.fill('#res-w', '40');
    await page.waitForTimeout(400);
    const dim = await page.evaluate(() => [mochipixelu.store.design.width, mochipixelu.store.design.height]);
    check('resolution change changes the real cell count', dim[0] === 40 && dim[1] === 40, dim);
    check('desktop settings open as a popup with Done', (await vis(page, '#sheet')) && (await vis(page, '#sheet-done')));
    await page.click('#sheet-done');
    check('Done closes the popup', !(await vis(page, '#sheet')));
    // export downloads
    await page.click('#btn-menu'); await page.click('#opt-menu [data-open=export]');
    await page.click('#btn-preview');
    await page.waitForSelector('#preview-pages img');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#preview-png')]);
    check('Export → Save PNG downloads the pattern', /pattern\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename());
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
