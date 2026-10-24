# Project context — Mochipixelu

_Last updated: 2026-10-23 · Version 1.6.0 (working tree; no git repo yet, nothing committed, pushed or published) · Batches A and B done, see "Pending changes"_

## What it is
Browser-based pixel editor and craft-pattern maker. Vanilla HTML/CSS/JS, no build, no deps, no network. See README.md for features and usage.

## Status
All concept features are implemented and verified in headless Chromium: import/pixelate, live resolution, custom canvases, editing tools, inspection, progress tracking, pattern export/print, local saving.

## Architecture
- Plain `<script>` tags (order in `index.html` matters), one global namespace `Mochi`; works from `file://`.
- **Model** (`state.js`): design = `{name,width,height,pixels:Int32Array,done:Uint8Array}`; pixel = `0xRRGGBB` or `-1` (EMPTY). 0-based internally, **1-based in UI/patterns**. `createStore()` holds design + optional in-memory `source` image + `pristine` flag + snapshot undo/redo; events `change`, `replace`, `history`.
- **Pristine rule:** `pristine` is true while the grid is an untouched pixelation of `source`. Then resolution/color-limit changes re-pixelate from the image; otherwise they resample/crop the drawn cells. Progress-only edits keep it (`touch({keepPristine:true})`).
- **Pure logic** (`utils`, `state`, `palette`, `pixelate`, `storage` serialisation) has no DOM dependency and is what `tests/logic.test.js` covers in Node.
- **UI**: `renderer.js` (canvas, per-cell redraw), `editor.js` (tools/input/zoom/inspector), `panels.js` (side panels, import, drag & drop), `dialogs.js` (preview/print, library), `exporter.js` (pattern/legend/art canvases, paging, downloads), `main.js` (bootstrap, autosave, legend cache, toast).
- `app` object (created in `main.js`, exposed as `window.mochipixelu`) is the shared handle: `store, renderer, settings, ui (emitter), getLegend(), toast(), setTool/setColor/select/setZoom/fit/...`.
- Storage keys: `mochipixelu:autosave`, `mochipixelu:library`, `mochipixelu:project:<id>`, `mochipixelu:prefs`. File format `{format:'mochipixelu', version:1, palette, data(indices), done(indices)}`; deserialisation validates everything.

## Important decisions
- No ES modules (so `file://` works) and no tooling in the app itself; tests are optional.
- Pixelation is manual area averaging (alpha-weighted), not canvas downscaling, so results are exact and testable.
- Canvas side is capped at 4096 px (cell size auto-limited); pattern export caps similarly.
- Touch: drawing tools capture touch (`touch-action:none`); the Pan tool re-enables native scrolling.
- Version single source: `Mochi.Utils.VERSION`; a Node test asserts it matches the top CHANGELOG entry.

## Known issues / limitations
- Source image is not persisted: after reload, live re-pixelation requires re-importing the image.
- Max 256×256; legend falls back to numbers beyond ~70 colors.
- Touch gestures only verified with synthetic events; shortcuts are ignored while a text/number field has focus (Ctrl+Z then undoes the field, use the ↶ button).
- Only Chromium verified. Real printer output not verified.
- No license chosen.

## Pending changes (requested by the owner)
Owner's note ("mochipixelu changes"): queue changes, implement **in batches (my call)**, **mobile-first** with the layout adapting to desktop.

1. ✅ Icons/buttons match the logo, not AI-looking — **done in 1.1.0** (custom SVG sprite in `index.html`, no emoji).
2. ⏳ **Home page** listing saved projects; selecting one opens a **view** screen with Edit, a crafting **highlight** mode (pixel highlighting for cross-stitch/crochet/other pixel crafts), Delete and more (my call: Duplicate, Rename, Export file/PNG, Print) — **Batch B, not started**.
3. ⏳ Home page has a **"+" button fixed bottom-right** — **Batch B, not started**.
4. ✅/⚠ Mobile-friendly pixel area with buttons fixed at the bottom — **done in 1.1.0**, but the owner's layout screenshot ("copy the screenshot layout") was **never received**; the dock layout is my own design. If a reference screenshot arrives, compare and adjust.

**Batch B plan (proposed 1.2.0):** hash routing (`#/`, `#/project/<id>`, `#/edit/<id>`), project cards from the existing library (`Storage.library`), fixed "+" (new project / import), view screen with Edit / Highlight / Delete / Duplicate / Rename / Export / Print, stitch-highlight mode building on the existing spotlight + done marks (highlight current row/column, tap to tick). Data format stays compatible. The top bar will gain a back-to-home button; the Files panel's save/open actions may fold into the home page.

## Layout notes (1.1.0)
- `.workspace` order is stage → sheet → dock (flex column on phones). ≥ 900 px it becomes a grid: dock (tool rail) | stage | sheet (permanent panel).
- Sheet = `#sheet.open` (phones). Tabs: design, colors, craft, export, files. `app.openSheet(tab)` / `app.closeSheet()`; the nav-row buttons toggle it. On desktop `openSheet` just switches tab.
- `app.autoFit` + ResizeObserver keep the design fitted until a manual zoom; `app.fit()` re-enables.
- Touch: `touch-action:none` on the canvas; `editor.js` implements pinch/two-finger pan and the Move tool. Icons: `<svg class="ic"><use href="#i-name"/></svg>` from the sprite at the top of `index.html`.

## Next steps (ideas)
- Persist a downsized source so re-pixelation survives reloads.
- Rectangle/line/mirror tools, dithering option, thread-brand (DMC) color matching.
- Row-by-row "current row" highlight for knitting/crochet.
- Firefox/Safari verification; `git init` + choose a license.

## How to test
`node tests/logic.test.js` (25 tests). Optional: `PLAYWRIGHT_MODULE=/path/to/playwright node tests/e2e.cjs` (desktop + phone checks).


## 1.2.0 notes
- Screens: home (`js/home.js`), project view (`js/view.js`), editor (`js/editor.js` + `js/panels.js`); routing in `js/router.js`; shared pan/zoom in `js/viewport.js`.
- The library (localStorage) is the single source of projects; the editor autosaves into it (600 ms debounce, flushed on leave/hide). The old Save / My designs dialog is gone.
- Item 4 of the owner's note: the reference screenshot was never received; layout is my own design. Compare if it arrives.
- Verified only in headless Chromium with synthetic touch; not on a real device.

## 1.3.0 notes
- Reference screenshot for item 4 was received (MochiNote): flat icons, top bar with back/undo/redo/menu, pop-up row above a bottom bar. 1.3.0 follows it. Styling lives in the "CLEAN THEME" block at the end of css/styles.css.
- Safe-area padding intentionally removed at the owner's request.

## 1.4.0 notes
- Name uniqueness lives in `Storage.library.uniqueName`; the editor autosave passes `keepName` so names are only fixed when the name field loses focus.
- Long press is a 480 ms timer on card pointerdown (+ contextmenu for mouse).

## 1.5.0 notes
- Theme: CSS variables in `:root` (light) and `:root[data-theme="dark"]`; `app.applyTheme()` in main.js; an inline script in index.html sets the theme before paint.
- `#color-pop` is a pop-up row above the bottom bar (phones). On phones the sheet and inspector are overlays; `--dock-h` is set by a ResizeObserver so the sheet rests on the bar.

## 1.6.0 notes
- `#sheet` is now a modal-style popup (fixed, bottom card on phones, centered ≥600 px) with `#sheet-done`; opened from `#opt-menu` via `app.openSheet(name)`. No tabs; no Colors panel.
- `#color-pop` is built in `fillPop()` in panels.js: picker → `settings.recent` → default palette.
