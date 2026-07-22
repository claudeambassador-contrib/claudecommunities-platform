"use server";

import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import {
  createResource,
  deleteResource,
  type ResourceInput,
  saveResource,
} from "@/lib/services/resources";

export type ResourceSaveResult = { ok: true; slug: string } | { ok: false; error: string };
export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * Server actions for the resources admin. Like the other admin CMS actions these
 * are server actions (not flat `/api`) so they run in the URL tenant's scope. Each
 * re-checks the permission; the service re-validates + re-enforces.
 */
async function requireEditor() {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || actor.isBanned || !hasPermission(actor, "resources.edit")) return null;
  return actor;
}

export async function createResourceAction(input: ResourceInput): Promise<ResourceSaveResult> {
  const actor = await requireEditor();
  if (!actor) return { ok: false, error: "You don't have permission to edit resources." };
  try {
    const slug = await createResource(actor, input);
    return { ok: true, slug };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function saveResourceAction(
  slug: string,
  input: ResourceInput,
): Promise<ResourceSaveResult> {
  const actor = await requireEditor();
  if (!actor) return { ok: false, error: "You don't have permission to edit resources." };
  try {
    const saved = await saveResource(actor, slug, input);
    return { ok: true, slug: saved };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteResourceAction(slug: string): Promise<DeleteResult> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor || actor.isBanned || !hasPermission(actor, "resources.delete")) {
    return { ok: false, error: "You don't have permission to delete resources." };
  }
  try {
    await deleteResource(actor, slug);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
