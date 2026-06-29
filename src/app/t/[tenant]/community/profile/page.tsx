import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";

export default async function ProfileRedirectPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  redirect(tenantHref(await getTenantBase(), `/community/profile/${currentUser.id}`));
}
