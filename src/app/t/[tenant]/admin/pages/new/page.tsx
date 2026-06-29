export const dynamic = "force-dynamic";

import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import ContentPageEditor from "../ContentPageEditor";

/** Create a new tenant content page. Gated on `pages.edit`. */
export default async function NewPage() {
  const actor = await getCurrentUserWithPermissions();
  const base = await getTenantBase();
  if (!actor) redirect(tenantHref(base, "/login"));
  if (actor.isBanned || !hasPermission(actor, "pages.edit")) {
    redirect(tenantHref(base, "/admin?error=unauthorized"));
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <TenantLink
        href="/admin/pages"
        className="inline-flex items-center gap-1.5 text-sm text-[#78716C] hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Pages
      </TenantLink>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-white">New page</h1>
      </header>
      <ContentPageEditor mode="create" />
    </div>
  );
}
