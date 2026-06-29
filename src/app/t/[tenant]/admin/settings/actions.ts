"use server";

import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { updateTenantConfig } from "@/lib/services/tenants";
import type { TenantConfig } from "@/lib/tenant-config";
import { getTenantId } from "@/lib/tenant-context";

export interface SaveCommunitySettingsInput {
  config: Partial<TenantConfig>;
  name?: string;
  customDomain?: string | null;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Persist this community's settings. A SERVER ACTION (not a flat `/api` route) so
 * it always runs in the URL tenant's scope — under path-prefix tenancy
 * (`/<slug>/admin/settings`) the action POSTs to the tenant subtree and
 * `getTenantId()` resolves the right community, where a flat `/api/*` call would
 * mis-scope to the home tenant. Authorizes `tenant.settings` for THIS tenant.
 */
export async function saveCommunitySettings(
  input: SaveCommunitySettingsInput,
): Promise<SaveResult> {
  const actor = await getCurrentUserWithPermissions();
  if (!actor) return { ok: false, error: "Not signed in" };
  if (actor.isBanned || !hasPermission(actor, "tenant.settings")) {
    return { ok: false, error: "You don't have permission to edit community settings." };
  }

  const slug = await getTenantId();
  try {
    await updateTenantConfig(slug, {
      config: input.config,
      name: input.name,
      customDomain: input.customDomain,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
