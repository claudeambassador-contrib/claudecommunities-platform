export const dynamic = "force-dynamic";

import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Can } from "@/components/admin/Can";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listResourcesAdmin } from "@/lib/services/resources";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import ResourcesListClient from "./ResourcesListClient";

/**
 * Resources CMS — manage the videos shown on the public `/resources` page. Gated
 * on `resources.view`; create/edit need `resources.edit`, delete `resources.delete`.
 */
export default async function ResourcesIndex() {
  const actor = await getCurrentUserWithPermissions();
  const base = await getTenantBase();
  if (!actor) redirect(tenantHref(base, "/login"));
  if (actor.isBanned || !hasPermission(actor, "resources.view")) {
    redirect(tenantHref(base, "/admin?error=unauthorized"));
  }

  const resources = await listResourcesAdmin(actor);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Resources</h1>
          <p className="text-sm text-[#78716C] mt-1">
            The videos on your public <span className="font-mono">/resources</span> page. Add
            walkthroughs and talks from your community — an empty list hides the section.
          </p>
        </div>
        <Can permission="resources.edit">
          <TenantLink
            href="/admin/resources/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D4836A] hover:bg-[#c4775f] text-white text-sm font-medium transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            New resource
          </TenantLink>
        </Can>
      </header>

      <ResourcesListClient resources={resources} />
    </div>
  );
}
