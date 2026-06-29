import * as dotenv from 'dotenv'
dotenv.config()

import { PrismaClient } from '../src/generated/prisma'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// Configure WebSocket for Node.js environment
neonConfig.webSocketConstructor = ws

async function main() {
  console.log('DATABASE_URL loaded:', !!process.env.DATABASE_URL)

  console.log('Creating Pool...')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  console.log('Creating PrismaNeon adapter...')
  const adapter = new PrismaNeon(pool)
  console.log('Creating PrismaClient...')
  const prisma = new PrismaClient({ adapter })
  console.log('PrismaClient created, starting operations...')

  try {
    const spaces = [
      { name: 'Announcements', slug: 'announcements', icon: '📢', description: 'Official community announcements', order: 1 },
      { name: 'Say Hello', slug: 'say-hello', icon: '👋', description: 'Introduce yourself to the community', order: 2 },
      { name: 'General Discussion', slug: 'general', icon: '💬', description: 'Chat about anything Claude Code related', order: 3 },
      { name: 'Show & Tell', slug: 'show-tell', icon: '✨', description: 'Share your projects and get feedback', order: 4 },
      { name: 'Tips & Tricks', slug: 'tips-tricks', icon: '💡', description: 'Share your best prompts and workflows', order: 5 },
      { name: 'Help & Questions', slug: 'help', icon: '❓', description: 'Get help from the community', order: 6 },
    ]

    console.log('About to upsert spaces...')
    for (const space of spaces) {
      console.log(`Upserting space: ${space.slug}`)
      await prisma.space.upsert({
        where: { slug: space.slug },
        update: {},
        create: space,
      })
    }

    console.log('Spaces seeded!')

    // Seed Leaderboard Levels
    const leaderboardLevels = [
      { level: 1, name: 'Community Ally', icon: '🤝', minPoints: 0, color: '#6B7280' },
      { level: 2, name: 'Rising Star', icon: '⭐', minPoints: 100, color: '#CD7F32' },
      { level: 3, name: 'Trailblazer', icon: '🔥', minPoints: 300, color: '#C0C0C0' },
      { level: 4, name: 'Champion', icon: '🏆', minPoints: 600, color: '#FFD700' },
      { level: 5, name: 'Leader', icon: '👑', minPoints: 1000, color: '#8B5CF6' },
      { level: 6, name: 'Mentor', icon: '🎓', minPoints: 1500, color: '#3B82F6' },
      { level: 7, name: 'Ambassador', icon: '🌟', minPoints: 2500, color: '#14B8A6' },
      { level: 8, name: 'Legend', icon: '💎', minPoints: 4000, color: '#D4836A' },
      { level: 9, name: 'Hero', icon: '🦸', minPoints: 6000, color: 'rainbow' },
    ]

    for (const level of leaderboardLevels) {
      await prisma.leaderboardLevel.upsert({
        where: { level: level.level },
        update: {
          name: level.name,
          icon: level.icon,
          minPoints: level.minPoints,
          color: level.color,
        },
        create: level,
      })
    }

    console.log('Leaderboard levels seeded!')

    // Seed Default Chat Channels
    // First, get or create a system user for channel creation
    let systemUser = await prisma.user.findFirst({
      where: { role: 'admin' },
    })

    if (!systemUser) {
      // Create a placeholder admin user if none exists
      systemUser = await prisma.user.create({
        data: {
          clerkId: 'system-admin',
          name: 'System',
          email: 'system@claudecode.community',
          role: 'admin',
        },
      })
    }

    const chatChannels = [
      { name: 'general', slug: 'general', icon: '💬', description: 'General chat and discussions', isDefault: true, order: 1 },
      { name: 'introductions', slug: 'introductions', icon: '👋', description: 'Introduce yourself to the community', isDefault: true, order: 2 },
      { name: 'help', slug: 'help', icon: '❓', description: 'Get help from the community', isDefault: true, order: 3 },
      { name: 'show-and-tell', slug: 'show-and-tell', icon: '✨', description: 'Share what you\'ve built', isDefault: false, order: 4 },
      { name: 'random', slug: 'random', icon: '🎲', description: 'Off-topic conversations', isDefault: false, order: 5 },
    ]

    for (const channel of chatChannels) {
      const existing = await prisma.channel.findUnique({
        where: { slug: channel.slug },
      })

      if (!existing) {
        console.log(`Creating chat channel: ${channel.slug}`)
        await prisma.channel.create({
          data: {
            name: channel.name,
            slug: channel.slug,
            icon: channel.icon,
            description: channel.description,
            isDefault: channel.isDefault,
            createdById: systemUser.id,
          },
        })
      }
    }

    console.log('Chat channels seeded!')
    console.log('Seed data created!')
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
