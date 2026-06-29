export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { SocialSettings } from "@/components/admin/social/SocialSettings";
import { getCurrentUserWithPermissions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listAccounts } from "@/lib/services/socialAccounts";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";

interface PageProps {
  searchParams: Promise<{ connected?: string; error?: string }>;
}

export default async function SocialSettingsPage({ searchParams }: PageProps) {
  const user = await getCurrentUserWithPermissions();
  if (!user) redirect(tenantHref(await getTenantBase(), "/login"));
  if (!hasPermission(user, "social.manage"))
    redirect(tenantHref(await getTenantBase(), "/admin?error=unauthorized"));

  const accounts = await listAccounts(user);
  const params = await searchParams;

  return (
    <SocialSettings
      accounts={accounts}
      connectedCount={params.connected ? Number(params.connected) : null}
      error={params.error ?? null}
    />
  );
}
