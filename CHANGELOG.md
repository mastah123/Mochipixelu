# Changelog

Versions follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

## Version legend

- fix: 1.0.0 → 1.0.1 — Bug fixes.
- feat: 1.0.0 → 1.1.0 — Backward-compatible new features.
- feat!: 1.0.0 → 2.0.0 — Breaking changes.

Examples are illustrative; the real versions are listed below. Documentation-only, test-only and refactoring changes do not automatically bump the version.

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
