import { PrismaClient } from '../src/generated/prisma'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" })
const prisma = new PrismaClient({ adapter })

const levels = [
  { level: 1, name: 'Community Ally', icon: '🌱', minPoints: 0, color: '#78716C' },
  { level: 2, name: 'Rising Star', icon: '⭐', minPoints: 100, color: '#CD7F32' },
  { level: 3, name: 'Trailblazer', icon: '🏃', minPoints: 300, color: '#C0C0C0' },
  { level: 4, name: 'Champion', icon: '🏆', minPoints: 600, color: '#FFD700' },
  { level: 5, name: 'Leader', icon: '👑', minPoints: 1000, color: '#8B5CF6' },
  { level: 6, name: 'Mentor', icon: '🎓', minPoints: 1500, color: '#3B82F6' },
  { level: 7, name: 'Ambassador', icon: '🌟', minPoints: 2500, color: '#14B8A6' },
  { level: 8, name: 'Legend', icon: '🔥', minPoints: 4000, color: '#D4836A' },
  { level: 9, name: 'Hero', icon: '💎', minPoints: 6000, color: '#EC4899' },
]

const spaceGroups = [
  { name: 'Start Here', icon: '📍', order: 0 },
  { name: 'Discussion', icon: '💬', order: 1 },
  { name: 'Resources', icon: '📚', order: 2 },
]

async function main() {
  console.log('Seeding leaderboard levels...')

  for (const level of levels) {
    await prisma.leaderboardLevel.upsert({
      where: { level: level.level },
      update: level,
      create: level,
    })
  }

  console.log('Seeding space groups...')

  for (const group of spaceGroups) {
    const existing = await prisma.spaceGroup.findFirst({
      where: { name: group.name },
    })

    if (!existing) {
      await prisma.spaceGroup.create({ data: group })
    }
  }

  // Assign existing spaces to groups
  const spaces = await prisma.space.findMany()
  const groups = await prisma.spaceGroup.findMany()

  const startHereGroup = groups.find(g => g.name === 'Start Here')
  const discussionGroup = groups.find(g => g.name === 'Discussion')

  for (const space of spaces) {
    if (!space.groupId) {
      const isStartHere = ['announcements', 'introductions', 'start-here', 'welcome'].includes(space.slug)
      const groupId = isStartHere ? startHereGroup?.id : discussionGroup?.id

      if (groupId) {
        await prisma.space.update({
          where: { id: space.id },
          data: { groupId },
        })
      }
    }
  }

  console.log('Done!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
