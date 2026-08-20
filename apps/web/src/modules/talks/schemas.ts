import { z } from "zod";

const EMAIL_MARKER = "@";

export function isValidEmail(value: string): boolean {
  return value.includes(EMAIL_MARKER);
}

function publicR2Host(): string | null {
  try {
    return new URL(process.env.R2_PUBLIC_URL || "").hostname || null;
  } catch {
    return null;
  }
}

export function isStorageUrl(url: string): boolean {
  if (url.startsWith("/api/files/")) {
    return true;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
    const publicHost = publicR2Host();
    return (
      parsed.pathname.startsWith("/api/files/") ||
      parsed.hostname.endsWith(".r2.dev") ||
      Boolean(publicHost && parsed.hostname === publicHost)
    );
  } catch {
    return false;
  }
}

/** Skip on undefined (field not present in the patch); trim everything else. */
function optionalTrim(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "string" ? value.trim() : "";
}

/** Missing/non-string input becomes "" so `min(1, message)` still fires. */
function requiredTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Skip on undefined (field not present); lowercase + trim everything else. */
function optionalTrimLower(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

const storageUrlField = (field: string) =>
  z
    .string()
    .nullish()
    .refine((value) => !value || isStorageUrl(value), `${field} must be a storage URL`);

/**
 * `createTalkSubmission`'s write shape — every rule-bearing field is
 * required, matching the old inline checks in `talksService`.
 */
export const talkSubmissionCreateInput = z.object({
  bio: z.string().nullish(),
  city: z.string().nullish(),
  description: z.string().nullish(),
  email: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : ""),
    z.string().refine(isValidEmail, "Valid email is required"),
  ),
  name: z.preprocess(requiredTrim, z.string().min(1, "Name is required")),
  title: z.preprocess(requiredTrim, z.string().min(1, "Talk title is required")),
});
export type TalkSubmissionCreateInputParsed = z.infer<typeof talkSubmissionCreateInput>;

/**
 * `updateTalkContent`'s write shape — same rules as create, but every field
 * is optional (a field absent from the patch is left untouched) and the
 * required-field messages differ from create's, matching the old
 * `talkContentPatch` behavior.
 */
export const talkSubmissionPatchInput = z.object({
  bio: z.string().nullish(),
  city: z.string().nullish(),
  description: z.string().nullish(),
  email: z
    .preprocess(optionalTrimLower, z.string().refine(isValidEmail, "Valid email is required"))
    .optional(),
  name: z.preprocess(optionalTrim, z.string().min(1, "Name cannot be empty")).optional(),
  title: z.preprocess(optionalTrim, z.string().min(1, "Title cannot be empty")).optional(),
});
export type TalkSubmissionPatchInputParsed = z.infer<typeof talkSubmissionPatchInput>;

/** `createSpeaker`'s write shape — `name` is required. */
export const speakerCreateInput = z.object({
  bio: z.string().nullish(),
  company: z.string().nullish(),
  companyLogoUrl: storageUrlField("companyLogoUrl"),
  headshotUrl: storageUrlField("headshotUrl"),
  linkedinUrl: z.string().nullish(),
  name: z.preprocess(requiredTrim, z.string().min(1, "name is required")),
  talkDescription: z.string().nullish(),
  talkDescriptionShort: z.string().nullish(),
  talkTitle: z.string().nullish(),
  title: z.string().nullish(),
  twitterHandle: z.string().nullish(),
  websiteUrl: z.string().nullish(),
});
export type SpeakerCreateInputParsed = z.infer<typeof speakerCreateInput>;

/** `updateSpeaker`'s write shape — `name`, when present, uses the update message. */
export const speakerPatchInput = speakerCreateInput.extend({
  name: z.preprocess(optionalTrim, z.string().min(1, "name cannot be empty")).optional(),
});
export type SpeakerPatchInputParsed = z.infer<typeof speakerPatchInput>;
