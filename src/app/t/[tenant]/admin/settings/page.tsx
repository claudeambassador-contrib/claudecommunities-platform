export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getTenantRegistry } from "@/lib/services/tenants";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import { getTenantConfig } from "@/lib/tenant-config";
import { getTenantId } from "@/lib/tenant-context";
import SettingsClient from "./SettingsClient";

/**
 * Per-community settings — a tenant admin editing THEIR own community
 * (everything except the immutable slug). Gated on the per-tenant
 * `tenant.settings` permission. The platform console (apex `/admin`) is where
 * communities are provisioned/suspended; this is self-service branding/config.
 */
export default async function CommunitySettingsPage() {
  const actor = await getCurrentUserWithPermissions();
  const base = await getTenantBase();
  if (!actor) redirect(tenantHref(base, "/login"));
  if (actor.isBanned || !hasPermission(actor, "tenant.settings")) {
    redirect(tenantHref(base, "/admin?error=unauthorized"));
  }

  const slug = await getTenantId();
  const [config, registry] = await Promise.all([getTenantConfig(), getTenantRegistry(slug)]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-white">Community settings</h1>
        <p className="text-sm text-[#78716C] mt-1">
          Edit how <span className="text-[#A8A29E]">{registry?.name ?? slug}</span> looks and
          behaves. The URL slug <code className="text-[#A8A29E]">/{slug}</code> is permanent.
        </p>
      </header>
      <SettingsClient
        slug={slug}
        name={registry?.name ?? ""}
        customDomain={registry?.customDomain ?? ""}
        config={config}
      />
    </div>
  );
}
