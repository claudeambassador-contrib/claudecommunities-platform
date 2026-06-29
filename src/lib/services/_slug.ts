/**
 * Shared slug utilities. Previously copy-pasted across
 * /api/events, /api/scheduled-courses, and lib/mcp/tools.ts — now a
 * single implementation that all services use.
 */
import { getPrisma } from "@/lib/prisma";
import { getTenantConfig } from "@/lib/tenant-config";

export function toSlug(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

type SluggableModel = "event" | "scheduledCourse" | "course";

/**
 * Builds a unique `<title>-<month>-<year>` slug, e.g. "intro-night-march-2026".
 * Shared by events and scheduled courses.
 */
export async function buildDateSlug(
  model: SluggableModel,
  title: string,
  startTime: Date,
): Promise<string> {
  const { lang } = await getTenantConfig();
  const month = startTime.toLocaleString(lang, { month: "long" }).toLowerCase();
  const year = startTime.getFullYear();
  return ensureUniqueSlug(model, `${toSlug(title)}-${month}-${year}`);
}

/**
 * Returns a slug that does not yet exist for the given model, appending
 * `-2`, `-3`, … as needed. Caller can pass an `ignoreId` so updates that
 * keep their existing slug do not collide with themselves.
 */
export async function ensureUniqueSlug(
  model: SluggableModel,
  base: string,
  opts: { ignoreId?: string } = {},
): Promise<string> {
  const db = await getPrisma();
  const baseSlug = toSlug(base);
  let candidate = baseSlug;
  let n = 1;
  type SlugDelegate = {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<{ id: string } | null>;
  };
  const delegate = (db as unknown as Record<SluggableModel, SlugDelegate>)[model];
  if (!delegate) {
    throw new Error(`ensureUniqueSlug: unknown model ${model}`);
  }
  while (true) {
    const where: Record<string, unknown> = { slug: candidate };
    if (opts.ignoreId) where.NOT = { id: opts.ignoreId };
    const existing = await delegate.findFirst({ where });
    if (!existing) return candidate;
    n += 1;
    candidate = `${baseSlug}-${n}`;
  }
}
