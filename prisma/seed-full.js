const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database('./prisma/dev.db');

// Create all tables from schema

// Account table
db.exec(`
CREATE TABLE IF NOT EXISTS Account (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  providerAccountId TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE(provider, providerAccountId)
);
`);

// Session table
db.exec(`
CREATE TABLE IF NOT EXISTS Session (
  id TEXT PRIMARY KEY,
  sessionToken TEXT NOT NULL UNIQUE,
  userId TEXT NOT NULL,
  expires TEXT NOT NULL
);
`);

// VerificationToken table
db.exec(`
CREATE TABLE IF NOT EXISTS VerificationToken (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires TEXT NOT NULL,
  UNIQUE(identifier, token)
);
`);

// User table
db.exec(`
CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  emailVerified TEXT,
  password TEXT,
  image TEXT,
  coverImage TEXT,
  bio TEXT,
  location TEXT,
  website TEXT,
  twitter TEXT,
  linkedin TEXT,
  github TEXT,
  role TEXT DEFAULT 'member',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Space table
db.exec(`
CREATE TABLE IF NOT EXISTS Space (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT,
  isPrivate INTEGER DEFAULT 0,
  "order" INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Post table
db.exec(`
CREATE TABLE IF NOT EXISTS Post (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL,
  mediaUrl TEXT,
  mediaType TEXT,
  isPinned INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  authorId TEXT NOT NULL,
  spaceId TEXT NOT NULL
);
`);

// Comment table
db.exec(`
CREATE TABLE IF NOT EXISTS Comment (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  authorId TEXT NOT NULL,
  postId TEXT NOT NULL
);
`);

// Like table
db.exec(`
CREATE TABLE IF NOT EXISTS "Like" (
  id TEXT PRIMARY KEY,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  userId TEXT NOT NULL,
  postId TEXT NOT NULL,
  UNIQUE(userId, postId)
);
`);

// Event table
db.exec(`
CREATE TABLE IF NOT EXISTS Event (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  city TEXT,
  eventType TEXT DEFAULT 'meetup',
  startTime TEXT NOT NULL,
  endTime TEXT,
  maxAttendees INTEGER,
  isOnline INTEGER DEFAULT 0,
  meetingUrl TEXT,
  imageUrl TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// EventRSVP table
db.exec(`
CREATE TABLE IF NOT EXISTS EventRSVP (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'going',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  userId TEXT NOT NULL,
  eventId TEXT NOT NULL,
  UNIQUE(userId, eventId)
);
`);

// Conversation table
db.exec(`
CREATE TABLE IF NOT EXISTS Conversation (
  id TEXT PRIMARY KEY,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  lastMessageAt TEXT DEFAULT CURRENT_TIMESTAMP,
  user1Id TEXT NOT NULL,
  user2Id TEXT NOT NULL,
  UNIQUE(user1Id, user2Id)
);
`);

// Message table
db.exec(`
CREATE TABLE IF NOT EXISTS Message (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  isRead INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  senderId TEXT NOT NULL,
  conversationId TEXT NOT NULL
);
`);

console.log('All tables created!');

// Now seed the data
const hashedPassword = bcrypt.hashSync('password123', 10);

// Create admin user
db.prepare(`
INSERT OR REPLACE INTO User (id, name, email, password, bio, location, role, createdAt, updatedAt)
VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`).run('user_admin', 'Claude Admin', 'admin@claudecode.com.au', hashedPassword, 'Community administrator and founder.', 'Sydney, Australia', 'admin');

// Create demo users
db.prepare(`INSERT OR IGNORE INTO User (id, name, email, password, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).run('user_demo1', 'Sarah Chen', 'sarah@example.com', hashedPassword, 'member');
db.prepare(`INSERT OR IGNORE INTO User (id, name, email, password, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).run('user_demo2', 'James Wilson', 'james@example.com', hashedPassword, 'member');

// Create spaces
const spaces = [
  { id: 'space_1', name: 'Announcements', slug: 'announcements', description: 'Official announcements', color: '#EF4444' },
  { id: 'space_2', name: 'Say Hello', slug: 'say-hello', description: 'Introduce yourself!', color: '#F59E0B' },
  { id: 'space_3', name: 'General Discussion', slug: 'general', description: 'Chat about anything', color: '#10B981' },
  { id: 'space_4', name: 'Show & Tell', slug: 'show-tell', description: 'Show off your projects', color: '#8B5CF6' },
  { id: 'space_5', name: 'Tips & Tricks', slug: 'tips-tricks', description: 'Share your knowledge', color: '#3B82F6' },
  { id: 'space_6', name: 'Help & Questions', slug: 'help', description: 'Get help from the community', color: '#EC4899' },
];
spaces.forEach((s, i) => {
  db.prepare(`INSERT OR REPLACE INTO Space (id, name, slug, description, color, "order", createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).run(s.id, s.name, s.slug, s.description, s.color, i);
});

// Create posts
db.prepare(`INSERT OR REPLACE INTO Post (id, title, content, isPinned, authorId, spaceId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).run('post_1', 'Welcome to the Community!', 'Welcome everyone! This is our new community platform. Feel free to explore and connect with fellow members.', 1, 'user_admin', 'space_1');
db.prepare(`INSERT OR REPLACE INTO Post (id, content, authorId, spaceId, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`).run('post_2', 'Hi everyone! Excited to be here. Looking forward to learning from you all.', 'user_demo1', 'space_2');
db.prepare(`INSERT OR REPLACE INTO Post (id, content, authorId, spaceId, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`).run('post_3', 'Just discovered this community. The vibe here is amazing!', 'user_demo2', 'space_3');

// Create an event
db.prepare(`INSERT OR REPLACE INTO Event (id, title, description, location, city, eventType, startTime, isOnline, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).run('event_1', 'Sydney Meetup', 'Monthly community meetup in Sydney. Join us for networking and talks!', 'TechHub Sydney', 'Sydney', 'meetup', '2025-02-15T18:00:00.000Z', 0);
db.prepare(`INSERT OR REPLACE INTO Event (id, title, description, location, city, eventType, startTime, isOnline, meetingUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).run('event_2', 'Online Workshop: Getting Started', 'Learn the basics in this online workshop', 'Online', null, 'workshop', '2025-02-20T10:00:00.000Z', 1, 'https://meet.google.com/xxx');

// Create badges
const badges = [
  { id: 'badge_founder', name: 'Founder', description: 'Original community founder', icon: '👑', color: '#FFD700' },
  { id: 'badge_early', name: 'Early Adopter', description: 'Joined in the first month', icon: '🌟', color: '#9333EA' },
  { id: 'badge_contributor', name: 'Top Contributor', description: 'Active community contributor', icon: '🔥', color: '#EF4444' },
  { id: 'badge_helper', name: 'Helpful Member', description: 'Helps others in the community', icon: '🤝', color: '#10B981' },
  { id: 'badge_creator', name: 'Content Creator', description: 'Creates valuable content', icon: '✨', color: '#3B82F6' },
  { id: 'badge_verified', name: 'Verified', description: 'Verified community member', icon: '✓', color: '#0EA5E9' },
];
badges.forEach(b => {
  db.prepare('INSERT OR REPLACE INTO Badge (id, name, description, icon, color) VALUES (?, ?, ?, ?, ?)').run(b.id, b.name, b.description, b.icon, b.color);
});

// Assign badges to users
db.prepare('INSERT OR IGNORE INTO UserBadge (id, userId, badgeId) VALUES (?, ?, ?)').run('ub_1', 'user_admin', 'badge_founder');
db.prepare('INSERT OR IGNORE INTO UserBadge (id, userId, badgeId) VALUES (?, ?, ?)').run('ub_2', 'user_admin', 'badge_verified');
db.prepare('INSERT OR IGNORE INTO UserBadge (id, userId, badgeId) VALUES (?, ?, ?)').run('ub_3', 'user_demo1', 'badge_early');

console.log('Data seeded successfully!');
db.close();
