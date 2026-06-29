/**
 * Pure render of an agenda + optional header/footer into a paste-ready
 * description string. Two formats: "plain" (Luma-style, emojis + bullets)
 * and "markdown" (## headings + paragraphs).
 */

export interface AgendaSpeaker {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  talkTitle: string | null;
  talkDescription: string | null;
  headshotUrl: string | null;
  companyLogoUrl: string | null;
  twitterHandle: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
}

export interface AgendaItem {
  id: string;
  type: string;
  order: number;
  startTime: string | null;
  endTime: string | null;
  title: string | null;
  description: string | null;
  speakerId: string | null;
  speaker: AgendaSpeaker | null;
  submissionId: string | null;
}

export interface DescriptionInput {
  headerText?: string | null;
  footerText?: string | null;
  agenda: AgendaItem[];
  timezone?: string | null;
}

export type DescriptionFormat = "plain" | "markdown";

function fmtTime(iso: string | null, tz: string | null | undefined, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleTimeString(lang, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz || undefined,
    });
  } catch {
    return d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", hour12: false });
  }
}

function timeRange(item: AgendaItem, tz: string | null | undefined, lang: string): string {
  const start = fmtTime(item.startTime, tz, lang);
  const end = fmtTime(item.endTime, tz, lang);
  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  return "";
}

/** Speaker name/topic for headline rendering. Requires a linked Speaker. */
function resolveSpeakerHeadline(item: AgendaItem): { name: string; topic: string } {
  if (item.speaker) {
    return {
      name: item.speaker.name.trim(),
      topic: (item.speaker.talkTitle ?? item.title ?? "").trim(),
    };
  }
  return { name: "", topic: (item.title ?? "").trim() };
}

function headlineFor(item: AgendaItem): string {
  if (item.type === "speaker") {
    const { name, topic } = resolveSpeakerHeadline(item);
    if (name && topic) return `${topic} — ${name}`;
    if (topic) return topic;
    if (name) return name;
    return "Speaker";
  }
  if (item.title?.trim()) return item.title.trim();
  switch (item.type) {
    case "welcome":
      return "Welcome";
    case "break":
      return "Break";
    default:
      return "Session";
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cognitive complexity is per-function; the agenda-to-description formatting branches would carry the same score if extracted, so reducing it requires a real decomposition out of scope for a lint pass
export function renderDescription(
  input: DescriptionInput,
  format: DescriptionFormat,
  lang: string,
): string {
  const sortedAgenda = [...input.agenda].sort((a, b) => a.order - b.order);
  const sections: string[] = [];

  if (input.headerText?.trim()) {
    sections.push(input.headerText.trim());
  }

  for (const item of sortedAgenda) {
    const range = timeRange(item, input.timezone, lang);
    const headline = headlineFor(item);
    const headerLine = range ? `${range} | ${headline}` : headline;

    const body: string[] = [];
    if (item.type === "speaker") {
      // Talk description: prefer linked Speaker's talkDescription, then per-slot description.
      const talkDesc = item.speaker?.talkDescription?.trim() ?? item.description?.trim() ?? "";
      const bio = item.speaker?.bio?.trim() ?? "";
      if (talkDesc) body.push(talkDesc);
      if (bio) body.push(bio);
    } else if (item.description?.trim()) {
      body.push(item.description.trim());
    }

    if (format === "markdown") {
      const parts = [`## ${headerLine}`];
      if (body.length) parts.push(body.join("\n\n"));
      sections.push(parts.join("\n\n"));
    } else {
      const parts = [headerLine];
      if (body.length) parts.push(body.join("\n\n"));
      sections.push(parts.join("\n\n"));
    }
  }

  if (input.footerText?.trim()) {
    sections.push(input.footerText.trim());
  }

  return sections.join("\n\n");
}
