export const dynamic = "force-dynamic";

import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Can } from "@/components/admin/Can";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listIndustriesAdmin } from "@/lib/services/industries";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import IndustriesListClient from "./IndustriesListClient";

/**
 * Industries CMS — manage the `/for/<slug>` landing pages. Built-in industries
 * (from the region's `@/lib/verticals`) can be customized in place; you can also
 * add net-new ones. Gated on `pages.view`; create/edit/delete need `pages.edit`.
 */
export default async function IndustriesIndex() {
  const actor = await getCurrentUserWithPermissions();
  const base = await getTenantBase();
  if (!actor) redirect(tenantHref(base, "/login"));
  if (actor.isBanned || !hasPermission(actor, "pages.view")) {
    redirect(tenantHref(base, "/admin?error=unauthorized"));
  }

  const industries = await listIndustriesAdmin(actor);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Industries</h1>
          <p className="text-sm text-[#78716C] mt-1">
            The industry landing pages at <span className="font-mono">/for/&lt;path&gt;</span>. Edit
            the built-ins or add your own. Link to them from your footer (in community settings)
            using the path.
          </p>
        </div>
        <Can permission="pages.edit">
          <TenantLink
            href="/admin/industries/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D4836A] hover:bg-[#c4775f] text-white text-sm font-medium transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            New industry
          </TenantLink>
        </Can>
      </header>

      <IndustriesListClient industries={industries} />
    </div>
  );
}
