export const dynamic = "force-dynamic";

import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { TenantLink } from "@/components/TenantBaseProvider";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getIndustryForEdit } from "@/lib/services/industries";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import IndustryEditor from "../IndustryEditor";

/** Edit an industry landing page (a built-in override or a custom one). */
export default async function EditIndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const actor = await getCurrentUserWithPermissions();
  const base = await getTenantBase();
  if (!actor) redirect(tenantHref(base, "/login"));
  if (actor.isBanned || !hasPermission(actor, "pages.view")) {
    redirect(tenantHref(base, "/admin?error=unauthorized"));
  }

  const { slug } = await params;
  const loaded = await getIndustryForEdit(actor, slug).catch(() => null);
  if (!loaded) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <TenantLink
        href="/admin/industries"
        className="inline-flex items-center gap-1.5 text-sm text-[#78716C] hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Industries
      </TenantLink>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-white">
          Edit {loaded.vertical.name || loaded.vertical.slug}
          {loaded.builtIn && !loaded.custom && (
            <span className="ml-2 text-xs font-normal text-[#78716C]">
              (built-in — saving creates an editable copy for your community)
            </span>
          )}
        </h1>
      </header>
      <IndustryEditor mode="edit" initial={loaded.vertical} slugLocked />
    </div>
  );
}
