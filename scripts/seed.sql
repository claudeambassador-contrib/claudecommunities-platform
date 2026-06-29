-- Seed Spaces
INSERT OR IGNORE INTO "Space" (id, name, slug, icon, description, "order", "createdAt", "updatedAt") VALUES
  (lower(hex(randomblob(12))), 'Announcements', 'announcements', '📢', 'Official community announcements', 1, datetime('now'), datetime('now')),
  (lower(hex(randomblob(12))), 'Say Hello', 'say-hello', '👋', 'Introduce yourself to the community', 2, datetime('now'), datetime('now')),
  (lower(hex(randomblob(12))), 'General Discussion', 'general', '💬', 'Chat about anything Claude Code related', 3, datetime('now'), datetime('now')),
  (lower(hex(randomblob(12))), 'Show & Tell', 'show-tell', '✨', 'Share your projects and get feedback', 4, datetime('now'), datetime('now')),
  (lower(hex(randomblob(12))), 'Tips & Tricks', 'tips-tricks', '💡', 'Share your best prompts and workflows', 5, datetime('now'), datetime('now')),
  (lower(hex(randomblob(12))), 'Help & Questions', 'help', '❓', 'Get help from the community', 6, datetime('now'), datetime('now'));

-- Seed Leaderboard Levels
INSERT INTO "LeaderboardLevel" (id, level, name, icon, "minPoints", color, "createdAt") VALUES
  (lower(hex(randomblob(12))), 1, 'Community Ally', '🤝', 0, '#6B7280', datetime('now')),
  (lower(hex(randomblob(12))), 2, 'Rising Star', '⭐', 100, '#CD7F32', datetime('now')),
  (lower(hex(randomblob(12))), 3, 'Trailblazer', '🔥', 300, '#C0C0C0', datetime('now')),
  (lower(hex(randomblob(12))), 4, 'Champion', '🏆', 600, '#FFD700', datetime('now')),
  (lower(hex(randomblob(12))), 5, 'Leader', '👑', 1000, '#8B5CF6', datetime('now')),
  (lower(hex(randomblob(12))), 6, 'Mentor', '🎓', 1500, '#3B82F6', datetime('now')),
  (lower(hex(randomblob(12))), 7, 'Ambassador', '🌟', 2500, '#14B8A6', datetime('now')),
  (lower(hex(randomblob(12))), 8, 'Legend', '💎', 4000, '#D4836A', datetime('now')),
  (lower(hex(randomblob(12))), 9, 'Hero', '🦸', 6000, 'rainbow', datetime('now'))
ON CONFLICT (level) DO UPDATE SET
  name = excluded.name,
  icon = excluded.icon,
  "minPoints" = excluded."minPoints",
  color = excluded.color;
