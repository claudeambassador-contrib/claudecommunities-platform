export const dynamic = "force-dynamic";

import { getPlatformPrisma } from "@/lib/prisma";
import { getCoffeePoolStatus, getConfig, isPortalAdmin } from "@/lib/services/impactLab";
import AdminDashboard from "./AdminDashboard";
import AdminLogin from "./AdminLogin";

export default async function ImpactLabAdminPage() {
  if (!(await isPortalAdmin())) {
    return <AdminLogin />;
  }

  const config = await getConfig();
  const db = await getPlatformPrisma();
  const [
    teams,
    participants,
    statements,
    schedule,
    resources,
    voteGroups,
    peoplesChoiceGroups,
    coffeePool,
  ] = await Promise.all([
    db.impactLabTeam.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { participants: true } } },
    }),
    db.impactLabParticipant.findMany({
      orderBy: { name: "asc" },
      include: { team: { select: { name: true } } },
    }),
    db.impactLabProblemStatement.findMany({ orderBy: { order: "asc" } }),
    db.impactLabScheduleItem.findMany({
      orderBy: [{ order: "asc" }, { startTime: "asc" }],
    }),
    db.impactLabResource.findMany({
      orderBy: [{ category: "asc" }, { order: "asc" }],
    }),
    db.impactLabVote.groupBy({
      by: ["statementId"],
      _count: { statementId: true },
    }),
    db.impactLabTeamVote.groupBy({
      by: ["teamId"],
      _count: { teamId: true },
    }),
    getCoffeePoolStatus(),
  ]);

  const tallies: Record<string, number> = {};
  for (const g of voteGroups) tallies[g.statementId] = g._count.statementId;
  const peoplesChoiceTallies: Record<string, number> = {};
  for (const g of peoplesChoiceGroups) peoplesChoiceTallies[g.teamId] = g._count.teamId;

  return (
    <AdminDashboard
      config={{
        eventName: config.eventName,
        eventTagline: config.eventTagline,
        eventDate: config.eventDate,
        accessCode: config.accessCode,
        coffeeNote: config.coffeeNote,
        checkInOpen: config.checkInOpen,
        votingOpen: config.votingOpen,
        winningStatementId: config.winningStatementId,
        peoplesChoiceOpen: config.peoplesChoiceOpen,
        peoplesChoiceWinnerTeamId: config.peoplesChoiceWinnerTeamId,
      }}
      teams={teams.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        tableNumber: t.tableNumber,
        count: t._count.participants,
        conceptTitle: t.conceptTitle,
        conceptSummary: t.conceptSummary,
        conceptRepoUrl: t.conceptRepoUrl,
        conceptSubmittedAt: t.conceptSubmittedAt?.toISOString() ?? null,
      }))}
      participants={participants.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role,
        teamId: p.teamId,
        teamName: p.team?.name ?? null,
        checkedIn: p.checkedIn,
        preRegistered: p.preRegistered,
        coffeeCode: p.coffeeCode,
        coffeeRedeemed: p.coffeeRedeemed,
        coffeeRedeemedAt: p.coffeeRedeemedAt?.toISOString() ?? null,
      }))}
      statements={statements.map((s) => ({
        id: s.id,
        title: s.title,
        summary: s.summary,
        description: s.description,
        order: s.order,
      }))}
      schedule={schedule.map((s) => ({
        id: s.id,
        startTime: s.startTime,
        title: s.title,
        description: s.description,
        track: s.track,
        order: s.order,
      }))}
      resources={resources.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        url: r.url,
        category: r.category,
        order: r.order,
      }))}
      tallies={tallies}
      peoplesChoiceTallies={peoplesChoiceTallies}
      coffeePool={{
        total: coffeePool.total,
        assigned: coffeePool.assigned,
        unassigned: coffeePool.unassigned,
        redeemed: coffeePool.redeemed,
        codes: coffeePool.codes.map((c) => ({
          id: c.id,
          code: c.code,
          order: c.order,
          participantName: c.participant?.name ?? null,
          participantEmail: c.participant?.email ?? null,
          teamName: c.participant?.team?.name ?? null,
          redeemed: c.participant?.coffeeRedeemed ?? false,
          redeemedAt: c.participant?.coffeeRedeemedAt?.toISOString() ?? null,
        })),
      }}
    />
  );
}
