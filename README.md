# Mochipixelu 🍡

A cozy, browser-based **live pixel editor and craft-pattern maker**. Turn any image into a real pixel grid, retouch it cell by cell, track your progress while you stitch, and print a clean chart with a legend and coordinates — for pixel art, crochet, cross-stitch, knitting, beadwork and other grid-based crafts.

Vanilla HTML, CSS and JavaScript. No frameworks, no build step, no backend, no accounts, no network calls. Everything stays on your device.

**Version:** 1.0.0 · see [CHANGELOG.md](CHANGELOG.md)

## Features

- **Import & pixelate** – choose an image (or drag it onto the page). It is area-averaged into a grid; transparent areas become empty cells.
- **Live resolution** – change width/height (16, 32, custom…) and the design genuinely gets that many cells. On an untouched import the image is re-pixelated live from the original; on edited art the cells are resampled, or cropped/padded.
- **Color limit** – cap an import to N colors (median-cut), or reduce an existing design.
- **Live editing** – Draw, Erase, Fill (region or *every* matching color), Pick, with undo/redo (Ctrl+Z / Ctrl+Y). A drag is one undo step.
- **Custom canvases** – blank canvases from 1×1 up to 256×256, empty / white / colored.
- **Pixel inspection** – hover or lock a cell to see its 1-based column/row, hex, RGB, legend number and done state; move cell by cell with the arrow keys or the on-screen d-pad.
- **Craft progress** – mark stitches done (drag to mark many, or Enter on the selected cell), see a progress bar, spotlight a single color from the legend.
- **Pattern export** – printable pages with grid, heavier line every 10 cells, row/column numbers, per-color symbols (works in black & white) and a legend with stitch counts. Large designs print as an overview plus numbered sections. Download the pattern or the plain artwork as PNG.
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
| Change resolution | **Design** tab → Width/Height or a preset |
| Draw / erase / fill / pick | Tools on the left, or **B / E / G / I** |
| Inspect cells | **Q** (Inspect), arrow keys (Shift = 5 cells), **C** uses the cell's color |
| Track progress | **M** (Mark) or **Enter** on the selected cell; **Craft** tab for totals and legend |
| Pan on touch screens | **Pan** tool (✋) — other tools capture touch so drawing doesn't scroll the page |
| Zoom | `+` / `−` buttons, slider, Ctrl+wheel, **0** or *Fit* |
| Print a pattern | **Export** tab → *Preview & print* |

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
js/editor.js          Tools, pointer + keyboard input, inspector, zoom
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

The optional end-to-end test drives real Chromium (drawing, undo, fill, resolution, import, inspect, progress, export downloads, print, persistence, mobile):

```bash
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node tests/e2e.cjs
```

## Known limitations

- The imported source image is kept in memory only. After a reload the design is restored, but live re-pixelation from the photo needs the image to be imported again.
- Maximum size is 256 × 256 cells.
- Past ~70 colors the legend falls back to numbers instead of symbols.
- Touch: no pinch-to-zoom yet (use the zoom controls); use the Pan tool to scroll large canvases.
- Autosave keeps only the current design; browser storage can be cleared by the browser. Use *Save file* for backups.
- Tested in Chromium; Firefox/Safari are not yet verified.

## License

No license has been chosen yet — add one before publishing.
