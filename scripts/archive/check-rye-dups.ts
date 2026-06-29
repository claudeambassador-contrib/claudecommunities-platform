import prisma from "../src/lib/prisma";

async function main() {
  const rows = await prisma.impactLabParticipant.findMany({
    where: {
      OR: [
        { email: { contains: 'spruik' } },
        { email: { contains: 'rye' } },
        { name: { contains: 'rye' } },
        { name: { contains: 'smith' } },
      ],
    },
    select: {
      name: true,
      email: true,
      teamId: true,
      team: { select: { name: true } },
      sessionToken: true,
      checkedIn: true,
    },
  })
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(20)} <${r.email.padEnd(35)}>  team=${r.team?.name ?? 'none'}  checkedIn=${r.checkedIn}  hasSession=${Boolean(r.sessionToken)}`,
    )
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
