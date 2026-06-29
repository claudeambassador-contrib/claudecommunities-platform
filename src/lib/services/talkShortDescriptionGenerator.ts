import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

const ShortDescriptionSchema = z.object({
  shortDescription: z.string(),
});

const SYSTEM_PROMPT = `You write punchy one-line talk teasers for conference speaker slides.

Hard requirements:
- Output ONE short description, at most 140 characters.
- A single sentence. No line breaks.
- No markdown, no surrounding quotes, no list bullets.
- Do not start with "This talk", "In this talk", "Learn how", "Join us", or similar preambles.
- Read as a teaser that makes the audience curious — not a summary or abstract.
- Use plain, concrete language. Avoid buzzwords and hype.

If a focus hint is provided, angle the teaser toward that topic while staying faithful to the talk.`;

function buildUserPrompt(input: {
  speakerName: string;
  talkTitle: string | null;
  talkDescription: string;
  company: string | null;
  focus?: string | null;
}): string {
  const parts: string[] = [];
  const speakerLine = input.company
    ? `Speaker: ${input.speakerName} (${input.company})`
    : `Speaker: ${input.speakerName}`;
  parts.push(speakerLine);
  if (input.talkTitle) parts.push(`Talk title: ${input.talkTitle}`);
  parts.push(`Long description:\n${input.talkDescription}`);
  const focus = input.focus?.trim();
  if (focus) parts.push(`Focus hint: ${focus}`);
  parts.push("Write the short description now.");
  return parts.join("\n\n");
}

export async function generateTalkShortDescription(input: {
  speakerName: string;
  talkTitle: string | null;
  talkDescription: string;
  company: string | null;
  focus?: string | null;
}): Promise<{ shortDescription: string }> {
  if (!input.talkDescription?.trim()) {
    throw new Error("talkDescription is required");
  }

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-6"),
    schema: ShortDescriptionSchema,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(input),
  });

  return { shortDescription: object.shortDescription.trim() };
}
