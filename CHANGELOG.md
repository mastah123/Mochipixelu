# Changelog

Versions follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

## Version legend

- fix: 1.0.0 → 1.0.1 — Bug fixes.
- feat: 1.0.0 → 1.1.0 — Backward-compatible new features.
- feat!: 1.0.0 → 2.0.0 — Breaking changes.

Examples are illustrative; the real versions are listed below. Documentation-only, test-only and refactoring changes do not automatically bump the version.

## [1.25.0]

### Changed
- Legend is one sliding row, like the quick colors, with an eye button first; the "Colors" label is gone.
- The eye shows/hides the symbols on the canvas. Symbols now stay on whenever the eye is on, even with the legend closed. The eye state is remembered (default on). This reverses 1.23.0.
- Tapping the active legend chip again clears the spotlight.

## [1.24.0] — 2026-10-29 (finalized in the working tree; not tagged or published)

### Changed
- Editor: only one bottom button is open at a time. Opening Color or Legend releases the drawing tool (and closes the other row); choosing a tool closes both rows. Picking a color closes the row and brings the last drawing tool back, so you can keep drawing.
- Pattern view: the guide controls are shorter (compact segmented control and stepper).
- Pattern view: the Fit button moved from the top-right to the bottom-right of the canvas, like the editor's.

## [1.23.0] — 2026-10-29 (finalized in the working tree; not tagged or published)

### Fixed
- Pattern view: with no mode selected (after opening the legend or releasing a mode) a tap did nothing, so the stitch details could not be seen. A tap now always shows the stitch details; Guide and Tick still add their own action.
- Editor: with no tool selected a tap (not a drag) now shows that stitch's details above the canvas and outlines it; a drag still pans.

### Changed
- The legend's button is now **Hide on canvas / Show on canvas** and controls the legend symbols drawn inside the canvas cells (editor and pattern view). The legend chips stay as they are. Symbols appear while the legend is open (cells at least 10 px wide), in the readable text color of each cell.

## [1.22.0] — 2026-10-27 (finalized in the working tree; not tagged or published)

### Changed
- The pattern view's ⋯ menu is a popup under the button, like the editor's (it was a dialog): Theme swatches, then Pin, Rename, Copy, Move, Archive, Export, Save backup, Clear progress and Delete (to Trash), with an "Edited …" footer. Tapping ⋯ again, outside the popup or Escape closes it; picking a theme keeps it open.

## [1.21.0] — 2026-10-27 (finalized in the working tree; not tagged or published)

### Changed
- Pattern view bottom bar: the buttons are now the same height as the editor's; they release each other — picking a mode closes the legend, opening the legend releases the mode, and tapping the active mode releases it (with no mode a tap does nothing; dragging still moves the view).
- The legend's Hide / Show button now folds only the color chips (editor and pattern view); the Legend button and the legend header stay.
- The selected-stitch line (pattern view and editor) has one fixed height, with or without a selection, so nothing shifts.
- Helper labels ("Tap a stitch to see…", "tap to spotlight", "Tap the pattern to place the guide…") were removed.
- The pan, zoom-in and zoom-out buttons were removed from the pattern view and the editor; only Fit is left. Pinch to zoom and one-finger drag (with no tool selected) still move the canvas.

## [1.20.0] — 2026-10-27 (finalized in the working tree; not tagged or published)

### Changed
- Editor: the Inspect tool and its strip (arrow pad, Use color) are gone. The stitch under the finger (or the last one touched) shows as one line above the canvas, like in the pattern view.
- Editor: the legend is the pattern view's legend — color chips with symbol and count, tap to spotlight, Hide button — docked below the canvas (a floating card beside the rail on desktop and landscape phones) instead of a popup.
- Editor: the six dock buttons sit in one aligned, equal row.

## [1.19.0] — 2026-10-26 (finalized in the working tree; not tagged or published)

### Fixed
- Picking a color in the legend made light colors hard or impossible to see: the other cells were covered with a very pale veil, so a light spotlighted color disappeared into it. Now the other cells get a darker mid-tone veil and the spotlighted cells get a dark-and-white double outline, so any color (light or dark) stands out. Legend swatches have a firmer border so light colors are visible there too.

## [1.18.0] — 2026-10-26 (finalized in the working tree; not tagged or published)

### Fixed
- A zoomed canvas could not be panned to its top and left edges (centering clipped them). The editor and the pattern view now centre safely; when zoomed there is extra room below so the bottom is never stuck under the bars or buttons.

### Changed
- Pattern view: the guide controls and the colors legend are part of the bottom area (not floating over the canvas); the canvas re-fits to the space left. The Legend button toggles show/hide and the legend has its own Hide button.
- The bottom bar buttons are smaller.

## [1.17.0] — 2026-10-26 (finalized in the working tree; not tagged or published)

### Changed
- The dotted backgrounds are gone everywhere (pattern cards, editor and view canvas surrounds).
- The pattern view no longer shows the size chip over the canvas or the "No stitch selected" card. The selected stitch is a single line below the progress bar (empty until a stitch is selected), so nothing covers the artwork.

## [1.16.0] — 2026-10-26 (finalized in the working tree; not tagged or published)

### Added
- Home "Folders" section: coloured folder tiles (name and pattern count), "Show all" past two folders, and a list/grid toggle.
- "Recent patterns" section header with a sort button (Recently edited, Oldest first, Name A–Z, Most progress, Largest) and a list/grid toggle for the patterns. Pinned patterns stay first. Sort and layouts are remembered on the device.

### Changed
- The "My patterns" heading and pattern-count chip were replaced by these section headers.

## [1.15.0] — 2026-10-26 (finalized in the working tree; not tagged or published)

### Added
- Side drawer from the menu button (a permanent left rail on desktop): All patterns, Pinned, Archive, Trash and Settings with counts; a Folders list (first four, Show all / Show less) with "+ New folder"; and Progress views (In progress, Finished, Not started). The heading above the patterns follows the chosen view.
- Folders can now be created empty and stay until removed (`Storage.library.addFolder`).

### Changed
- The filter chips under "My patterns" were removed; their views live in the drawer. Settings moved into the drawer.

## [1.14.0] — 2026-10-26 (finalized in the working tree; not tagged or published)

### Changed
- Home top bar: a menu button on the left (opens Settings until the side drawer arrives) and a search button on the right; the logo header and gear are gone. Search filters patterns by name.
- "Continue stitching" is now a large banner card (label, pattern name, progress, thumbnail on the right) in place of the planned "Your space" card; it shows on the All view only.
- The + button is an extended "+ New pattern" button; it still opens the same speed dial.

## [1.13.0] — 2026-10-26 (finalized in the working tree; not tagged or published)

### Changed
- The pattern view has a fixed bottom bar (Look, Guide, Tick, Legend). The guide controls, the selected-stitch line and the color legend float above it, so the canvas never resizes; zoom and fit buttons moved to the top-right of the canvas. The progress bar sits above the canvas.
- A pattern's theme now tints the artwork surface too: empty cells of the canvas (editor and pattern view), the canvas surround and the bottom bars.

## [1.12.0] — 2026-10-26 (finalized in the working tree; not tagged or published)

### Added
- Folder view on the home page: a tile for each folder with its pattern count. Tapping one opens it with a back button, Rename and Remove (removing keeps the patterns). Folder chips were replaced by these tiles.
- `Storage.library.renameFolder` (rename or dissolve a folder, trashed patterns included).

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
