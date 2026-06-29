import * as dotenv from 'dotenv'
dotenv.config()

import { PrismaClient } from '../src/generated/prisma'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

async function main() {
  console.log('Seeding chat channels...')

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaNeon(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    // Get an admin user to be the channel creator
    let adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
    })

    if (!adminUser) {
      console.log('No admin user found. Creating channels will require an admin user.')
      // Try to get any user
      adminUser = await prisma.user.findFirst()

      if (!adminUser) {
        console.log('No users found. Please create a user first by signing in.')
        return
      }
    }

    console.log(`Using user ${adminUser.name || adminUser.id} as channel creator`)

    const chatChannels = [
      { name: 'general', slug: 'general', icon: '💬', description: 'General chat and discussions', isDefault: true },
      { name: 'introductions', slug: 'introductions', icon: '👋', description: 'Introduce yourself to the community', isDefault: true },
      { name: 'help', slug: 'help', icon: '❓', description: 'Get help from the community', isDefault: true },
      { name: 'show-and-tell', slug: 'show-and-tell', icon: '✨', description: 'Share what you\'ve built', isDefault: false },
      { name: 'random', slug: 'random', icon: '🎲', description: 'Off-topic conversations', isDefault: false },
    ]

    for (const channel of chatChannels) {
      const existing = await prisma.channel.findUnique({
        where: { slug: channel.slug },
      })

      if (existing) {
        console.log(`Channel ${channel.slug} already exists`)
        continue
      }

      console.log(`Creating channel: ${channel.slug}`)
      await prisma.channel.create({
        data: {
          name: channel.name,
          slug: channel.slug,
          icon: channel.icon,
          description: channel.description,
          isDefault: channel.isDefault,
          createdById: adminUser.id,
        },
      })
    }

    console.log('Chat channels seeded successfully!')

    // List all channels
    const channels = await prisma.channel.findMany()
    console.log('\nExisting channels:')
    channels.forEach(c => console.log(`  - #${c.name} (${c.slug})`))

  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch(console.error)
