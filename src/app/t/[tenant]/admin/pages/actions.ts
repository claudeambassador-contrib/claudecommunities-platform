"use server";

import { getCurrentUserWithPermissions } from "@/lib/auth";
import type { Block } from "@/lib/cms/blocks";
import { hasPermission } from "@/lib/permissions";
import {
  type ContentPageInput,
  createContentPage,
  deleteContentPage,
  saveHomeSections,
  updateContentPage,
} from "@/lib/services/pages";

export type SaveResult = { ok: true } | { ok: false; error: string };
export type PageSaveResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Persist this community's home-page sections. A SERVER ACTION (not a flat
 * `/api` route) so it always runs in the URL tenant's scope — under path-prefix
 * tenancy (`/<slug>/admin/pages`) the action POSTs to the tenant subtree and
 * `getTenantId()` (inside the service) resolves the right community, where a flat
 * `/api/*` call would mis-scope. Gates `pages.edit` for THIS tenant; the service
 * re-validates the payload and re-checks the permission as defense-in-depth.
 */
export async function saveHomePage(blocks: Block[]): Promise<SaveResult> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor) return { ok: false, error: "Not signed in" };
  if (actor.isBanned || !hasPermission(actor, "pages.edit")) {
    return { ok: false, error: "You don't have permission to edit the home page." };
  }

  try {
    await saveHomeSections(actor, blocks);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/** Shared `pages.edit` gate for the content-page actions below. Returns the actor or null. */
async function requirePageEditor() {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || actor.isBanned || !hasPermission(actor, "pages.edit")) return null;
  return actor;
}

export async function createPage(input: ContentPageInput): Promise<PageSaveResult> {
  const actor = await requirePageEditor();
  if (!actor) return { ok: false, error: "You don't have permission to create pages." };
  try {
    const page = await createContentPage(actor, input);
    return { ok: true, id: page.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updatePage(id: string, input: ContentPageInput): Promise<PageSaveResult> {
  const actor = await requirePageEditor();
  if (!actor) return { ok: false, error: "You don't have permission to edit pages." };
  try {
    const page = await updateContentPage(actor, id, input);
    return { ok: true, id: page.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deletePage(id: string): Promise<SaveResult> {
  const actor = await requirePageEditor();
  if (!actor) return { ok: false, error: "You don't have permission to delete pages." };
  try {
    await deleteContentPage(actor, id);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
