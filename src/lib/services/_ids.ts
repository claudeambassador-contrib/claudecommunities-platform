/**
 * ID generation for service-layer writes.
 *
 * Preserves the legacy `${prefix}_${randomSuffix}` shape used across the
 * existing API routes and MCP tools (see e.g. `/api/posts/[id]/like/route.ts`).
 * Adding new entities here keeps prefixes consistent across the codebase.
 */
export type IdPrefix =
  | "post"
  | "comment"
  | "like"
  | "bookmark"
  | "reaction"
  | "commentReaction"
  | "activity"
  | "notification"
  | "event"
  | "course"
  | "scheduledCourse"
  | "rsvp"
  | "enrollment"
  | "attachment";

// Legacy short prefixes — preserved to match existing rows in D1.
const PREFIX_OVERRIDES: Partial<Record<IdPrefix, string>> = {
  activity: "act",
  attachment: "att",
};

export function generateId(prefix: IdPrefix): string {
  const shortPrefix = PREFIX_OVERRIDES[prefix] ?? prefix;
  return `${shortPrefix}_${Math.random().toString(36).substring(2, 15)}`;
}
