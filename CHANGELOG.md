# Changelog

Versions follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

## Version legend

- fix: 1.0.0 → 1.0.1 — Bug fixes.
- feat: 1.0.0 → 1.1.0 — Backward-compatible new features.
- feat!: 1.0.0 → 2.0.0 — Breaking changes.

Examples are illustrative; the real versions are listed below. Documentation-only, test-only and refactoring changes do not automatically bump the version.

## [1.2.0] — 2026-10-23 (finalized in the working tree; not tagged or published)

Home page, project view and a cleaned-up editor layout (Batch B).

### Added
- Home page "pattern box": saved patterns as cards (thumbnail, size, colors, progress), a "Keep stitching" card, filters (All / In progress / Finished / Not started), an empty state, and a fixed bottom-right "+" speed dial (New canvas, Import image, Open file).
- Project view: tap a pattern to look at it, with an Edit button, a ⋯ menu (Rename, Duplicate with fresh progress, Preview & print, Pattern PNG, Artwork PNG, Backup file, Delete with confirmation) and color spotlight chips.
- Stitch highlight modes for crochet, cross-stitch and other pixel crafts: Look (inspect a stitch), Guide (highlight a row, a column or both; step with arrows; "Row done" ticks the row and moves on) and Tick (tap stitches off).
- Hash routes (#/, #/p/<id>, #/e/<id>) so the back button and reloads land on the right screen.
- Shared viewport module (pinch-zoom, two-finger pan, drag-to-pan) used by the editor and the project view.

### Changed
- Every pattern now lives in the library and is autosaved there while you edit; the single "autosave" slot and the manual Save / My designs dialog are gone. A 1.1.0 autosave is moved into the library on first launch.
- Editor layout: one back button, a single fixed bottom tool row with a Color button, settings behind one sliders button, zoom/move buttons floating on the canvas, grid and done-mark toggles moved into the Design panel. The canvas keeps its size when the panel opens.
- Desktop (≥ 900 px) shows a tool rail, canvas and permanent side panel; short landscape phones get a side panel instead of a sheet.
- Importing an image from the home page creates a new pattern and opens it with the resolution controls ready.

### Fixed
- Panel and dock stacking shrank the canvas to a sliver on small phones and clipped the last tab.

## [1.1.0] — 2026-10-22 (finalized in the working tree; not tagged or published)

Mobile-first rework (Batch A).

### Added
- Custom inline-SVG icon set drawn in the logo's style (cream body, brown outline, strawberry/matcha/butter pixel accents) replacing every emoji and text glyph.
- Phone layout: canvas-first screen with a fixed bottom dock (tool row + Colors/Design/Craft/Export/Files row); panels open as a bottom sheet above the dock.
- Touch gestures: two-finger pinch-zoom and pan on any tool; Move tool drags the view with one finger; a second finger landing mid-stroke cancels the stray dot.
- Auto-fit: the design stays fully in view when the sheet opens or the phone rotates, until you zoom by hand (Fit turns it back on).
- "Files" panel (import, save, saved designs, project files) and compact icon toggles for grid / done marks.

### Changed
- Desktop (≥ 900 px) is the same app widened: tool rail on the left, canvas, permanent side panel on the right; Import / Save / My designs shortcuts return to the top bar.
- The inspector's d-pad and action buttons only show on phones while the Inspect or Mark tool is active.
- Pan tool renamed "Move" and now drags with mouse and touch instead of relying on native scrolling.
- Project-file buttons moved from the Export panel to the Files panel.

### Fixed
- `setPointerCapture` could throw for a pointer that had already ended.

## [1.0.0] — 2026-10-22 (finalized in the working tree; not tagged or published)

First release.

### Added
- Image import (file picker or drag & drop) with area-averaged pixelation and transparency support.
- Live resolution control that changes the real cell count (re-pixelates from the image while untouched; resamples or crops/pads edited art).
- Color limit via median-cut quantization, applied live to untouched imports or on demand.
- Draw, Erase, Fill (region or all matching color), Pick, Inspect, Mark and Pan tools; undo/redo with per-stroke steps.
- Blank custom canvases up to 256 × 256.
- Pixel inspector with 1-based coordinates, color info, keyboard and d-pad navigation.
- Craft progress: per-stitch done marks, progress bar, per-color spotlight and counts.
- Pattern export: grid, 10-cell guides, coordinates, symbols, legend; paged print layout; pattern and artwork PNG download.
- Local persistence: autosave, “My designs” library, `.mochipixelu.json` project files.
- Responsive, mobile-friendly cozy interface; print stylesheet.
- Logic test suite (Node/browser) and optional Playwright end-to-end test.
