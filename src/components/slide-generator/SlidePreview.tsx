import { forwardRef } from "react";
import SlideLayoutBanner from "./layouts/SlideLayoutBanner";
import SlideLayoutBottom from "./layouts/SlideLayoutBottom";
import SlideLayoutCentered from "./layouts/SlideLayoutCentered";
import SlideLayoutMinimal from "./layouts/SlideLayoutMinimal";
import SlideLayoutRightPanel from "./layouts/SlideLayoutRightPanel";
import SlideLayoutSplit from "./layouts/SlideLayoutSplit";
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
} from "./layouts/shared";
import { SlideImage } from "./SlideImage";
import {
  ASPECT_RATIOS,
  type CustomElement,
  type DraggableElementKey,
  type ElementPosition,
  LAYOUT_DEFAULT_POSITIONS,
  LAYOUT_NAME_SCALE,
  type LayoutPreset,
  type SlideSpeaker,
  type SlideTemplate,
} from "./types";

export interface SlidePreviewProps {
  template: SlideTemplate;
  speaker?: SlideSpeaker | null;
}

const LAYOUT_COMPONENTS: Record<LayoutPreset, React.ComponentType<LayoutProps>> = {
  "bottom-left": SlideLayoutBottom,
  centered: SlideLayoutCentered,
  "right-panel": SlideLayoutRightPanel,
  split: SlideLayoutSplit,
  banner: SlideLayoutBanner,
  minimal: SlideLayoutMinimal,
};

function buildBgStyle(template: SlideTemplate): React.CSSProperties {
  const bg: React.CSSProperties = {};
  if (template.background_type === "image" && template.background_image_url) {
    bg.backgroundImage = `url(${template.background_image_url})`;
    bg.backgroundSize = "cover";
    bg.backgroundPosition = "center";
  } else if (template.background_type === "gradient") {
    bg.background = `linear-gradient(135deg, ${template.background_gradient_from}, ${template.background_gradient_to})`;
  } else {
    bg.backgroundColor = template.background_color;
  }
  return bg;
}

function getContentOffset(t: SlideTemplate): { x: number; y: number } {
  return { x: t.layout_config.contentOffsetX ?? 0, y: t.layout_config.contentOffsetY ?? 0 };
}

function hasCustomPositions(t: SlideTemplate): boolean {
  return !!t.layout_config.elementPositions;
}

function getPositions(t: SlideTemplate): Record<DraggableElementKey, ElementPosition> {
  const d = LAYOUT_DEFAULT_POSITIONS[t.layout] ?? LAYOUT_DEFAULT_POSITIONS["bottom-left"];
  const ep = t.layout_config.elementPositions;
  return {
    header: ep?.header ?? d.header,
    eventDate: ep?.eventDate ?? d.eventDate,
    headshot: ep?.headshot ?? d.headshot,
    name: ep?.name ?? d.name,
    subtitle: ep?.subtitle ?? d.subtitle,
    talk: ep?.talk ?? d.talk,
    social: ep?.social ?? d.social,
    logo: ep?.logo ?? d.logo,
  };
}

function scaleStyle(p: ElementPosition): React.CSSProperties {
  const s = p.scale ?? 1;
  return {
    left: `${p.x}%`,
    top: `${p.y}%`,
    transformOrigin: "top left",
    transform: s !== 1 ? `scale(${s})` : undefined,
  };
}

/**
 * Width/wrap style for a text element. When the user has resized the element
 * (via the editor's width handle, which sets `wrap`), it becomes a fixed-width
 * box that wraps; otherwise it keeps its single-line default. Gated on `wrap`
 * so a `width` captured by an older freeze / preset never re-wraps text.
 */
function textWrapStyle(
  p: ElementPosition,
  defaultWhiteSpace: "nowrap" | "pre-line",
): React.CSSProperties {
  if (p.wrap && p.width) {
    return {
      width: `${p.width}%`,
      whiteSpace: defaultWhiteSpace === "pre-line" ? "pre-line" : "normal",
    };
  }
  return { whiteSpace: defaultWhiteSpace };
}

/**
 * Headshot rendered at a captured slide-relative size. Used after first
 * drag in layouts whose flex headshot has a layout-defined (non-default)
 * footprint, so the visual proportions survive the flex→absolute switch.
 */
function PositionedHeadshotBox({
  speaker,
  template,
}: {
  speaker: SlideSpeaker | null;
  template: SlideTemplate;
}) {
  const isCircle = template.headshot_shape === "circle";
  const showBorder = template.headshot_border_visible !== false;
  const borderColor = template.headshot_border_color ?? "rgba(255,255,255,0.2)";
  const initials = (speaker?.name ?? "AB")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      className="overflow-hidden"
      style={{
        width: "100%",
        height: "100%",
        // Establish a container-query context so the initials font below can
        // size off this box. Without container-type, `cqw` falls back to
        // viewport units and the placeholder text either dwarfs the circle
        // (clipping the second letter, hence the "AB" → "A" report) or
        // shrinks to nothing depending on viewport width.
        containerType: "inline-size",
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
          // 35% of the headshot's inline size — matches HeadshotPreview's
          // sizePx * 0.35 so the placeholder text doesn't change size
          // between flex and absolute rendering modes.
          style={{ fontSize: "35cqw" }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}

function PositionedPreview({
  template,
  speaker,
}: {
  template: SlideTemplate;
  speaker: SlideSpeaker | null;
}) {
  const pos = getPositions(template);
  const talkText = getTalkText(speaker, template);
  const socialLine = getSocialLine(speaker, template);
  const vis = getVisibility(template);
  const headPx = template.headshot_size * 0.55;
  const nameScale = LAYOUT_NAME_SCALE[template.layout] ?? 1;

  return (
    <>
      {vis.header && (
        <div
          className="absolute"
          data-slide-el="header"
          style={{
            ...scaleStyle(pos.header),
            color: template.header_color,
            fontSize: `clamp(8px, ${template.header_font_size * 0.24}vw, ${template.header_font_size}px)`,
            letterSpacing: "2px",
            fontWeight: 600,
            fontFamily: fontStack(template.header_font),
            textAlign: resolveTextAlign(template, "header"),
            ...textWrapStyle(pos.header, "nowrap"),
          }}
        >
          {template.header_text || "Event Name"}
        </div>
      )}

      {getEventDateText(template) && (
        <div className="absolute" data-slide-el="eventDate" style={scaleStyle(pos.eventDate)}>
          <EventDateInline template={template} align={resolveTextAlign(template, "eventDate")} />
        </div>
      )}

      {vis.headshot && (
        <div
          className="absolute"
          data-slide-el="headshot"
          style={{
            ...scaleStyle(pos.headshot),
            // Honor the size captured at freeze-time so layouts like "split"
            // (which renders a large flex headshot) keep their dramatic
            // proportions after the first drag. Falls back to the standard
            // sizePx if no measurement was captured.
            ...(pos.headshot.width
              ? {
                  width: `${pos.headshot.width}%`,
                  height: `${pos.headshot.height ?? pos.headshot.width}%`,
                }
              : undefined),
          }}
        >
          {pos.headshot.width ? (
            <PositionedHeadshotBox speaker={speaker} template={template} />
          ) : (
            <HeadshotPreview speaker={speaker} template={template} sizePx={headPx} />
          )}
        </div>
      )}

      {vis.name && (
        <div
          className="absolute font-bold leading-tight"
          data-slide-el="name"
          style={{
            ...scaleStyle(pos.name),
            color: template.name_color,
            fontSize: `clamp(${10 * nameScale}px, ${template.name_font_size * 0.22 * nameScale}vw, ${template.name_font_size * 0.7 * nameScale}px)`,
            fontFamily: fontStack(template.name_font),
            textAlign: resolveTextAlign(template, "name"),
            ...textWrapStyle(pos.name, "nowrap"),
          }}
        >
          {speaker?.name ?? "Speaker Name"}
        </div>
      )}
      {vis.title && (
        <div
          className="absolute font-medium"
          data-slide-el="subtitle"
          style={{
            ...scaleStyle(pos.subtitle),
            color: template.title_color,
            fontSize: `clamp(7px, ${template.title_font_size * 0.2}vw, ${template.title_font_size * 0.65}px)`,
            fontFamily: fontStack(template.title_font),
            textAlign: resolveTextAlign(template, "subtitle"),
            ...textWrapStyle(pos.subtitle, "nowrap"),
          }}
        >
          {getSpeakerSubtitle(speaker)}
        </div>
      )}
      {talkText && (
        <div
          className={`absolute ${pos.talk.wrap && pos.talk.width ? "" : "line-clamp-5"}`}
          data-slide-el="talk"
          style={{
            ...scaleStyle(pos.talk),
            color: template.description_color,
            fontSize: `clamp(6px, ${template.description_font_size * 0.18}vw, ${template.description_font_size * 0.6}px)`,
            fontFamily: fontStack(template.description_font),
            lineHeight: 1.3,
            textAlign: resolveTextAlign(template, "talk"),
            // When resized: fixed width from the handle. Otherwise: cap at 60%
            // and clamp to 5 lines (the line-clamp class above).
            ...(pos.talk.wrap && pos.talk.width
              ? { width: `${pos.talk.width}%`, whiteSpace: "pre-line" }
              : { maxWidth: "60%", whiteSpace: "pre-line" }),
          }}
        >
          {talkText}
        </div>
      )}
      {socialLine && (
        <div
          className="absolute"
          data-slide-el="social"
          style={{
            ...scaleStyle(pos.social),
            color: "rgba(255,255,255,0.4)",
            fontSize: `clamp(5px, ${template.description_font_size * 0.15}vw, ${template.description_font_size * 0.5}px)`,
            fontFamily: fontStack(template.description_font),
            textAlign: resolveTextAlign(template, "social"),
            ...textWrapStyle(pos.social, "nowrap"),
          }}
        >
          {socialLine}
        </div>
      )}

      {vis.logo && speaker?.company_logo_url && (
        <div
          className={`absolute shrink-0 rounded-md overflow-hidden bg-white/10 flex items-center justify-center ${
            pos.logo.width ? "" : "w-8 h-8"
          }`}
          data-slide-el="logo"
          style={{
            ...scaleStyle(pos.logo),
            ...(pos.logo.width
              ? { width: `${pos.logo.width}%`, height: `${pos.logo.height ?? pos.logo.width}%` }
              : undefined),
          }}
        >
          <SlideImage
            src={speaker.company_logo_url}
            alt={speaker.company ?? ""}
            className="max-w-[80%] max-h-[80%] object-contain"
            crossOrigin="anonymous"
          />
        </div>
      )}
    </>
  );
}

function CustomElementRender({ element }: { element: CustomElement }) {
  const p = element.position;
  const s = p.scale ?? 1;
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: `${p.x}%`,
    top: `${p.y}%`,
    transformOrigin: "top left",
    transform: s !== 1 ? `scale(${s})` : undefined,
  };

  if (element.type === "text") {
    return (
      <div
        data-slide-el={`custom:${element.id}`}
        style={{
          ...baseStyle,
          color: element.color,
          fontSize: `clamp(${Math.max(6, element.fontSize * 0.5)}px, ${element.fontSize * 0.24}vw, ${element.fontSize}px)`,
          fontFamily: fontStack(element.fontFamily),
          fontWeight: element.fontWeight,
          whiteSpace: "pre-wrap",
          lineHeight: 1.2,
          textAlign: element.textAlign ?? "left",
          ...(p.width ? { width: `${p.width}%` } : undefined),
        }}
      >
        {element.text || "Text"}
      </div>
    );
  }

  // image
  const widthPct = p.width ?? 12;
  return (
    <div
      data-slide-el={`custom:${element.id}`}
      style={{
        ...baseStyle,
        width: `${widthPct}%`,
        ...(p.height ? { height: `${p.height}%` } : undefined),
      }}
    >
      {element.url ? (
        <SlideImage
          src={element.url}
          alt={element.alt ?? ""}
          crossOrigin="anonymous"
          style={{
            width: "100%",
            height: p.height ? "100%" : "auto",
            objectFit: "contain",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            aspectRatio: "1/1",
            border: "1px dashed rgba(255,255,255,0.3)",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.4)",
            fontSize: 10,
          }}
        >
          image
        </div>
      )}
    </div>
  );
}

function CustomElementsLayer({ elements }: { elements: CustomElement[] }) {
  if (elements.length === 0) return null;
  return (
    <>
      {elements.map((el) => (
        <CustomElementRender key={el.id} element={el} />
      ))}
    </>
  );
}

const SlidePreview = forwardRef<HTMLDivElement, SlidePreviewProps>(function SlidePreview(
  { template, speaker },
  ref,
) {
  const config = ASPECT_RATIOS[template.aspect_ratio] ?? ASPECT_RATIOS["16:9"];
  const bgStyle = buildBgStyle(template);
  const LayoutComponent = LAYOUT_COMPONENTS[template.layout] ?? LAYOUT_COMPONENTS["bottom-left"];
  const offset = getContentOffset(template);
  const hasOffset = offset.x !== 0 || offset.y !== 0;
  const positioned = hasCustomPositions(template);
  const customs = template.custom_elements ?? [];

  return (
    <div
      className="relative overflow-hidden"
      style={{ aspectRatio: `${config.width}/${config.height}`, ...bgStyle }}
      ref={ref}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, rgba(0,0,0,${template.overlay_opacity}) 0%, rgba(0,0,0,0) 60%)`,
        }}
      />
      {positioned ? (
        <PositionedPreview template={template} speaker={speaker ?? null} />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            transform: hasOffset ? `translate(${offset.x}%, ${offset.y}%)` : undefined,
          }}
        >
          <LayoutComponent template={template} speaker={speaker ?? null} />
        </div>
      )}
      <CustomElementsLayer elements={customs} />
    </div>
  );
});

export default SlidePreview;
