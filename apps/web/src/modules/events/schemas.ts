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
 * The rule-bearing subset of an event write body — the fields
 * `eventsService.validateInput` used to hand-check one by one. Every field is
 * optional here on purpose: create and update both call this schema with
 * only the keys that are present, so a field absent from the input is simply
 * not validated (matching the old `input.field !== undefined` guards), while
 * a field present as an empty string is treated as "not provided" too
 * (matching the old truthy `input.field && ...` guards).
 */
export const eventWriteInput = z.object({
  imageUrl: z
    .string()
    .refine((value) => !value || isAllowedImageUrl(value), "imageUrl host not allowed")
    .optional(),
  lumaUrl: z
    .string()
    .refine(
      (value) => !value || isAllowedLumaUrl(value),
      "External ticket URL must be a valid https:// URL",
    )
    .optional(),
  meetingUrl: z
    .string()
    .refine((value) => !value || isAllowedMeetingUrl(value), "meetingUrl host not allowed")
    .optional(),
  timezone: z
    .string()
    .refine((value) => !value || isValidTimezone(value), "Invalid timezone")
    .optional(),
  title: z
    .string()
    .refine((value) => value.length >= 1 && value.length <= 200, "title required (1-200 chars)")
    .optional(),
});

export type EventWriteInputParsed = z.infer<typeof eventWriteInput>;
