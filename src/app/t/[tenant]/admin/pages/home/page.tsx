export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { getHomeSections } from "@/lib/cms/home";
import { hasPermission } from "@/lib/permissions";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import PagesClient from "../PagesClient";

/**
 * Home Page CMS editor — a tenant admin editing THEIR community's home page
 * sections. Gated on `pages.view` (mirrors the settings precedent). The editor's
 * action-bearing controls are additionally gated with `<Can permission="pages.edit">`
 * client-side, and the save server action + service re-enforce `pages.edit`.
 */
export default async function HomePageCmsPage() {
  const actor = await getCurrentUserWithPermissions();
  const base = await getTenantBase();
  if (!actor) redirect(tenantHref(base, "/login"));
  if (actor.isBanned || !hasPermission(actor, "pages.view")) {
    redirect(tenantHref(base, "/admin?error=unauthorized"));
  }

  const blocks = await getHomeSections();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-white">Home page</h1>
        <p className="text-sm text-[#78716C] mt-1">
          Reorder, enable, and edit the sections that build your community home page. Empty fields
          fall back to the community defaults.
        </p>
      </header>
      <PagesClient initialBlocks={blocks} />
    </div>
  );
}
