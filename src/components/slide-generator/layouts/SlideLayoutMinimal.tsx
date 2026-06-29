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
  type LayoutProps,
  resolveTextAlign,
} from "./shared";

export default function SlideLayoutMinimal({ template, speaker }: LayoutProps) {
  const talkText = getTalkText(speaker, template);
  const socialLine = getSocialLine(speaker, template);
  const vis = getVisibility(template);
  const nameScale = LAYOUT_NAME_SCALE.minimal;
  const eventDate = getEventDateText(template);

  return (
    <div className="absolute inset-0 flex flex-col justify-end p-[8%]">
      {eventDate && (
        <div data-slide-el="eventDate" className="absolute top-[12%] left-[8%] right-[8%]">
          <EventDateInline template={template} align={resolveTextAlign(template, "eventDate")} />
        </div>
      )}
      {vis.header && (
        <div data-slide-el="header" className="absolute top-[6%] left-[8%] right-[8%]">
          <div
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

      <div
        className="rounded-full mb-3"
        style={{
          width: "clamp(20px, 8%, 60px)",
          height: "clamp(2px, 0.5%, 4px)",
          backgroundColor: template.header_color,
        }}
      />

      {vis.name && (
        <div
          data-slide-el="name"
          className="font-bold leading-none tracking-tight"
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

      <div className="flex items-center gap-2 mt-2">
        {vis.title && (
          <div
            data-slide-el="subtitle"
            className="font-medium"
            style={{
              color: template.title_color,
              fontSize: `clamp(7px, ${template.title_font_size * 0.22}vw, ${template.title_font_size * 0.7}px)`,
              fontFamily: fontStack(template.title_font),
              textAlign: resolveTextAlign(template, "subtitle"),
            }}
          >
            {getSpeakerSubtitle(speaker)}
          </div>
        )}
        {vis.logo && speaker?.company_logo_url && (
          <div
            data-slide-el="logo"
            className="shrink-0 w-5 h-5 rounded overflow-hidden bg-white/10 flex items-center justify-center"
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

      {talkText && (
        <div
          data-slide-el="talk"
          className="mt-2 line-clamp-5 max-w-[70%]"
          style={{
            color: template.description_color,
            fontSize: `clamp(6px, ${template.description_font_size * 0.2}vw, ${template.description_font_size * 0.65}px)`,
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
  );
}
