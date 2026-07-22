export const dynamic = "force-dynamic";

import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getResourceForEdit } from "@/lib/services/resources";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import ResourceEditor from "../ResourceEditor";

/** Edit an existing resource. Gated on `resources.view` (save needs `resources.edit`). */
export default async function EditResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const actor = await getCurrentUserWithPermissions();
  const base = await getTenantBase();
  if (!actor) redirect(tenantHref(base, "/login"));
  if (actor.isBanned || !hasPermission(actor, "resources.view")) {
    redirect(tenantHref(base, "/admin?error=unauthorized"));
  }

  const { slug } = await params;
  const resource = await getResourceForEdit(actor, slug).catch(() => null);
  if (!resource) notFound();

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
        <h1 className="text-xl font-semibold text-white truncate">Edit {resource.title || slug}</h1>
      </header>
      <ResourceEditor mode="edit" initial={resource} />
    </div>
  );
}
