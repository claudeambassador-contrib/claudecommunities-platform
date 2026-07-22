export const dynamic = "force-dynamic";

import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import ResourceEditor from "../ResourceEditor";

/** Create a new resource video. Gated on `resources.edit`. */
export default async function NewResourcePage() {
  const actor = await getCurrentUserWithPermissions();
  const base = await getTenantBase();
  if (!actor) redirect(tenantHref(base, "/login"));
  if (actor.isBanned || !hasPermission(actor, "resources.edit")) {
    redirect(tenantHref(base, "/admin?error=unauthorized"));
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <TenantLink
        href="/admin/resources"
        className="inline-flex items-center gap-1.5 text-sm text-[#78716C] hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Resources
      </TenantLink>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-white">New resource</h1>
      </header>
      <ResourceEditor mode="create" />
    </div>
  );
}
