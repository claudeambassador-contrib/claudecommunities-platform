/**
 * Fixes 5 known real/placeholder duplicate pairs that earlier fuzzy
 * matching missed (different first-name tokens between the placeholder
 * and the real check-in).
 *
 * For each pair:
 *   - Move the real check-in to the placeholder's team (if no team).
 *   - Delete the placeholder.
 *   - Release any pool code claimed by the placeholder.
 *
 * Re-runnable safely.
 */
import prisma from "../src/lib/prisma";

const PAIRS: Array<{ placeholderName: string; realEmail: string; targetTeamName: string }> = [
  // Fithri (real) is already on Team 1 — just delete the placeholder.
  { placeholderName: 'Fithriyah Shalihah', realEmail: 'fshalihah@gmail.com', targetTeamName: 'Team 1' },
  // Oliver Chan (real, no team) → Team 2; delete Wing Lok Oliver Chan placeholder.
  { placeholderName: 'Wing Lok Oliver Chan', realEmail: 'oliverloklokchan@gmail.com', targetTeamName: 'Team 2' },
  // Saumya Mutneja real (saumyamutneja10@gmail.com, no team) → Team 808.
  { placeholderName: 'Saumya Mutneja', realEmail: 'saumyamutneja10@gmail.com', targetTeamName: 'Team 808' },
  // Fiona L (real, no team) → Team 12.
  { placeholderName: 'Fiona Lai', realEmail: 'fionaisdesigning@gmail.com', targetTeamName: 'Team 12' },
  // Jahnavi D (real, no team) → Team 2.
  { placeholderName: 'Jahnavi Datla', realEmail: 'jahnavidatla02@gmail.com', targetTeamName: 'Team 2' },
]

async function main() {
  for (const { placeholderName, realEmail, targetTeamName } of PAIRS) {
    console.log(`\n• ${placeholderName} (${targetTeamName})`)
    const placeholder = await prisma.impactLabParticipant.findFirst({
      where: { name: placeholderName, email: { endsWith: '@impactlab.local' } },
    })
    if (!placeholder) {
      console.log(`  ! placeholder not found — skipping`)
      continue
    }
    const real = await prisma.impactLabParticipant.findUnique({
      where: { email: realEmail },
    })
    if (!real) {
      console.log(`  ! real check-in <${realEmail}> not found — leaving placeholder in place`)
      continue
    }
    const team = await prisma.impactLabTeam.findUnique({
      where: { name: targetTeamName },
      select: { id: true },
    })
    if (!team) {
      console.log(`  ! team ${targetTeamName} not found — skipping`)
      continue
    }
    if (real.teamId !== team.id) {
      await prisma.impactLabParticipant.update({
        where: { id: real.id },
        data: { teamId: team.id },
      })
      console.log(`  ✓ moved real ${real.name} to ${targetTeamName}`)
    } else {
      console.log(`  = real ${real.name} already on ${targetTeamName}`)
    }
    // Release placeholder's pool code so it returns to unassigned
    await prisma.impactLabCoffeeCode.updateMany({
      where: { participantId: placeholder.id },
      data: { participantId: null },
    })
    await prisma.impactLabParticipant.delete({ where: { id: placeholder.id } })
    console.log(`  ✚ deleted placeholder ${placeholder.name} <${placeholder.email}>`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
