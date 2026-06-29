import * as dotenv from 'dotenv'
dotenv.config()

import { neon } from '@neondatabase/serverless'

async function main() {
  console.log('DATABASE_URL loaded:', !!process.env.DATABASE_URL)

  const sql = neon(process.env.DATABASE_URL!)

  // Seed Spaces
  const spaces = [
    { name: 'Announcements', slug: 'announcements', icon: '📢', description: 'Official community announcements', order: 1 },
    { name: 'Say Hello', slug: 'say-hello', icon: '👋', description: 'Introduce yourself to the community', order: 2 },
    { name: 'General Discussion', slug: 'general', icon: '💬', description: 'Chat about anything Claude Code related', order: 3 },
    { name: 'Show & Tell', slug: 'show-tell', icon: '✨', description: 'Share your projects and get feedback', order: 4 },
    { name: 'Tips & Tricks', slug: 'tips-tricks', icon: '💡', description: 'Share your best prompts and workflows', order: 5 },
    { name: 'Help & Questions', slug: 'help', icon: '❓', description: 'Get help from the community', order: 6 },
  ]

  console.log('Inserting spaces...')
  for (const space of spaces) {
    await sql`
      INSERT INTO "Space" (id, name, slug, icon, description, "order", "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid()::text,
        ${space.name},
        ${space.slug},
        ${space.icon},
        ${space.description},
        ${space.order},
        NOW(),
        NOW()
      )
      ON CONFLICT (slug) DO NOTHING
    `
    console.log(` - ${space.slug}`)
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

  console.log('Inserting leaderboard levels...')
  for (const lvl of leaderboardLevels) {
    await sql`
      INSERT INTO "LeaderboardLevel" (id, level, name, icon, "minPoints", color, "createdAt")
      VALUES (
        gen_random_uuid()::text,
        ${lvl.level},
        ${lvl.name},
        ${lvl.icon},
        ${lvl.minPoints},
        ${lvl.color},
        NOW()
      )
      ON CONFLICT (level) DO UPDATE SET
        name = ${lvl.name},
        icon = ${lvl.icon},
        "minPoints" = ${lvl.minPoints},
        color = ${lvl.color}
    `
    console.log(` - Level ${lvl.level}: ${lvl.name}`)
  }
  console.log('Leaderboard levels seeded!')

  // Seed Badges
  const badges = [
    { name: 'Sydney City Lead', icon: '🏙️', color: '#3B82F6', description: 'City lead for Sydney' },
    { name: 'Adelaide City Lead', icon: '🏙️', color: '#8B5CF6', description: 'City lead for Adelaide' },
  ]

  console.log('Inserting badges...')
  for (const badge of badges) {
    const existing = await sql`SELECT id FROM "Badge" WHERE name = ${badge.name}`
    if (existing.length === 0) {
      await sql`
        INSERT INTO "Badge" (id, name, description, icon, color, "createdAt")
        VALUES (
          gen_random_uuid()::text,
          ${badge.name},
          ${badge.description},
          ${badge.icon},
          ${badge.color},
          NOW()
        )
      `
      console.log(` - ${badge.name}`)
    } else {
      console.log(` - ${badge.name} (already exists)`)
    }
  }
  console.log('Badges seeded!')

  console.log('\nSeed data created successfully!')
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1) })
