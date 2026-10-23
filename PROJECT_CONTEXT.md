# Project context — Mochipixelu

_Last updated: 2026-10-22 · Version 1.0.0 (working tree; no git repo yet, nothing committed, pushed or published)_

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
- No pinch zoom; shortcuts are ignored while a text/number field has focus (Ctrl+Z then undoes the field, use the ↶ button).
- Only Chromium verified. Real printer output not verified.
- No license chosen.

## Next steps (ideas)
- Persist a downsized source so re-pixelation survives reloads.
- Pinch-zoom, rectangle/line/mirror tools, dithering option, thread-brand (DMC) color matching.
- Row-by-row "current row" highlight for knitting/crochet.
- Firefox/Safari verification; `git init` + choose a license.

## How to test
`node tests/logic.test.js` (25 tests). Optional: `PLAYWRIGHT_MODULE=/path/to/playwright node tests/e2e.cjs` (36 checks).
