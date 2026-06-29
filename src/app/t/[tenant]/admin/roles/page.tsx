export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PERMISSION_GROUPS, PERMISSIONS } from "@/lib/permissions";
import { actorFromUser } from "@/lib/services/_auth";
import { listRoles } from "@/lib/services/roles";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import RolesClient from "./RolesClient";

export default async function AdminRolesPage() {
  const user = await getCurrentUser();
  if (!user) redirect(tenantHref(await getTenantBase(), "/login"));

  const actor = await actorFromUser(user);
  if (!actor.permissions.includes("roles.view")) {
    redirect(tenantHref(await getTenantBase(), "/admin?error=unauthorized"));
  }

  const roles = await listRoles(actor);
  const canEdit = actor.permissions.includes("roles.edit");
  const canDelete = actor.permissions.includes("roles.delete");

  return (
    <RolesClient
      initialRoles={roles}
      canEdit={canEdit}
      canDelete={canDelete}
      permissionCatalog={PERMISSIONS}
      permissionGroups={PERMISSION_GROUPS}
      currentRoleName={actor.role}
    />
  );
}
