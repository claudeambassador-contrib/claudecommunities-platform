/**
 * Claudience integration — provisions a per-event session + survey via the
 * external API exposed at https://claudience.com/api/external/sessions.
 *
 * Auth: `CLAUDIENCE_API_KEY` sent as the `X-API-Key` header. Base URL comes
 * from `CLAUDIENCE_API_URL` (defaults to https://claudience.com).
 *
 * The survey definition follows the SurveyDefinition shape in the claudience
 * repo (src/surveys/types.ts). Question list is taken verbatim from
 * docs/survey-questions.md so we keep a single source of truth.
 */

import { getPrisma } from "@/lib/prisma";
import { getTenantConfig } from "@/lib/tenant-config";
import { type ActorLike, ensurePermission } from "./_auth";
import { ServiceError } from "./_errors";

const DEFAULT_BASE_URL = "https://claudience.com";
const PASSWORD_LENGTH = 8;
const PASSWORD_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

interface SurveyQuestion {
  id: string;
  type: string;
  label: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  choices?: Array<{ label: string; value: string }>;
}

// The post-event feedback questionnaire shared across all meetups.
// Mirrors docs/survey-questions.md verbatim — keep both in sync.
const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: "welcome",
    type: "welcome-screen",
    label: "Welcome",
    description: "Tell us what you think.",
  },
  {
    id: "q-V3jHx5",
    type: "rating",
    label: "How would you rate the event overall?",
    required: true,
    min: 1,
    max: 5,
    minLabel: "Poor",
    maxLabel: "Excellent",
  },
  {
    id: "q-kY6zkf",
    type: "rating",
    label: "How would you rate the speaker selection?",
    required: true,
    min: 1,
    max: 5,
    minLabel: "Poor",
    maxLabel: "Excellent",
  },
  {
    id: "q-2ERbHU",
    type: "multiple-choice",
    label: "Are you using Claude Cowork?",
    required: false,
    choices: [
      { label: "Every day", value: "every-day" },
      { label: "Regular", value: "regular" },
      { label: "Beginner", value: "beginner" },
      { label: "Never", value: "never" },
    ],
  },
  {
    id: "q-kfgUCn",
    type: "multiple-choice",
    label: "Are you using Claude Code?",
    required: false,
    choices: [
      { label: "Every day", value: "every-day" },
      { label: "Regular", value: "regular" },
      { label: "Beginner", value: "beginner" },
      { label: "Never", value: "never" },
    ],
  },
  {
    id: "q-Uzg1Ke",
    type: "multi-select",
    label: "What did you like the most?",
    description: "Pick your top 2–3",
    choices: [
      { label: "The speakers and their topics", value: "speakers" },
      { label: "Networking with other attendees", value: "networking" },
      { label: "Practical, actionable takeaways", value: "actionable" },
      { label: "The venue and overall atmosphere", value: "venue-atmosphere" },
      { label: "The Q&A / discussion segments", value: "qa-discussion" },
      { label: "Learning what others are doing", value: "peer-learning" },
      { label: "Other", value: "other" },
    ],
  },
  {
    id: "q-433ptw",
    type: "multi-select",
    label: "What was missing, or what could we improve?",
    description: "Select all that apply",
    choices: [
      { label: "More time for networking", value: "more-networking" },
      { label: "More hands-on / interactive segments", value: "more-interactive" },
      { label: "More technical depth", value: "more-technical" },
      { label: "More beginner-friendly content", value: "more-beginner" },
      { label: "More diverse speaker topics", value: "more-diverse-topics" },
      { label: "Better venue or logistics", value: "better-venue" },
      { label: "Longer event", value: "longer-event" },
      { label: "Shorter event", value: "shorter-event" },
      { label: "Other", value: "other" },
    ],
  },
  {
    id: "q-7M31bg",
    type: "long-text",
    label: "If you could outsource something to AI in your capacity today, what would it be?",
    required: true,
  },
  {
    id: "q-Wz8RsK",
    type: "long-text",
    label: "Walk me through your most repetitive task of the week",
    required: true,
  },
  {
    id: "q-qLY2qM",
    type: "long-text",
    label: "What are you struggling with right now? ",
    description:
      "Either in Claude Chat, Code, or Cowork, or in trying to solve a business problem with AI.",
    required: true,
  },
  {
    id: "q-92Tyz_",
    type: "long-text",
    label: "Anything else you want to share?",
    placeholder: "Highlights, suggestions, ideas for next time...",
    required: false,
  },
];

function generatePassword(): string {
  const bytes = new Uint8Array(PASSWORD_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    const b = bytes[i] ?? 0;
    out += PASSWORD_CHARSET[b % PASSWORD_CHARSET.length] ?? "A";
  }
  return out;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

interface ClaudienceCreateResponse {
  sessionCode: string;
  sessionUrl: string;
  adminUrl: string;
  surveyId: string;
  surveyUrl: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(input: string | null | undefined): string | null {
  if (input == null) return null;
  const v = input.trim();
  if (!v) return null;
  if (!EMAIL_RE.test(v)) throw new ServiceError("bad_request", "Invalid notification email");
  return v;
}

export async function provisionClaudienceForEvent(
  actor: ActorLike,
  eventId: string,
  opts: { notificationEmail?: string | null } = {},
) {
  const db = await getPrisma();
  ensurePermission(actor, "events.edit");

  const baseUrl = process.env.CLAUDIENCE_API_URL || DEFAULT_BASE_URL;
  const apiKey = process.env.CLAUDIENCE_API_KEY;
  if (!apiKey) {
    throw new ServiceError("unavailable", "CLAUDIENCE_API_KEY is not configured");
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new ServiceError("not_found", "Event not found");
  if (event.claudienceSessionCode) {
    throw new ServiceError("conflict", "Claudience session already exists for this event");
  }

  const notificationEmail = normalizeEmail(opts.notificationEmail);

  const password = generatePassword();
  const datePart = event.startTime.toISOString().slice(0, 10);
  const surveyId = `${slugify(event.title) || "event"}-${datePart}`;
  // "19 June" in the event's local timezone (falls back to system tz).
  const { lang, siteUrl } = await getTenantConfig();
  const titleDate = new Intl.DateTimeFormat(lang, {
    day: "numeric",
    month: "long",
    timeZone: event.timezone || undefined,
  }).format(event.startTime);
  const survey = {
    id: surveyId,
    title: `${event.title} - ${titleDate}`,
    description: `Post-event feedback for ${event.title}`,
    questions: SURVEY_QUESTIONS,
    redirectUrl: siteUrl,
    active: true,
    ...(notificationEmail ? { notificationEmail } : {}),
  };

  let response: ClaudienceCreateResponse;
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/external/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ passcode: password, survey }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Claudience API ${res.status}: ${text}`);
    }
    response = (await res.json()) as ClaudienceCreateResponse;
  } catch (err) {
    throw new ServiceError(
      "unavailable",
      `Failed to provision Claudience session: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const updated = await db.event.update({
    where: { id: eventId },
    data: {
      claudienceSessionCode: response.sessionCode,
      claudienceSessionPassword: password,
      claudienceSessionUrl: response.sessionUrl,
      claudienceSurveyId: response.surveyId,
      claudienceSurveyUrl: response.surveyUrl,
      claudienceNotificationEmail: notificationEmail,
      // Auto-fill the post-event email blast survey link.
      feedbackUrl: event.feedbackUrl || response.surveyUrl,
    },
  });

  return {
    sessionCode: updated.claudienceSessionCode,
    sessionPassword: updated.claudienceSessionPassword,
    sessionUrl: updated.claudienceSessionUrl,
    adminUrl: response.adminUrl,
    surveyId: updated.claudienceSurveyId,
    surveyUrl: updated.claudienceSurveyUrl,
    feedbackUrl: updated.feedbackUrl,
    notificationEmail: updated.claudienceNotificationEmail,
  };
}

export async function updateClaudienceNotificationEmail(
  actor: ActorLike,
  eventId: string,
  rawEmail: string | null,
) {
  const db = await getPrisma();
  ensurePermission(actor, "events.edit");

  const baseUrl = process.env.CLAUDIENCE_API_URL || DEFAULT_BASE_URL;
  const apiKey = process.env.CLAUDIENCE_API_KEY;
  if (!apiKey) {
    throw new ServiceError("unavailable", "CLAUDIENCE_API_KEY is not configured");
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new ServiceError("not_found", "Event not found");
  if (!event.claudienceSessionCode) {
    throw new ServiceError("bad_request", "No Claudience session provisioned for this event");
  }

  const notificationEmail = normalizeEmail(rawEmail);

  try {
    const res = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/api/external/sessions/${encodeURIComponent(
        event.claudienceSessionCode,
      )}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ notificationEmail }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Claudience API ${res.status}: ${text}`);
    }
  } catch (err) {
    throw new ServiceError(
      "unavailable",
      `Failed to update Claudience notification email: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const updated = await db.event.update({
    where: { id: eventId },
    data: { claudienceNotificationEmail: notificationEmail },
  });

  return { notificationEmail: updated.claudienceNotificationEmail };
}
