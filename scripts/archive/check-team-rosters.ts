import prisma from "../src/lib/prisma";

async function main() {
  const teams = await prisma.impactLabTeam.findMany({
    orderBy: { name: 'asc' },
    include: {
      participants: {
        select: { name: true, role: true, email: true },
        orderBy: { name: 'asc' },
      },
    },
  })
  const sorted = [...teams].sort((a, b) => {
    const an = a.tableNumber ? Number.parseInt(a.tableNumber, 10) : 9999
    const bn = b.tableNumber ? Number.parseInt(b.tableNumber, 10) : 9999
    return an - bn
  })
  for (const t of sorted) {
    console.log(`\n${t.name} (table ${t.tableNumber ?? '?'}) — ${t.participants.length} members`)
    for (const p of t.participants) {
      const flag = p.role !== 'participant' ? `[${p.role}]` : ''
      console.log(`  - ${p.name} ${flag}`)
    }
  }
  const unassigned = await prisma.impactLabParticipant.findMany({
    where: { teamId: null },
    select: { name: true, role: true, email: true },
    orderBy: { name: 'asc' },
  })
  console.log(`\nUnassigned — ${unassigned.length}`)
  for (const p of unassigned) {
    const flag = p.role !== 'participant' ? `[${p.role}]` : ''
    console.log(`  - ${p.name} ${flag}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
