# Speaker Slide Generator — Gap Analysis

Tracks what the in-app slide generator currently does, what the source
prototype (`/data/BAKU-Speakers-project-1954067.zip`, the standalone Vite
app) did, and the deliberate omissions. Use this list when deciding what
to land next.

- **Ported into:** `src/components/slide-generator/`
  (`SpeakerSlideGenerator`)
- **Mounted at:**
  - `/admin/tools/slide-generator` — global scope
  - "Slide Generator" tab inside the Prepare event modal
    (`src/app/admin/events/PrepareEventModal.tsx`) — `event:<id>` scope
- **Initial commit:** `11d28bb` (2026-05-20)

## What's in place

| Capability | Notes |
|---|---|
| Six layouts | classic / centered / right-panel / split / banner / minimal — visual parity with BAKU. |
| Aspect ratios | 16:9, 1:1, 9:16, 4:3. |
| Background controls | Solid colour, gradient (two stops), or uploaded image; bottom-fade overlay slider. |
| Per-field styling | Header, name, title/company, talk description: colour, font size, font family, visibility toggle. |
| Headshot styling | Shape (circle/rounded), size, optional border + colour, fill colour. |
| Drag-to-position editor | Per-element x/y via drag (per-layout defaults) + drag-handle resize: width-only for text (sets a `wrap` flag → fixed-width wrapping box), width+height for headshot / logo / custom image (hold Ctrl or Alt to lock the
aspect ratio). Per-element *scale* was removed — the legacy `scale` field is still rendered for back-compat but no longer settable. |
| Editor zoom | Global Canva-style zoom (25–300%) via the toolbar `−/%/+` control or Ctrl/Cmd + wheel. View-only — never persisted into the template/preset. Implemented as a CSS `transform: scale()` on the slide content (so text, which is `vw`-sized, scales uniformly); the editor wrapper stays unscaled so drag overlays/handles are positioned in screen px. Export `refWidth` is decoupled from zoom (measured from an unscaled base-width element). |
| Select-to-edit | Selecting an element in "edit positions" mode opens + highlights + scrolls to its matching control in the Template sidebar. |
| Speaker editor | Name, title, company, talk title + description, headshot, company logo, Twitter / LinkedIn / website. |
| Image pipeline | Crop via existing `ImageCropperModal`; upload via `uploadFile` → R2. |
| Background removal | `@imgly/background-removal` (browser, ~40 MB model fetched on first use). Greyscale via canvas. Buttons live in `SpeakerEditModal` under the headshot. |
| Fonts | 19 Google Fonts (sans / serif / display / mono), loaded lazily via `<link>` injection. |
| PNG export | Single speaker + all-speakers loop using `html-to-image`. |
| Event seeding | Agenda items of type `speaker` auto-populate the per-event slide generator with a `Re-sync from agenda` button to pull later edits. |
| Server persistence | `SlideGeneratorState` (D1) keyed by scope (`global` or `event:<id>`). Debounced autosave on every edit. Loads cross-browser / cross-device. |
| Style preset library | `SlideStylePreset` (D1) — admin saves the current look as a named preset, applies later to any event. On apply, the event's header text is preserved but `layout_config` (including any custom positions) is reset, because positions captured for layout X don't make sense in layout Y. |
| Theming | Claude Coral (`#D4836A`) + dark palette (`#1C1917` / `#2D2926`) — matches the rest of the admin chrome. |

## Architecture notes

### Persistence
- Service: `src/lib/services/slideGenerator.ts`
- Routes (admin-only via `requireSessionUser` + `ensureAdmin`):
  - `GET /api/admin/slide-generator/state?scope=<scope>`
  - `PUT /api/admin/slide-generator/state` (body: `{ scope, data }`)
  - `GET / POST /api/admin/slide-generator/presets`
  - `GET / PATCH / DELETE /api/admin/slide-generator/presets/[id]`
- Body capped at 256 KB. Bodies are stored as opaque JSON so the
  template/speaker shape can evolve without a migration.

### Drag→absolute transition (the misalignment fix)
Older behaviour: flex layouts rendered the slide; the first drag wrote
ONE element's position to `elementPositions`; the next render switched
to absolute mode where the other three elements snapped to (different)
defaults — making everything appear to jump.

Current behaviour (`DraggableSlideEditor.freezeCurrentPositions`): on
first drag *or resize*, the editor measures the live `getBoundingClientRect`
of every visible `data-slide-el` wrapper and writes each element's position
(`x`, `y`) as slide-relative percentages into `elementPositions`. The
interacted element receives the delta; the others land exactly where they
were visually. The flex layouts stay as the source of truth for "untouched"
positioning. Reset clears `elementPositions` and returns to flex.

**Only the headshot captures a `width`/`height` footprint at freeze time.**
Text elements get `x`/`y` only — otherwise a freeze would silently turn text
into a fixed-width wrapping box. Text width is opt-in: the width resize-handle
sets `width` *and* a `wrap` flag, and the renderers only re-wrap text when
`wrap` is set, so a `width` captured by an older freeze or a built-in preset
(e.g. `CENTERED_STYLE`, which ships text widths) never retroactively re-wraps.

Three layout-specific adjustments were needed to make the freeze
measurement correct:
- **Centered header**: the wrapper used to be a full-width text-center
  container, so its bounding rect didn't match the visible text. It's
  now wrapped in `flex justify-center` with `data-slide-el` moved onto
  the shrink-to-fit inner element.
- **Split headshot**: `data-slide-el="headshot"` used to be on the 42%
  panel; it's now on the inner image container (the `inset:10%` box)
  so its rect matches the visible headshot, not the whole left half.
  The 42% panel becomes a static decoration.
- **Banner talkText**: used to render outside the `textBlock` slot;
  it's now folded into the textBlock so freezing captures the full
  text content as one unit. Visual consequence: in banner layout the
  talk text appears below the name instead of in a right column.

### Headshot size capture
For layouts whose flex headshot has a *non-default* footprint — split's
~38% × 90% image being the obvious case — `ElementPosition.width/height`
records the measured slide-relative size at freeze time. The renderers
(`PositionedHeadshotBox` in both preview and export) honour those
values so the dramatic split proportions survive the flex→absolute
switch and the PNG export.

## Deliberately not ported (yet)

### PDF export
- **BAKU had it** via `jspdf` (single PDF, one slide per page).
- **Today:** Multi-PNG download only.
- **Effort:** Add `jspdf` (~80 kB), restore `handleExportPDF` from
  BAKU `src/pages/EventWorkspace.tsx` — reuse the existing
  `renderSlideToDataURL` helper.

### "Duplicate template to new event"
- **BAKU had it:** Spawn a new event with an existing template.
- **Today:** Covered by the preset library — save current style, then
  apply it to the new event.

## Known caveats

### Seed re-sync is one-way and manual
The "Re-sync from agenda" button overwrites locally-stored
`name` / `talk_title` / `talk_description` / `headshot_url` for matching
agenda ids, but **preserves** the user-entered `title` / `company` /
socials / logo. Edits made inside the slide generator never flow back
to the agenda item.

### Cross-origin headshots in PNG export
`html-to-image` needs `crossOrigin="anonymous"` on every `<img>` to
include the bitmap. All ported `<img>` tags set it, and `/api/files/*`
served from R2 should send permissive CORS — verify once in a real
browser before relying on bulk export.

### CLAUDE.md no-img-element rule
Biome's `lint/performance/noImgElement` is set to error. Every `<img>`
in the slide generator carries a `biome-ignore` because next/image
would (a) strip `crossOrigin` and (b) refuse to render uncoded R2 URLs
without remote-pattern config. Don't lift those ignores without first
verifying export still works.

### Cognitive complexity
`SlideLayoutSplit.tsx` and `TemplatePanel.tsx` both warn for
`noExcessiveCognitiveComplexity`. They're large by nature (long JSX
trees, many controls). Refactor into smaller subcomponents if you
touch these files; otherwise leave the warning.

### Background removal model size
`@imgly/background-removal` fetches a ~40 MB ONNX model on first use
and caches it. The button shows a loading hint about the download.
The peer dep `onnxruntime-web@1.21.0` is installed explicitly so the
Cloudflare worker bundle resolves cleanly.

### Browser verification gap
Build + typecheck + Biome are green, but no one has loaded the page
in a browser yet. Open `/admin/tools/slide-generator`, create a
speaker, upload a headshot, drag elements around, export — and try
the in-modal tab on a real event — before announcing the feature.
Specific checks for this iteration:
- State persists across hard reload AND a second browser/device.
- Save status indicator in the sidebar footer flips Saving → Saved.
- Style preset save / apply / delete round-trips correctly.
- For each of the six layouts: enter "Edit positions", drag the
  header 5px — confirm none of the other elements visually move.
- "Remove bg" on a headshot in `SpeakerEditModal` — first run waits
  on the model download (loading overlay shown), result re-uploads
  to R2 and the preview swaps.
- "Greyscale" on a headshot — instant canvas op.
