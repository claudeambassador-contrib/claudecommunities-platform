import prisma from "../src/lib/prisma";
;(async () => {
  const team = await prisma.impactLabTeam.findFirst({ where: { name: '999' } })
  console.log(JSON.stringify(team, null, 2))
  await prisma.$disconnect()
})()
