export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listCitiesAdmin } from "@/lib/services/cities";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import CitiesClient from "./CitiesClient";

/**
 * Per-tenant city catalog editor — a tenant admin managing THEIR community's
 * cities/regions (shown in the footer and on city landing pages). Gated on
 * `cities.view` (mirrors the settings/pages precedent). The editor's
 * action-bearing controls are additionally gated with `<Can permission="cities.edit">`
 * client-side, and the save server actions + service re-enforce `cities.edit`.
 */
export default async function CitiesPage() {
  const actor = await getCurrentUserWithPermissions();
  const base = await getTenantBase();
  if (!actor) redirect(tenantHref(base, "/login"));
  if (actor.isBanned || !hasPermission(actor, "cities.view")) {
    redirect(tenantHref(base, "/admin?error=unauthorized"));
  }

  const cities = await listCitiesAdmin(actor);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-white">Cities</h1>
        <p className="text-sm text-[#78716C] mt-1">
          Manage the cities and regions shown in your footer and on city landing pages. Reorder them
          to control how they appear.
        </p>
      </header>
      <CitiesClient initialCities={cities} />
    </div>
  );
}
