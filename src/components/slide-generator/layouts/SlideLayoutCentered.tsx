import { SlideImage } from "../SlideImage";
import { LAYOUT_NAME_SCALE } from "../types";
import {
  EventDateInline,
  fontStack,
  getEventDateText,
  getSocialLine,
  getSpeakerSubtitle,
  getTalkText,
  getVisibility,
  HeadshotPreview,
  type LayoutProps,
  resolveTextAlign,
} from "./shared";

export default function SlideLayoutCentered({ template, speaker }: LayoutProps) {
  const headSize = (template.headshot_size ?? 120) * 1.4;
  const talkText = getTalkText(speaker, template);
  const socialLine = getSocialLine(speaker, template);
  const vis = getVisibility(template);
  const nameScale = LAYOUT_NAME_SCALE.centered;
  const eventDate = getEventDateText(template);
  const previewHead = headSize * 0.5;

  return (
    <>
      {vis.header && (
        // Wrap in a full-width centering row so the data-slide-el wrapper
        // shrinks to the actual text width — that way its bounding rect
        // matches the visible text position, and freezing on first drag
        // (DraggableSlideEditor.freezeCurrentPositions) records the correct
        // top-left coordinate.
        <div className="absolute top-[5%] left-0 right-0 flex justify-center pointer-events-none">
          <div
            data-slide-el="header"
            className="pointer-events-auto"
            style={{
              color: template.header_color,
              fontSize: `clamp(8px, ${template.header_font_size * 0.24}vw, ${template.header_font_size}px)`,
              letterSpacing: "2px",
              fontWeight: 600,
              fontFamily: fontStack(template.header_font),
              textAlign: resolveTextAlign(template, "header"),
            }}
          >
            {template.header_text || "Event Name"}
          </div>
        </div>
      )}

      {eventDate && (
        <div className="absolute top-[12%] left-0 right-0 flex justify-center pointer-events-none">
          <div data-slide-el="eventDate" className="pointer-events-auto">
            <EventDateInline template={template} align={resolveTextAlign(template, "eventDate")} />
          </div>
        </div>
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-[10%]">
        {vis.headshot && (
          <div data-slide-el="headshot">
            <HeadshotPreview speaker={speaker} template={template} sizePx={previewHead} />
          </div>
        )}
        <div className="text-center w-full">
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
              className="font-medium mt-1"
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
              className="mt-1.5 line-clamp-5 max-w-[80%] mx-auto"
              style={{
                color: template.description_color,
                fontSize: `clamp(6px, ${template.description_font_size * 0.18}vw, ${template.description_font_size * 0.6}px)`,
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
              className="mt-1 truncate"
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
        {vis.logo && speaker?.company_logo_url && (
          <div
            data-slide-el="logo"
            className="shrink-0 w-7 h-7 rounded-md overflow-hidden bg-white/10 flex items-center justify-center mt-1"
          >
            <SlideImage
              src={speaker.company_logo_url}
              alt={speaker.company ?? ""}
              className="max-w-[80%] max-h-[80%] object-contain"
              crossOrigin="anonymous"
            />
          </div>
        )}
      </div>
    </>
  );
}
