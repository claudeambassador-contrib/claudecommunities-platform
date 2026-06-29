import prisma from "../src/lib/prisma";

async function main() {
  // Anything still on Team 4 or Team 10 (which the sheet doesn't use)?
  const lookups = [
    'Jack Thomas',
    'Saumya',
  ]
  for (const name of lookups) {
    const all = await prisma.impactLabParticipant.findMany({
      where: { name: { equals: name } },
      select: { name: true, email: true, role: true, team: { select: { name: true } } },
    })
    console.log(`\n${name}:`)
    for (const p of all) {
      console.log(`  ${p.role.padEnd(10)} <${p.email.padEnd(40)}>  team=${p.team?.name ?? 'none'}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
