const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'dev.db');
const db = new Database(dbPath);

/**
 * Seed function to populate the LeaderboardLevel table with 9 levels
 *
 * Levels are based on Circle.so gamification system:
 * - Level 1: Community Ally (gray) - 0 points
 * - Level 2: Rising Star (bronze) - 100 points
 * - Level 3: Trailblazer (silver) - 300 points
 * - Level 4: Champion (gold) - 600 points
 * - Level 5: Leader (purple) - 1000 points
 * - Level 6: Mentor (blue) - 1500 points
 * - Level 7: Ambassador (teal) - 2500 points
 * - Level 8: Legend (orange/coral #D4836A) - 4000 points
 * - Level 9: Hero (rainbow gradient) - 6000 points
 */

console.log('Seeding leaderboard levels...');

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
];

const now = new Date().toISOString();

// Generate a simple unique ID
function generateId() {
  return 'lvl_' + Math.random().toString(36).substring(2, 15);
}

const insertLevel = db.prepare(`
  INSERT OR REPLACE INTO LeaderboardLevel (id, level, name, icon, minPoints, color, createdAt)
  VALUES (@id, @level, @name, @icon, @minPoints, @color, @createdAt)
`);

for (const lvl of leaderboardLevels) {
  // Check if level already exists
  const existing = db.prepare('SELECT id FROM LeaderboardLevel WHERE level = ?').get(lvl.level);

  insertLevel.run({
    id: existing?.id || generateId(),
    level: lvl.level,
    name: lvl.name,
    icon: lvl.icon,
    minPoints: lvl.minPoints,
    color: lvl.color,
    createdAt: now,
  });

  console.log(`  Level ${lvl.level}: ${lvl.icon} ${lvl.name} (${lvl.minPoints}+ points)`);
}

console.log('\nLeaderboard levels seeded successfully!');
console.log('\nLevel breakdown:');
console.log('----------------');

const levels = db.prepare('SELECT * FROM LeaderboardLevel ORDER BY level ASC').all();
levels.forEach(l => {
  console.log(`  ${l.icon} Level ${l.level}: ${l.name} - ${l.minPoints}+ points (${l.color})`);
});

db.close();
