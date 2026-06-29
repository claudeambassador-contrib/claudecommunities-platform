import { SlideImage } from "../SlideImage";
import { LAYOUT_NAME_SCALE } from "../types";
import {
  EventDateInline,
  fontStack,
  getEventDateText,
  getInitials,
  getSocialLine,
  getSpeakerSubtitle,
  getTalkText,
  getVisibility,
  type LayoutProps,
  resolveTextAlign,
} from "./shared";

export default function SlideLayoutSplit({ template, speaker }: LayoutProps) {
  const talkText = getTalkText(speaker, template);
  const socialLine = getSocialLine(speaker, template);
  const initials = getInitials(speaker);
  const isCircle = template.headshot_shape === "circle";
  const vis = getVisibility(template);
  const nameScale = LAYOUT_NAME_SCALE.split;
  const eventDate = getEventDateText(template);

  return (
    <div className="absolute inset-0 flex">
      {vis.headshot && (
        // The 42% panel is the layout's static decoration. data-slide-el is
        // on the inner image container so its bounding rect matches the
        // visible headshot, not the whole left half — otherwise freezing
        // on first drag would snap the headshot to (0,0).
        <div className="w-[42%] h-full relative overflow-hidden">
          <div className="absolute inset-0 bg-black/30" />
          <div
            data-slide-el="headshot"
            className="absolute overflow-hidden"
            style={{
              inset: "10%",
              borderRadius: isCircle ? "50%" : "5%",
              border:
                template.headshot_border_visible !== false
                  ? `3px solid ${template.headshot_border_color}`
                  : "none",
              backgroundColor: template.headshot_bg_color,
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
              <div className="w-full h-full flex items-center justify-center text-white/50 font-bold text-2xl">
                {initials}
              </div>
            )}
          </div>
          {vis.logo && speaker?.company_logo_url && (
            <div
              data-slide-el="logo"
              className="absolute bottom-[6%] left-1/2 -translate-x-1/2 w-7 h-7 rounded-lg overflow-hidden bg-white/15 flex items-center justify-center"
            >
              <SlideImage
                src={speaker.company_logo_url}
                alt={speaker.company ?? ""}
                className="max-w-[75%] max-h-[75%] object-contain"
                crossOrigin="anonymous"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center px-[5%] gap-1.5">
        {vis.header && (
          <div
            data-slide-el="header"
            style={{
              color: template.header_color,
              fontSize: `clamp(7px, ${template.header_font_size * 0.22}vw, ${template.header_font_size * 0.9}px)`,
              letterSpacing: "2px",
              fontWeight: 600,
              fontFamily: fontStack(template.header_font),
              textAlign: resolveTextAlign(template, "header"),
            }}
          >
            {template.header_text || "Event Name"}
          </div>
        )}
        {eventDate && (
          <div data-slide-el="eventDate">
            <EventDateInline template={template} align={resolveTextAlign(template, "eventDate")} />
          </div>
        )}
        {vis.name && (
          <div
            data-slide-el="name"
            className="font-bold leading-tight"
            style={{
              color: template.name_color,
              fontSize: `clamp(${10 * nameScale}px, ${template.name_font_size * 0.22 * nameScale}vw, ${template.name_font_size * 0.7 * nameScale}px)`,
              fontFamily: fontStack(template.name_font),
              textAlign: resolveTextAlign(template, "name"),
            }}
          >
            {speaker?.name ?? "Speaker Name"}
          </div>
        )}
        {vis.title && (
          <div
            data-slide-el="subtitle"
            className="font-medium"
            style={{
              color: template.title_color,
              fontSize: `clamp(7px, ${template.title_font_size * 0.2}vw, ${template.title_font_size * 0.65}px)`,
              fontFamily: fontStack(template.title_font),
              textAlign: resolveTextAlign(template, "subtitle"),
            }}
          >
            {getSpeakerSubtitle(speaker)}
          </div>
        )}
        {talkText && (
          <div
            data-slide-el="talk"
            className="line-clamp-5 mt-0.5"
            style={{
              color: template.description_color,
              fontSize: `clamp(6px, ${template.description_font_size * 0.18}vw, ${template.description_font_size * 0.6}px)`,
              lineHeight: 1.5,
              whiteSpace: "pre-line",
              fontFamily: fontStack(template.description_font),
              textAlign: resolveTextAlign(template, "talk"),
            }}
          >
            {talkText}
          </div>
        )}
        {socialLine && (
          <div
            data-slide-el="social"
            className="truncate"
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: `clamp(5px, ${template.description_font_size * 0.15}vw, ${template.description_font_size * 0.5}px)`,
              fontFamily: fontStack(template.description_font),
              textAlign: resolveTextAlign(template, "social"),
            }}
          >
            {socialLine}
          </div>
        )}
      </div>
    </div>
  );
}
