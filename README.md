# Mochipixelu 🍡

A cozy, browser-based **live pixel editor and craft-pattern maker**, designed phone-first and widening into a desktop workspace. Turn any image into a real pixel grid, retouch it cell by cell, track your progress while you stitch, and print a clean chart with a legend and coordinates — for pixel art, crochet, cross-stitch, knitting, beadwork and other grid-based crafts.

Vanilla HTML, CSS and JavaScript. No frameworks, no build step, no backend, no accounts, no network calls. Everything stays on your device.

**Version:** 1.7.0 · see [CHANGELOG.md](CHANGELOG.md)

## Features

- **Import & pixelate** – choose an image (or drag it onto the page). It is area-averaged into a grid; transparent areas become empty cells.
- **Live resolution** – change width/height (16, 32, custom…) and the design genuinely gets that many cells. On an untouched import the image is re-pixelated live from the original; on edited art the cells are resampled, or cropped/padded.
- **Color limit** – cap an import to N colors (median-cut), or reduce an existing design.
- **Live editing** – Draw, Erase, Fill (region or *every* matching color), Pick, with undo/redo (Ctrl+Z / Ctrl+Y). A drag is one undo step.
- **Custom canvases** – blank canvases from 1×1 up to 256×256, empty / white / colored.
- **Pixel inspection** – hover or lock a cell to see its 1-based column/row, hex, RGB, legend number and done state; move cell by cell with the arrow keys or the on-screen d-pad.
- **Craft progress** – mark stitches done (drag to mark many, or Enter on the selected cell), see a progress bar, spotlight a single color from the legend.
- **Pattern export** – printable pages with grid, heavier line every 10 cells, row/column numbers, per-color symbols (works in black & white) and a legend with stitch counts. Large designs print as an overview plus numbered sections. Download the pattern or the plain artwork as PNG.
- **Phone-first UI** – canvas-first screen, fixed bottom dock for tools and panels, bottom-sheet settings, pinch-zoom and two-finger pan; on desktop the same app widens into a tool rail, canvas and side panel. Icons are a custom set drawn to match the logo.
- **Local saving** – autosave of the current design, a “My designs” library (browser storage) and portable `.mochipixelu.json` project files that keep colors and progress.

## Run it

No install. Open `index.html` in a modern browser (double-click works — it also works from any static server).

```bash
# optional: serve it locally
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Using it

| Task | How |
| --- | --- |
| Start from a photo | **Import image** (top bar) or drop a file on the page |
| Change resolution | **Design** panel → Width/Height or a preset (the canvas stays visible above the sheet) |
| Draw / erase / fill / pick | Tools on the left, or **B / E / G / I** |
| Inspect cells | **Q** (Inspect), arrow keys (Shift = 5 cells), **C** uses the cell's color |
| Track progress | **M** (Mark) or **Enter** on the selected cell; **Craft** tab for totals and legend |
| Move around on touch screens | Pinch to zoom and drag with two fingers (any tool), or use the **Move** tool to drag with one finger |
| Zoom | `+` / `−` buttons, slider, Ctrl+wheel, **0** or *Fit* |
| Print a pattern | **Export** panel → *Preview & print* |
| Save / open | **Files** panel (or Save / My designs in the desktop top bar) |

Coordinates are shown **1-based** (column 1, row 1 is the top-left cell) in the inspector and in patterns.

## Project layout

```
index.html            App shell
css/styles.css        Cozy handmade styling, responsive + print rules
js/utils.js           Color helpers, version, event emitter
js/state.js           Design model, grid operations (fill, resample, crop…), undo/redo store
js/palette.js         Default palette, median-cut quantizer, legend/symbols
js/pixelate.js        Image data → pixel grid (area-averaged)
js/renderer.js        Canvas renderer (grid, done marks, spotlight, selection)
js/editor.js          Tools, pointer/touch gestures + keyboard, inspector, zoom, auto-fit
js/panels.js          Design / Colors / Craft / Export panels, import, drag & drop
js/dialogs.js         Pattern preview & print, saved-designs library
js/storage.js         Autosave, library, project file (de)serialisation + validation
js/exporter.js        Pattern, legend, artwork rendering, print pages, downloads
js/main.js            Bootstrap
tests/                Logic tests (Node or browser) and optional end-to-end test
```

Scripts are plain `<script>` tags sharing a single `Mochi` namespace, so the app works straight from `file://` (ES modules would not).

## Testing

```bash
node tests/logic.test.js     # 25 pure-logic tests, no dependencies
```

Or open `tests/index.html` in a browser to run the same tests there.

The optional end-to-end test drives real Chromium (drawing, undo, fill, resolution, import, inspect, progress, export downloads, print, persistence, phone dock/sheet, pinch and pan):

```bash
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node tests/e2e.cjs
```

## Known limitations

- The imported source image is kept in memory only. After a reload the design is restored, but live re-pixelation from the photo needs the image to be imported again.
- Maximum size is 256 × 256 cells.
- Past ~70 colors the legend falls back to numbers instead of symbols.
- Touch gestures were verified with synthetic pointer events in Chromium, not on real touch hardware.
- Autosave keeps only the current design; browser storage can be cleared by the browser. Use *Save file* for backups.
- Tested in Chromium; Firefox/Safari are not yet verified.

## License

No license has been chosen yet — add one before publishing.


## What is new in 1.2.0

- **Home page** lists your saved patterns; the **+** button (bottom-right) starts a new canvas, imports an image, or opens a backup file.
- Tap a pattern to open its **project view**: Edit, Look / Guide / Tick highlight modes for stitching, color spotlight, and a ⋯ menu (rename, duplicate, print, export, delete).
- The editor has a cleaner phone layout: tools fixed at the bottom, settings in one panel.
- Patterns autosave into the library; there is no separate Save step.

## What is new in 1.3.0

- Clean flat look: line icons, borderless buttons, soft pill for the active tool.
- Tap **Color** to pop up quick colors above the bottom bar.
- The Move button is gone from the bar — use the pan button on the canvas next to zoom.
- No safe-area padding.

## What is new in 1.4.0

- Gear button on the home page opens Settings.
- Long-press a pattern card for Open / Rename / Duplicate / Delete.
- Pattern names are kept unique (Untitled1, Untitled2…).
- The editor no longer has Mark; tick stitches in the pattern view.

## What is new in 1.5.0

- Light / dark appearance in Settings.
- New modern colors.
- Pan, zoom, fit and full screen stay fixed on the canvas; panels open over them.
- Long-press a card for a native-style options menu.
- Duplicate names become name1, name2…

## What is new in 1.6.0

- The editor's ⋯ button lists Size & detail, Progress & legend, Export & print and Image & files; each opens a popup with a fixed Done button.
- The Color button's first swatch is an RGB picker; recent colors come next.

## What is new in 1.7.0

- The rainbow swatch opens R / G / B sliders so you can mix any color.
- Tap the active tool again to deselect it.
- The Fullscreen button is gone.
