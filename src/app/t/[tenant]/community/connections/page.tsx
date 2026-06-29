export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import ConnectionsClient from "./ConnectionsClient";

export const metadata = {
  title: "Connections | Community",
  description: "Manage your connections and find new people to connect with",
};

export default async function ConnectionsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(tenantHref(await getTenantBase(), "/login"));
  }

  const userId = user?.id || "";

  return <ConnectionsClient currentUserId={userId} />;
}
