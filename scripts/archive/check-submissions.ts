import prisma from "../src/lib/prisma";
;(async () => {
  const teams = await prisma.impactLabTeam.findMany({
    where: { conceptSubmittedAt: { not: null } },
    select: {
      name: true,
      conceptTitle: true,
      conceptRepoUrl: true,
      conceptSubmittedAt: true,
    },
  })
  console.log(`${teams.length} teams have a submission:`)
  for (const t of teams) {
    console.log(
      `  ${t.name.padEnd(15)}  title="${t.conceptTitle}"  repo=${t.conceptRepoUrl ?? 'null'}`,
    )
  }
  await prisma.$disconnect()
})()
