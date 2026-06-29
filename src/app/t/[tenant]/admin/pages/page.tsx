export const dynamic = "force-dynamic";

import { LayoutTemplate, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Can } from "@/components/admin/Can";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listContentPages } from "@/lib/services/pages";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import PagesListClient from "./PagesListClient";

/**
 * Pages CMS — the page manager. Lists the home page (edited via the block CMS)
 * plus tenant-authored content pages, grouped by folder. Gated on `pages.view`;
 * create/edit/delete controls are additionally gated with `pages.edit`.
 */
export default async function PagesIndex() {
  const actor = await getCurrentUserWithPermissions();
  const base = await getTenantBase();
  if (!actor) redirect(tenantHref(base, "/login"));
  if (actor.isBanned || !hasPermission(actor, "pages.view")) {
    redirect(tenantHref(base, "/admin?error=unauthorized"));
  }

  const pages = await listContentPages(actor);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Pages</h1>
          <p className="text-sm text-[#78716C] mt-1">
            Edit your home page, and create your own pages and folders. Link to a page from your
            footer (in community settings) using its path.
          </p>
        </div>
        <Can permission="pages.edit">
          <TenantLink
            href="/admin/pages/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D4836A] hover:bg-[#c4775f] text-white text-sm font-medium transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            New page
          </TenantLink>
        </Can>
      </header>

      <TenantLink
        href="/admin/pages/home"
        className="flex items-center gap-3 p-4 mb-6 bg-[#2D2926] rounded-xl border border-white/[0.06] hover:border-[#D4836A]/50 transition-colors"
      >
        <LayoutTemplate className="w-5 h-5 text-[#D4836A] shrink-0" />
        <div>
          <div className="text-base font-semibold text-white">Home page</div>
          <div className="text-xs text-[#78716C]">The landing page at /</div>
        </div>
      </TenantLink>

      <PagesListClient pages={pages} />
    </div>
  );
}
