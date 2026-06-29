/**
 * Final cleanup:
 *   1. Tamara Fernandez → Team 7
 *   2. Saumya (saumya@neuwo.com.au) → Team 808
 *   3. Jack Thomas (jack.s.thomas@proton.me) → Team 18
 *   4. Delete every team with zero participants
 *
 * Deleting a team cascade-deletes any People's Choice votes for it, but
 * empty teams shouldn't have any (no members to vote for them).
 */
import prisma from "../src/lib/prisma";

type Move = { who: string; lookupEmail?: string; lookupName?: string; toTeam: string }
const MOVES: Move[] = [
  { who: 'Tamara Fernandez', lookupName: 'Tamara Fernandez', toTeam: 'Team 7' },
  { who: 'Saumya (neuwo)', lookupEmail: 'saumya@neuwo.com.au', toTeam: 'Team 808' },
  { who: 'Jack Thomas (proton)', lookupEmail: 'jack.s.thomas@proton.me', toTeam: 'Team 18' },
]

async function main() {
  for (const m of MOVES) {
    const team = await prisma.impactLabTeam.findUnique({
      where: { name: m.toTeam },
      select: { id: true },
    })
    if (!team) {
      console.log(`! ${m.who}: target team "${m.toTeam}" not found`)
      continue
    }
    const where = m.lookupEmail
      ? { email: m.lookupEmail }
      : { name: m.lookupName! }
    const p = await prisma.impactLabParticipant.findFirst({ where })
    if (!p) {
      console.log(`! ${m.who}: participant not found`)
      continue
    }
    if (p.teamId === team.id) {
      console.log(`= ${m.who} already on ${m.toTeam}`)
      continue
    }
    await prisma.impactLabParticipant.update({
      where: { id: p.id },
      data: { teamId: team.id },
    })
    console.log(`✓ moved ${p.name} <${p.email}> → ${m.toTeam}`)
  }

  // Delete teams with no members.
  const emptyTeams = await prisma.impactLabTeam.findMany({
    where: { participants: { none: {} } },
    select: { id: true, name: true },
  })
  console.log(`\nDeleting ${emptyTeams.length} empty team(s):`)
  for (const t of emptyTeams) {
    // Cascade will remove any orphaned People's Choice votes.
    await prisma.impactLabTeam.delete({ where: { id: t.id } })
    console.log(`  ✚ ${t.name}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
