import prisma from "../src/lib/prisma";

async function main() {
  const team = await prisma.impactLabTeam.findFirst({
    where: {
      OR: [{ name: 'Team 999' }, { tableNumber: '999' }],
    },
    include: {
      participants: {
        select: {
          id: true,
          name: true,
          email: true,
          checkedIn: true,
          sessionToken: true,
        },
      },
    },
  })
  console.log('Team 999:')
  if (!team) {
    console.log('  not found by name "Team 999" or tableNumber 999')
  } else {
    console.log(`  id=${team.id}  name=${team.name}  tableNumber=${team.tableNumber}`)
    console.log(`  members: ${team.participants.length}`)
    for (const p of team.participants) {
      console.log(
        `    - ${p.name.padEnd(28)} <${p.email}>  checkedIn=${p.checkedIn}  hasSession=${Boolean(p.sessionToken)}`,
      )
    }
  }
  // Also list all teams to see what names actually exist
  const all = await prisma.impactLabTeam.findMany({
    select: { name: true, tableNumber: true, _count: { select: { participants: true } } },
    orderBy: { name: 'asc' },
  })
  console.log('\nAll teams:')
  for (const t of all) {
    console.log(`  ${t.name.padEnd(20)} table=${t.tableNumber ?? '?'}  members=${t._count.participants}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
