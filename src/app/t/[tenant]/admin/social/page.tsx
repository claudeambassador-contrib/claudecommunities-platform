export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SocialDashboard } from "@/components/admin/social/SocialDashboard";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listAccounts } from "@/lib/services/socialAccounts";
import { listPosts } from "@/lib/services/socialPosts";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";

export default async function SocialPage() {
  const user = await getCurrentUserWithPermissions();
  if (!user) redirect(tenantHref(await getTenantBase(), "/login"));
  if (!hasPermission(user, "social.view"))
    redirect(tenantHref(await getTenantBase(), "/admin?error=unauthorized"));

  const [accounts, posts] = await Promise.all([
    listAccounts(user),
    listPosts(user, { range: "all", limit: 200 }),
  ]);

  const zernioDryRun = process.env.ZERNIO_DRY_RUN === "true" || process.env.ZERNIO_DRY_RUN === "1";

  return (
    <SocialDashboard initialAccounts={accounts} initialPosts={posts} zernioDryRun={zernioDryRun} />
  );
}
