# Changelog

Versions follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

## Version legend

- fix: 1.0.0 → 1.0.1 — Bug fixes.
- feat: 1.0.0 → 1.1.0 — Backward-compatible new features.
- feat!: 1.0.0 → 2.0.0 — Breaking changes.

Examples are illustrative; the real versions are listed below. Documentation-only, test-only and refactoring changes do not automatically bump the version.

## [1.11.0] — 2026-10-26 (finalized in the working tree; not tagged or published)

### Changed
- The long-press menu is narrow (about 190px) and lists Pin, Rename, Copy, Move, Archive, Delete. Open was dropped (tapping the card opens it). Copy = duplicate with fresh progress; Move opens the folder picker; Delete moves to Trash (Trash keeps Restore and Delete forever).

## [1.10.0] — 2026-10-26 (finalized in the working tree; not tagged or published)

### Added
- The pattern view's ⋯ menu now has the same Theme swatches, Pin, Move to folder… and Archive as the editor menu.

### Changed
- "Delete pattern" in the pattern view is now "Move to Trash" (no confirmation; restore from the Trash tab).

## [1.9.0] — 2026-10-25 (finalized in the working tree; not tagged or published)

### Added
- The editor's ⋯ menu was redesigned: a **Theme** row of six swatches (white, yellow, green, blue, pink, lavender), then Size & detail / Export & print / Image & files, then **Pin**, **Move to folder…**, **Archive** and **Move to Trash**, and a footer line ("Edited just now · 32 × 32").
- A pattern's theme tints its card and the "Keep stitching" card on the home page, and the editor and pattern view while it is open.
- Pinned patterns sort first (pin icon on the card). Folders appear as filter chips on the home page; Archive and Trash are filters too. Trash can restore a pattern or delete it forever.
- Long-press menu on cards now also offers Pin, Move to folder…, Archive and Move to Trash.

### Changed
- Menu icons use a thinner line (1.6) and new simple pin / folder / archive / restore icons. Delete moved to Trash first (undoable); "Delete forever" is in Trash.
- The theme, pin, folder, archive and trash flags live on the library entry; the project file format is unchanged.

## [1.8.2] — 2026-10-25 (finalized in the working tree; not tagged or published)

### Changed
- The RGB color dialog now follows the owner's reference: a preview bar showing the hex code, gradient R / G / B sliders (each track shows the color along that channel and updates as you drag), number boxes, a hex field (#RRGGBB), round presets (recent colors first, then the palette) and Cancel / Use color buttons. It compacts on short phones so both buttons stay on screen. Light and dark themes both supported.

## [1.8.1] — 2026-10-24 (finalized in the working tree; not tagged or published)

### Fixed
- Deselecting the Inspect tool left the inspector strip (and its selected cell) on screen. The inspector now shows only while Inspect is the active tool, on phones and on desktop; leaving Inspect clears its selection. With no tool selected, dragging only moves the view (a tap no longer selects a cell).

### Added
- Long press (or right click) on the "Keep stitching" card opens the same options as the pattern cards: Open, Rename, Duplicate, Delete.

### Changed
- Export & print is one full-width **Export** button. It shows the pages first; the preview now has **Save PNG** and **Print**. (Pattern PNG and Preview & print buttons merged.)

## [1.8.0] — 2026-10-24 (finalized in the working tree; not tagged or published)

Batch D of the owner's 2026-10-24 list.

### Added
- Legend button in the bottom bar: a popup above the bar lists every color with its symbol, number and stitch count; tap one to spotlight it, "Show all colors" clears it.
- Pattern view ⋯ menu: **Export & print…** opens the same options popup as the editor (cell size, colors, symbols, numbers, ticks, Preview & print, Pattern PNG, Artwork image) for the pattern being viewed, and **Clear progress** (with a confirm).

### Changed
- The settings popup now lives at page level so both the editor and the pattern view use it. The pattern view's separate Preview / PNG menu entries are replaced by Export & print….
- Editor ⋯ menu: Size & detail, Export & print, Image & files.

### Removed
- Progress from the editor (progress bar, text and Clear progress button) and the editor's "Progress & legend" section. Progress is shown and managed in the pattern view.

## [1.7.0] — 2026-10-24 (finalized in the working tree; not tagged or published)

Batch C of the owner's 2026-10-24 list.

### Fixed
- The rainbow swatch in the color row did not let you choose an RGB color on a phone. It now opens the app's own dialog with Red / Green / Blue sliders, number boxes and a hex field; the color applies live, Done keeps it (and files it under "last used"), Cancel restores the previous color. It no longer depends on the phone's native color dialog.

### Added
- Tapping the active tool in the bottom bar deselects it, like the Color button. With no tool, nothing is drawn: one-finger drag moves the view and a tap selects a cell.

### Removed
- The Fullscreen button (editor canvas buttons and pattern view) and its code.

## [1.6.0] — 2026-10-24 (finalized in the working tree; not tagged or published)

### Changed
- Editor top-right is now a three-dots button. It opens a small menu with a button for each section — Size & detail, Progress & legend, Export & print, Image & files — and each opens as its own popup with a Done button fixed under the scrolling content (bottom card on phones, centered on wider screens). On desktop the permanent side panel is replaced by the same popups.
- Color button row: the first swatch is the RGB picker (the phone's own color dialog), then the most recently used colors (newest first), then the default palette. On desktop the row opens beside the tool rail.

### Removed
- The Colors section of the settings (current color, hex field, palette, recent and design colors). The Fill tool's "recolor every matching cell" option moved into Size & detail.
- The "More" button in the color row.

## [1.5.1] — 2026-10-24 (finalized in the working tree; not tagged or published)

### Fixed
- Pan, zoom, fit and full-screen buttons are back on the canvas and stay fixed in place. Opening the settings panel, the color row or the inspector no longer moves them or resizes / re-fits the canvas; the panels now float over the canvas (and over those buttons) like the color row does.

### Changed
- Removed the "View" button and its pop-up row from 1.5.0 (it moved the controls away from the canvas, which was not what was asked for). The bottom bar is back to six tools plus Color.
- On phones the inspector strip also floats over the bottom of the canvas instead of pushing it.

## [1.5.0] — 2026-10-23 (finalized in the working tree; not tagged or published)

### Added
- Appearance setting (Home → gear): System, Light or Dark. The choice is remembered and applied before the page paints.
- View button in the editor's bottom bar: a row pops up above the bar (like Color) with Pan, Zoom out, current zoom, Zoom in, Fit and Full screen. It stays open while you work. Full screen also on the project view and desktop canvas (browsers without the Fullscreen API show a message).

### Changed
- New modern color design: cool violet-grey surfaces with one indigo accent, tinted pattern cards, a system font stack, softer shadows; dark palette to match. The canvas cells stay neutral in both themes so patterns read the same.
- Long-press options now look like a native sheet: the pressed card gets an accent ring and a rounded menu (title, Open, Rename, Duplicate, Delete) appears under it (above it when there is no room).
- Name numbering: a taken name gets the next free number added — Heart → Heart1 → Heart2 — and duplicating a pattern names the copy the same way (no more " copy"). Blank names still become Untitled, Untitled1…
- The floating pan / zoom / fit buttons are gone on phones (they covered the canvas); desktop keeps them.

## [1.4.0] — 2026-10-23 (finalized in the working tree; not tagged or published)

### Added
- Home settings menu (gear button): open a backup file, delete all patterns (with confirmation), and an about line with version, pattern count and storage used.
- Long-press (touch) or right-click (mouse) on a pattern card opens an options stack in the same style as the + button: Open, Rename, Duplicate, Delete.
- Unique pattern names: an empty or already-used name (case-insensitive) becomes Untitled, then Untitled1, Untitled2… on create, import, rename, duplicate and when leaving the name field in the editor.

### Changed
- Editing and ticking stitches are separate jobs: the editor no longer has the Mark tool (and its M shortcut), the inspector "Done" button, Enter-to-tick, "Mark all done", or done/to-do text. Ticking happens in the project view (Guide / Tick modes). "Clear progress" and the progress bar remain in the Craft panel.
- Bottom tool bar has six tools plus Color.

## [1.3.0] — 2026-10-23 (finalized in the working tree; not tagged or published)

Clean look, following the owner's reference screenshot.

### Added
- Quick-color row that pops up directly above the bottom bar when you tap Color (recent, design and palette colors, plus a More button for the full Colors panel).

### Changed
- Flat, single-color line icons (the logo mascot keeps its colors); borderless buttons; the active item is a soft pink pill instead of a boxed, shadowed button. Applies to the home page, project view, editor, panels and dialogs.
- Removed all safe-area padding (top and bottom) and `viewport-fit=cover`; bars now sit flush with the screen edges.
- The Move tool is removed from the bottom bar. The pan button on the canvas (next to zoom) replaces it, now on desktop too; the H shortcut still works.

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
