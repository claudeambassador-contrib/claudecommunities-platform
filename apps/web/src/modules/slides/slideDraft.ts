export type SlideLayout = "classic" | "centered" | "minimal";

export interface SlideDraft {
  body: string;
  id: string;
  layout: SlideLayout;
  speaker: string;
  title: string;
}

export interface SlideDeck {
  slides: SlideDraft[];
}

const LAYOUTS = new Set<SlideLayout>(["classic", "centered", "minimal"]);

function isLayout(value: unknown): value is SlideLayout {
  return typeof value === "string" && LAYOUTS.has(value as SlideLayout);
}

function asSlide(value: unknown, index: number): SlideDraft | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const title = typeof row.title === "string" ? row.title : "";
  const body = typeof row.body === "string" ? row.body : "";
  const speaker = typeof row.speaker === "string" ? row.speaker : "";
  const id = typeof row.id === "string" && row.id ? row.id : `slide_${index + 1}`;
  return {
    body,
    id,
    layout: isLayout(row.layout) ? row.layout : "classic",
    speaker,
    title,
  };
}

export function emptySlide(id: string): SlideDraft {
  return { body: "", id, layout: "classic", speaker: "", title: "New slide" };
}

export function parseSlideDeck(data: unknown): SlideDeck {
  if (typeof data !== "object" || data === null) {
    return { slides: [emptySlide("slide_1")] };
  }
  const row = data as Record<string, unknown>;
  const raw = Array.isArray(row.slides) ? row.slides : [];
  const slides = raw
    .map((item, index) => asSlide(item, index))
    .filter((item): item is SlideDraft => item !== null);
  return { slides: slides.length > 0 ? slides : [emptySlide("slide_1")] };
}

export function serializeSlideDeck(deck: SlideDeck): SlideDeck {
  return { slides: deck.slides };
}
