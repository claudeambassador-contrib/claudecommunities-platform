import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getCurrentUser } from "@/lib/auth";
import { getActorPermissions, hasAnyAdminPermission } from "@/lib/permissions";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const base = await getTenantBase();
  if (!user) redirect(tenantHref(base, "/login"));

  // Admin gate is per-tenant: membership role for the URL tenant, not User.role.
  // Cross-tenant tooling (provisioning communities) now lives in the platform
  // console at the apex `/admin`, NOT inside a community's admin.
  const { permissions } = await getActorPermissions(user.id);
  if (!hasAnyAdminPermission({ permissions })) {
    redirect(tenantHref(base, "/community?error=unauthorized"));
  }

  return <AdminShell permissions={permissions}>{children}</AdminShell>;
}
