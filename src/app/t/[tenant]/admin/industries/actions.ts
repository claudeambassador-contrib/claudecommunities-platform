"use server";

import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createIndustry, deleteIndustry, saveIndustry } from "@/lib/services/industries";
import type { Vertical } from "@/lib/verticals";

export type IndustrySaveResult = { ok: true; slug: string } | { ok: false; error: string };
export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * Server actions for the industry-pages CMS. Like the home-page actions these
 * are server actions (not flat `/api`) so they run in the URL tenant's scope.
 * Each re-checks `pages.edit`; the service re-validates + re-enforces.
 */
async function requireEditor() {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || actor.isBanned || !hasPermission(actor, "pages.edit")) return null;
  return actor;
}

export async function createIndustryAction(input: Vertical): Promise<IndustrySaveResult> {
  const actor = await requireEditor();
  if (!actor) return { ok: false, error: "You don't have permission to edit industry pages." };
  try {
    const slug = await createIndustry(actor, input);
    return { ok: true, slug };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function saveIndustryAction(
  slug: string,
  input: Vertical,
): Promise<IndustrySaveResult> {
  const actor = await requireEditor();
  if (!actor) return { ok: false, error: "You don't have permission to edit industry pages." };
  try {
    const saved = await saveIndustry(actor, slug, input);
    return { ok: true, slug: saved };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteIndustryAction(slug: string): Promise<DeleteResult> {
  const actor = await requireEditor();
  if (!actor) return { ok: false, error: "You don't have permission to edit industry pages." };
  try {
    await deleteIndustry(actor, slug);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
