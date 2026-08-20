import { z } from "zod";

const ALLOWED_MEETING_HOSTS = [
  "zoom.us",
  "us02web.zoom.us",
  "us04web.zoom.us",
  "us05web.zoom.us",
  "us06web.zoom.us",
  "meet.google.com",
  "teams.microsoft.com",
  "teams.live.com",
  "lu.ma",
  "luma.com",
];

function hostnameAllowed(hostname: string, allowed: readonly string[]): boolean {
  return allowed.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export function isAllowedMeetingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    return hostnameAllowed(parsed.hostname, ALLOWED_MEETING_HOSTS);
  } catch {
    return false;
  }
}

export function isAllowedLumaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isAllowedResourceUrl(url: string): boolean {
  if (url.startsWith("/api/files/")) {
    return true;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isAllowedImageUrl(url: string): boolean {
  if (url.startsWith("/api/files/")) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    return parsed.hostname === "images.lumacdn.com";
  } catch {
    return false;
  }
}

const TIMEZONE_RE = /^[A-Za-z_+\-/0-9]+$/;

export function isValidTimezone(timezone: string): boolean {
  return TIMEZONE_RE.test(timezone);
}

/**
 * The one write shape for events. Every field is optional here on purpose:
 * create and update share this schema, so a field absent from the input is
 * simply not validated (matching the old `input.field !== undefined` guards),
 * while a field present as an empty string or `null` is treated as "not
 * provided" by the rule-bearing refinements (matching the old truthy
 * `input.field && ...` guards).
 *
 * `coverUrl` is the canonical name for the cover image — it matches the
 * `events.cover_url` column. The MCP tool layer still speaks `imageUrl` on the
 * wire and translates once at its boundary.
 */
export const eventWriteInput = z.object({
  city: z.string().nullish(),
  coverUrl: z
    .string()
    .nullish()
    .refine((value) => !value || isAllowedImageUrl(value), "coverUrl host not allowed"),
  description: z.string().nullish(),
  endTime: z.string().nullish(),
  eventType: z.string().nullish(),
  feedbackUrl: z.string().nullish(),
  footerText: z.string().nullish(),
  headerText: z.string().nullish(),
  isActive: z.boolean().optional(),
  isOnline: z.boolean().optional(),
  location: z.string().nullish(),
  lumaUrl: z
    .string()
    .nullish()
    .refine(
      (value) => !value || isAllowedLumaUrl(value),
      "External ticket URL must be a valid https:// URL",
    ),
  maxAttendees: z.number().nullish(),
  meetingUrl: z
    .string()
    .nullish()
    .refine((value) => !value || isAllowedMeetingUrl(value), "meetingUrl host not allowed"),
  rsvpEnabled: z.boolean().optional(),
  startTime: z.string().nullish(),
  timezone: z
    .string()
    .nullish()
    .refine((value) => !value || isValidTimezone(value), "Invalid timezone"),
  title: z
    .string()
    .nullish()
    .refine(
      (value) =>
        value === null || value === undefined || (value.length >= 1 && value.length <= 200),
      "title required (1-200 chars)",
    ),
});
