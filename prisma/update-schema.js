const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

// Add new tables for the features
const statements = [
  // Add lastSeen and isOnboarded to User if not exists
  `ALTER TABLE User ADD COLUMN lastSeen TEXT DEFAULT (datetime('now'))`,
  `ALTER TABLE User ADD COLUMN isOnboarded INTEGER DEFAULT 0`,

  // Bookmark table
  `CREATE TABLE IF NOT EXISTS Bookmark (
    id TEXT PRIMARY KEY,
    createdAt TEXT DEFAULT (datetime('now')),
    userId TEXT NOT NULL,
    postId TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
    FOREIGN KEY (postId) REFERENCES Post(id) ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS Bookmark_userId_postId ON Bookmark(userId, postId)`,

  // Poll tables
  `CREATE TABLE IF NOT EXISTS Poll (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    endsAt TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    postId TEXT NOT NULL UNIQUE,
    FOREIGN KEY (postId) REFERENCES Post(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS PollOption (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    "order" INTEGER DEFAULT 0,
    pollId TEXT NOT NULL,
    FOREIGN KEY (pollId) REFERENCES Poll(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS PollVote (
    id TEXT PRIMARY KEY,
    createdAt TEXT DEFAULT (datetime('now')),
    userId TEXT NOT NULL,
    optionId TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
    FOREIGN KEY (optionId) REFERENCES PollOption(id) ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS PollVote_userId_optionId ON PollVote(userId, optionId)`,

  // Attachment table
  `CREATE TABLE IF NOT EXISTS Attachment (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    postId TEXT NOT NULL,
    FOREIGN KEY (postId) REFERENCES Post(id) ON DELETE CASCADE
  )`,

  // Mention table
  `CREATE TABLE IF NOT EXISTS Mention (
    id TEXT PRIMARY KEY,
    createdAt TEXT DEFAULT (datetime('now')),
    userId TEXT NOT NULL,
    postId TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
    FOREIGN KEY (postId) REFERENCES Post(id) ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS Mention_userId_postId ON Mention(userId, postId)`,

  // Activity table
  `CREATE TABLE IF NOT EXISTS Activity (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    userId TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
  )`,

  // Add parentId to Comment for threading
  `ALTER TABLE Comment ADD COLUMN parentId TEXT REFERENCES Comment(id) ON DELETE CASCADE`
];

for (const sql of statements) {
  try {
    db.exec(sql);
    console.log('OK:', sql.substring(0, 50) + '...');
  } catch (e) {
    if (e.message.includes('duplicate column') || e.message.includes('already exists')) {
      console.log('SKIP (exists):', sql.substring(0, 40) + '...');
    } else {
      console.log('ERR:', e.message);
    }
  }
}

db.close();
console.log('\nSchema updated successfully!');
