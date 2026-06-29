export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getPlatformPrisma } from "@/lib/prisma";
import { getConfig, getParticipantFromSession, publicConfig } from "@/lib/services/impactLab";
import { getTenantBase, tenantHref } from "@/lib/tenant-base";
import Portal from "./Portal";

export default async function PortalPage() {
  const participant = await getParticipantFromSession();
  if (!participant) redirect(tenantHref(await getTenantBase(), "/impact-lab"));

  const config = await getConfig();
  const db = await getPlatformPrisma();

  const [
    statements,
    schedule,
    resources,
    teammates,
    teams,
    voteGroups,
    peoplesChoiceGroups,
    checkedInCount,
  ] = await Promise.all([
    db.impactLabProblemStatement.findMany({ orderBy: { order: "asc" } }),
    db.impactLabScheduleItem.findMany({
      orderBy: [{ order: "asc" }, { startTime: "asc" }],
    }),
    db.impactLabResource.findMany({
      orderBy: [{ category: "asc" }, { order: "asc" }],
    }),
    participant.teamId
      ? db.impactLabParticipant.findMany({
          where: { teamId: participant.teamId },
          select: { id: true, name: true, role: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    db.impactLabTeam.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        tableNumber: true,
        conceptTitle: true,
        conceptRepoUrl: true,
      },
    }),
    db.impactLabVote.groupBy({
      by: ["statementId"],
      _count: { statementId: true },
    }),
    db.impactLabTeamVote.groupBy({
      by: ["teamId"],
      _count: { teamId: true },
    }),
    db.impactLabParticipant.count({ where: { checkedIn: true } }),
  ]);

  const tallies: Record<string, number> = {};
  for (const g of voteGroups) tallies[g.statementId] = g._count.statementId;
  const peoplesChoiceTallies: Record<string, number> = {};
  for (const g of peoplesChoiceGroups) peoplesChoiceTallies[g.teamId] = g._count.teamId;

  return (
    <Portal
      config={publicConfig(config)}
      me={{
        name: participant.name,
        email: participant.email,
        role: participant.role,
        coffeeCode: participant.coffeeCode,
        coffeeRedeemed: participant.coffeeRedeemed,
        coffeeRedeemedAt: participant.coffeeRedeemedAt?.toISOString() ?? null,
        team: participant.team
          ? {
              id: participant.team.id,
              name: participant.team.name,
              color: participant.team.color,
              tableNumber: participant.team.tableNumber,
              conceptTitle: participant.team.conceptTitle,
              conceptSummary: participant.team.conceptSummary,
              conceptRepoUrl: participant.team.conceptRepoUrl,
              conceptSubmittedAt: participant.team.conceptSubmittedAt?.toISOString() ?? null,
            }
          : null,
        votedStatementId: participant.vote?.statementId ?? null,
        peoplesChoiceVoteTeamId: participant.peoplesChoiceVote?.teamId ?? null,
      }}
      teammates={teammates}
      teams={teams.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        tableNumber: t.tableNumber,
        conceptTitle: t.conceptTitle,
        conceptRepoUrl: t.conceptRepoUrl,
      }))}
      peoplesChoiceTallies={peoplesChoiceTallies}
      statements={statements.map((s) => ({
        id: s.id,
        title: s.title,
        summary: s.summary,
        description: s.description,
      }))}
      schedule={schedule.map((s) => ({
        id: s.id,
        startTime: s.startTime,
        title: s.title,
        description: s.description,
        track: s.track,
      }))}
      resources={resources.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        url: r.url,
        category: r.category,
      }))}
      tallies={tallies}
      checkedInCount={checkedInCount}
    />
  );
}
