/**
 * Slide-generator types. Mirrors the BAKU "Template" / "Speaker" shapes but
 * locally-defined so the component is portable and persistence-agnostic.
 *
 * Snake_case is intentional — it matches the BAKU originals so the ported
 * layout code reads unchanged.
 */

export type AspectRatio = "16:9" | "1:1" | "9:16" | "4:3";

export interface SlideConfig {
  aspectRatio: AspectRatio;
  width: number;
  height: number;
}

export const ASPECT_RATIOS: Record<AspectRatio, SlideConfig> = {
  "16:9": { aspectRatio: "16:9", width: 1920, height: 1080 },
  "1:1": { aspectRatio: "1:1", width: 1080, height: 1080 },
  "9:16": { aspectRatio: "9:16", width: 1080, height: 1920 },
  "4:3": { aspectRatio: "4:3", width: 1440, height: 1080 },
};

export type LayoutPreset =
  | "bottom-left"
  | "centered"
  | "right-panel"
  | "split"
  | "banner"
  | "minimal";

export interface LayoutInfo {
  id: LayoutPreset;
  label: string;
  description: string;
}

export const LAYOUT_PRESETS: LayoutInfo[] = [
  { id: "bottom-left", label: "Classic", description: "Speaker info at bottom-left" },
  { id: "centered", label: "Centered", description: "Everything centered with large headshot" },
  { id: "right-panel", label: "Right Panel", description: "Content on the right side" },
  { id: "split", label: "Split", description: "Headshot left, text right" },
  { id: "banner", label: "Banner", description: "Horizontal strip at bottom" },
  { id: "minimal", label: "Minimal", description: "Clean text-only focus" },
];

export interface ElementPosition {
  x: number; // percentage 0-100 from left (top-left corner)
  y: number; // percentage 0-100 from top
  /**
   * Legacy per-element scale. No longer settable in the editor (the
   * resize-handles replaced it), but still honoured by the renderers so
   * templates / presets saved before the change keep their appearance.
   */
  scale?: number;
  /**
   * Optional measured size in slide-% units, captured during freezing.
   * Used so layouts like "split" — where the flex headshot fills ~38% of the
   * slide width — keep their dramatic sizing when transitioning to absolute
   * positioning. If omitted, renderers fall back to their default sizing.
   */
  width?: number; // percentage 0-100
  height?: number; // percentage 0-100
  /**
   * Text elements only: when true, the element renders as a fixed-width box
   * (`width` above) and wraps its text instead of staying on one line. Set by
   * the width resize-handle. Gated behind this flag so a `width` captured by an
   * older freeze / built-in preset doesn't retroactively re-wrap existing text.
   */
  wrap?: boolean;
}

export type DraggableElementKey =
  | "header"
  | "eventDate"
  | "headshot"
  | "name"
  | "subtitle"
  | "talk"
  | "social"
  | "logo";

export interface ElementPositions {
  header?: ElementPosition;
  eventDate?: ElementPosition;
  headshot?: ElementPosition;
  /** Kept as an optional legacy field so migration can read it on load. */
  textBlock?: ElementPosition;
  name?: ElementPosition;
  subtitle?: ElementPosition;
  talk?: ElementPosition;
  social?: ElementPosition;
  logo?: ElementPosition;
}

export interface LayoutConfig {
  contentOffsetX?: number;
  contentOffsetY?: number;
  elementPositions?: ElementPositions;
}

export const LAYOUT_DEFAULT_POSITIONS: Record<
  LayoutPreset,
  Record<DraggableElementKey, ElementPosition>
> = {
  "bottom-left": {
    header: { x: 5, y: 6 },
    eventDate: { x: 5, y: 12 },
    headshot: { x: 5, y: 56 },
    name: { x: 22, y: 64 },
    subtitle: { x: 22, y: 72 },
    talk: { x: 22, y: 78 },
    social: { x: 22, y: 88 },
    logo: { x: 88, y: 76 },
  },
  centered: {
    header: { x: 25, y: 5 },
    eventDate: { x: 35, y: 12 },
    headshot: { x: 27, y: 16 },
    name: { x: 10, y: 56 },
    subtitle: { x: 10, y: 66 },
    talk: { x: 10, y: 72 },
    social: { x: 10, y: 82 },
    logo: { x: 45, y: 82 },
  },
  "right-panel": {
    header: { x: 55, y: 6 },
    eventDate: { x: 55, y: 12 },
    headshot: { x: 55, y: 20 },
    name: { x: 50, y: 50 },
    subtitle: { x: 50, y: 60 },
    talk: { x: 50, y: 66 },
    social: { x: 50, y: 76 },
    logo: { x: 72, y: 82 },
  },
  split: {
    header: { x: 46, y: 28 },
    eventDate: { x: 46, y: 34 },
    headshot: { x: 0, y: 0 },
    name: { x: 46, y: 42 },
    subtitle: { x: 46, y: 52 },
    talk: { x: 46, y: 58 },
    social: { x: 46, y: 68 },
    logo: { x: 15, y: 86 },
  },
  banner: {
    header: { x: 25, y: 5 },
    eventDate: { x: 35, y: 12 },
    headshot: { x: 5, y: 72 },
    name: { x: 20, y: 72 },
    subtitle: { x: 20, y: 80 },
    talk: { x: 20, y: 86 },
    social: { x: 20, y: 92 },
    logo: { x: 88, y: 76 },
  },
  minimal: {
    header: { x: 8, y: 6 },
    eventDate: { x: 8, y: 12 },
    headshot: { x: 8, y: 32 },
    name: { x: 8, y: 56 },
    subtitle: { x: 8, y: 66 },
    talk: { x: 8, y: 72 },
    social: { x: 8, y: 82 },
    logo: { x: 8, y: 85 },
  },
};

export type TextAlignment = "left" | "center" | "right" | "justify";

/**
 * Keys of the standard draggable elements whose text alignment is user-
 * controllable. `headshot` and `logo` are image-only and excluded.
 */
export type TextAlignableKey = "header" | "eventDate" | "name" | "subtitle" | "talk" | "social";

export const LAYOUT_TEXT_ALIGN: Record<LayoutPreset, TextAlignment> = {
  "bottom-left": "left",
  centered: "center",
  "right-panel": "right",
  split: "left",
  banner: "left",
  minimal: "left",
};

/**
 * Per-layout multiplier applied to the speaker-name font size. Lets each
 * layout make the name visually dominant without each one hardcoding its own
 * clamp() values. Read by the layout components AND by the positioned
 * renderers in SlidePreview so the name stays the same size when the user
 * drags an element and the layout switches from flex to absolute.
 */
export const LAYOUT_NAME_SCALE: Record<LayoutPreset, number> = {
  "bottom-left": 1,
  centered: 1.2,
  "right-panel": 1,
  split: 1.1,
  banner: 1,
  minimal: 1.6,
};

export type BackgroundType = "color" | "gradient" | "image";
export type HeadshotShape = "circle" | "rounded";

/**
 * Extra slide elements (sponsor logos, venue tags, etc.) defined at the
 * template level and rendered on every speaker's slide. Always absolutely
 * positioned — they have no flex layout to fall back to.
 */
export interface CustomTextElement {
  id: string;
  type: "text";
  text: string;
  color: string;
  /** Base font size in px (same convention as header_font_size). */
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  /** Defaults to "left" when omitted. */
  textAlign?: TextAlignment;
  position: ElementPosition;
}

export interface CustomImageElement {
  id: string;
  type: "image";
  /** R2 URL (via /api/files/<key>). */
  url: string;
  alt?: string;
  position: ElementPosition;
}

export type CustomElement = CustomTextElement | CustomImageElement;

/**
 * Font-weight options the UI exposes for custom text elements. Kept narrow
 * so we don't ship weights most fonts don't actually have.
 */
export const CUSTOM_TEXT_FONT_WEIGHTS: number[] = [300, 400, 500, 600, 700, 800];

/** Slide template — visual styling for the whole event's slide set. */
export interface SlideTemplate {
  // Canvas
  aspect_ratio: AspectRatio;
  layout: LayoutPreset;
  layout_config: LayoutConfig;

  // Background
  background_type: BackgroundType;
  background_color: string;
  background_gradient_from: string;
  background_gradient_to: string;
  background_image_url: string | null;
  overlay_opacity: number; // 0..1

  // Header
  header_text: string;
  header_color: string;
  header_font_size: number;
  header_font: string;
  show_header: boolean;

  // Event date (under header by default)
  /** ISO date string (YYYY-MM-DD) or null when unset. */
  event_date: string | null;
  event_date_color: string;
  event_date_font_size: number;
  event_date_font: string;
  show_event_date: boolean;

  // Name
  name_color: string;
  name_font_size: number;
  name_font: string;
  show_name: boolean;

  // Title / role / company
  title_color: string;
  title_font_size: number;
  title_font: string;
  show_title: boolean;

  // Description (talk title + description)
  description_color: string;
  description_font_size: number;
  description_font: string;
  show_description: boolean;
  show_talk_title: boolean;

  // Headshot
  show_headshot: boolean;
  headshot_shape: HeadshotShape;
  headshot_size: number;
  headshot_border_visible: boolean;
  headshot_border_color: string;
  headshot_bg_color: string;

  // Company logo
  show_logo: boolean;

  // Social links footer
  show_social: boolean;

  /** Extra elements (sponsors, custom text labels, etc.) shown on every slide. */
  custom_elements: CustomElement[];

  /**
   * Per-element text-alignment overrides. Keys without an entry fall back to
   * `LAYOUT_TEXT_ALIGN[layout]`. Overrides persist across layout switches —
   * the position-reset button only clears `layout_config.elementPositions`.
   */
  text_alignments?: Partial<Record<TextAlignableKey, TextAlignment>>;
}

/** A single speaker. */
export interface SlideSpeaker {
  id: string;
  name: string;
  title?: string | null;
  company?: string | null;
  talk_title?: string | null;
  talk_description?: string | null;
  /**
   * Optional short variant of the talk description used by the slide layouts
   * when set — falls back to `talk_description` so legacy data keeps rendering.
   */
  talk_description_short?: string | null;
  headshot_url?: string | null;
  company_logo_url?: string | null;
  twitter_handle?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
}

/** Used for partial updates from external sources (e.g. agenda items). */
export interface SeedSpeaker {
  /** Stable id used to match against any existing locally-edited speaker. */
  sourceId: string;
  name: string;
  bio?: string | null;
  talk_title?: string | null;
  headshot_url?: string | null;
}
