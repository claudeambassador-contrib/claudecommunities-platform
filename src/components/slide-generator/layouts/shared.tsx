import { getRegionConfig } from "@/lib/region";
import { fontStack } from "../fonts";
import { SlideImage } from "../SlideImage";
import {
  LAYOUT_TEXT_ALIGN,
  type SlideSpeaker,
  type SlideTemplate,
  type TextAlignableKey,
  type TextAlignment,
} from "../types";

export { fontStack };

/**
 * Resolve the text alignment for a given element: per-element override on
 * the template wins, otherwise the layout's default alignment.
 */
export function resolveTextAlign(template: SlideTemplate, key: TextAlignableKey): TextAlignment {
  return template.text_alignments?.[key] ?? LAYOUT_TEXT_ALIGN[template.layout] ?? "left";
}

export interface Visibility {
  header: boolean;
  name: boolean;
  title: boolean;
  description: boolean;
  headshot: boolean;
  logo: boolean;
  social: boolean;
}

export function getVisibility(template: SlideTemplate): Visibility {
  return {
    header: template.show_header !== false,
    name: template.show_name !== false,
    title: template.show_title !== false,
    description: template.show_description !== false,
    headshot: template.show_headshot !== false,
    logo: template.show_logo !== false,
    social: template.show_social !== false,
  };
}

export function getInitials(speaker: SlideSpeaker | null): string {
  if (!speaker) return "AB";
  return speaker.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getSpeakerSubtitle(speaker: SlideSpeaker | null): string {
  return [speaker?.title, speaker?.company].filter(Boolean).join(" · ") || "Title · Company";
}

export function getTalkText(speaker: SlideSpeaker | null, template?: SlideTemplate): string | null {
  const showTitle = template ? template.show_talk_title !== false : true;
  const showDescription = template ? template.show_description !== false : true;
  if (!showTitle && !showDescription) return null;
  if (!speaker) return showTitle ? "Talk Title" : null;
  const parts: string[] = [];
  if (showTitle && speaker.talk_title) parts.push(speaker.talk_title);
  if (showDescription) {
    const desc = speaker.talk_description_short || speaker.talk_description;
    if (desc) parts.push(desc);
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

/**
 * Format the template's `event_date` (ISO YYYY-MM-DD) into a display string
 * like "5 March 2026". Returns null when the date is unset or `show_event_date`
 * is false — the layouts and PositionedPreview use that to skip rendering.
 */
export function getEventDateText(template: SlideTemplate): string | null {
  if (template.show_event_date === false) return null;
  const iso = template.event_date;
  if (!iso) return null;
  // Append T00:00 so JS parses it as local time, not UTC (avoids off-by-one).
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(getRegionConfig().lang, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Styled event-date text, ready to drop inside any layout's eventDate wrapper.
 * Each layout owns the *positioning* (left/right or flex justify-center) so
 * the bounding rect captured on first drag matches the visible position.
 */
export function EventDateInline({
  template,
  align,
}: {
  template: SlideTemplate;
  align?: TextAlignment;
}) {
  const text = getEventDateText(template);
  if (!text) return null;
  return (
    <div
      style={{
        color: template.event_date_color,
        fontSize: `clamp(7px, ${template.event_date_font_size * 0.2}vw, ${template.event_date_font_size}px)`,
        fontWeight: 500,
        letterSpacing: "1px",
        whiteSpace: "nowrap",
        fontFamily: fontStack(template.event_date_font),
        textAlign: align ?? resolveTextAlign(template, "eventDate"),
      }}
    >
      {text}
    </div>
  );
}

export function getSocialLine(
  speaker: SlideSpeaker | null,
  template?: SlideTemplate,
): string | null {
  if (template && template.show_social === false) return null;
  if (!speaker) return null;
  const parts: string[] = [];
  if (speaker.twitter_handle) parts.push(`@${speaker.twitter_handle.replace(/^@/, "")}`);
  if (speaker.linkedin_url) parts.push("LinkedIn");
  if (speaker.website_url)
    parts.push(speaker.website_url.replace(/^https?:\/\//, "").replace(/\/$/, ""));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export interface LayoutProps {
  template: SlideTemplate;
  speaker: SlideSpeaker | null;
}

export function HeadshotPreview({
  speaker,
  template,
  sizePx,
}: {
  speaker: SlideSpeaker | null;
  template: SlideTemplate;
  sizePx: number;
}) {
  const isCircle = template.headshot_shape === "circle";
  const initials = getInitials(speaker);
  const showBorder = template.headshot_border_visible !== false;
  const borderColor = template.headshot_border_color ?? "rgba(255,255,255,0.2)";
  return (
    <div
      className="shrink-0 overflow-hidden"
      style={{
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        borderRadius: isCircle ? "50%" : "12%",
        border: showBorder ? `2px solid ${borderColor}` : "none",
        backgroundColor: template.headshot_bg_color ?? "rgba(255,255,255,0.1)",
      }}
    >
      {speaker?.headshot_url ? (
        <SlideImage
          src={speaker.headshot_url}
          alt={speaker.name}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white/60 font-bold"
          style={{ fontSize: `${sizePx * 0.35}px` }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}
