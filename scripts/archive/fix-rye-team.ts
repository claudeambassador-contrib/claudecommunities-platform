import prisma from "../src/lib/prisma";

async function main() {
  const team = await prisma.impactLabTeam.findFirst({ where: { name: '999' } })
  if (!team) {
    console.log('Team 999 not found')
    return
  }
  const updated = await prisma.impactLabParticipant.update({
    where: { email: 'rye@rye.com' },
    data: { teamId: team.id },
  })
  console.log(`Moved ${updated.name} <${updated.email}> to team 999`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
