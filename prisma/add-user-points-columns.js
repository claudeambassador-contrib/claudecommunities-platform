const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'dev.db');
const db = new Database(dbPath);

console.log('Adding points and level columns to User table...');

// Check if columns exist
const tableInfo = db.prepare("PRAGMA table_info(User)").all();
const hasPoints = tableInfo.some(col => col.name === 'points');
const hasLevel = tableInfo.some(col => col.name === 'level');

if (!hasPoints) {
  db.exec('ALTER TABLE User ADD COLUMN points INTEGER NOT NULL DEFAULT 0');
  console.log('  Added points column');
} else {
  console.log('  points column already exists');
}

if (!hasLevel) {
  db.exec('ALTER TABLE User ADD COLUMN level INTEGER NOT NULL DEFAULT 1');
  console.log('  Added level column');
} else {
  console.log('  level column already exists');
}

console.log('Done!');

db.close();
