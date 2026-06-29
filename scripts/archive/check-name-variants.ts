import prisma from "../src/lib/prisma";

async function main() {
  const matches = await prisma.impactLabParticipant.findMany({
    where: {
      role: 'participant',
      OR: [
        { name: { contains: 'Fithri' } },
        { name: { contains: 'Oliver' } },
        { name: { contains: 'Wing' } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      team: { select: { name: true } },
    },
  })
  for (const p of matches) {
    console.log(
      `  ${p.name.padEnd(28)} <${p.email.padEnd(40)}>  team=${p.team?.name ?? 'none'}`,
    )
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
