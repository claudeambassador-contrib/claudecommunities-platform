const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'dev.db');
const db = new Database(dbPath);

console.log('Creating LeaderboardLevel table...');

// Create the LeaderboardLevel table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS "LeaderboardLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" INTEGER NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "minPoints" INTEGER NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log('LeaderboardLevel table created successfully!');

db.close();
