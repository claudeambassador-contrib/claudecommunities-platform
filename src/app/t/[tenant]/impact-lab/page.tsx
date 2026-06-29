export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getPlatformPrisma } from "@/lib/prisma";
import { getConfig, getParticipantFromSession, publicConfig } from "@/lib/services/impactLab";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import Gate from "./Gate";

export default async function ImpactLabEntry() {
  const participant = await getParticipantFromSession();
  if (participant) redirect(tenantHref(await getTenantBase(), "/impact-lab/portal"));

  const db = await getPlatformPrisma();
  const config = await getConfig();
  const teams = await db.impactLabTeam.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return <Gate config={publicConfig(config)} teams={teams} />;
}
