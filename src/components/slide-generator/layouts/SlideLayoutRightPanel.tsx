import { SlideImage } from "@/components/slide-generator/SlideImage";
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

export default function SlideLayoutRightPanel({ template, speaker }: LayoutProps) {
  const headSize = template.headshot_size ?? 120;
  const talkText = getTalkText(speaker, template);
  const socialLine = getSocialLine(speaker, template);
  const vis = getVisibility(template);
  const eventDate = getEventDateText(template);
  const previewHead = headSize * 0.5;

  return (
    <>
      {eventDate && (
        <div data-slide-el="eventDate" className="absolute top-[12%] right-[5%]">
          <EventDateInline template={template} align={resolveTextAlign(template, "eventDate")} />
        </div>
      )}

      {vis.header && (
        <div data-slide-el="header" className="absolute top-[6%] right-[5%]">
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

      <div className="absolute bottom-[8%] right-[5%] flex flex-col items-end gap-2 max-w-[55%]">
        {vis.headshot && (
          <div data-slide-el="headshot">
            <HeadshotPreview speaker={speaker} template={template} sizePx={previewHead} />
          </div>
        )}
        <div className="w-full">
          {vis.name && (
            <div
              data-slide-el="name"
              className="font-bold leading-tight"
              style={{
                color: template.name_color,
                fontSize: `clamp(10px, ${template.name_font_size * 0.22}vw, ${template.name_font_size * 0.7}px)`,
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
              className="font-medium mt-0.5"
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
              className="mt-1 line-clamp-5"
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
              className="mt-0.5 truncate"
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
            className="shrink-0 w-7 h-7 rounded-md overflow-hidden bg-white/10 flex items-center justify-center"
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
