const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'dev.db');
const db = new Database(dbPath);

// Create the spaces
const spaces = [
  { name: 'Announcements', slug: 'announcements', icon: '📢', description: 'Official community announcements', order: 1, color: '#EF4444' },
  { name: 'Say Hello', slug: 'say-hello', icon: '👋', description: 'Introduce yourself to the community', order: 2, color: '#F59E0B' },
  { name: 'General Discussion', slug: 'general', icon: '💬', description: 'Chat about anything Claude Code related', order: 3, color: '#10B981' },
  { name: 'Show & Tell', slug: 'show-tell', icon: '✨', description: 'Share your projects and get feedback', order: 4, color: '#8B5CF6' },
  { name: 'Tips & Tricks', slug: 'tips-tricks', icon: '💡', description: 'Share your best prompts and workflows', order: 5, color: '#3B82F6' },
  { name: 'Help & Questions', slug: 'help', icon: '❓', description: 'Get help from the community', order: 6, color: '#EC4899' },
];

const insertSpace = db.prepare(`
  INSERT OR REPLACE INTO Space (id, name, slug, icon, description, color, "order", createdAt, updatedAt)
  VALUES (@id, @name, @slug, @icon, @description, @color, @order, @createdAt, @updatedAt)
`);

const now = new Date().toISOString();

for (const space of spaces) {
  insertSpace.run({
    id: `space_${space.slug}`,
    name: space.name,
    slug: space.slug,
    icon: space.icon,
    description: space.description,
    color: space.color,
    order: space.order,
    createdAt: now,
    updatedAt: now,
  });
}

console.log('Spaces seeded successfully!');

// Create a demo user
const insertUser = db.prepare(`
  INSERT OR REPLACE INTO User (id, name, email, password, createdAt, updatedAt)
  VALUES (@id, @name, @email, @password, @createdAt, @updatedAt)
`);

insertUser.run({
  id: 'user_demo',
  name: 'Demo User',
  email: 'demo@example.com',
  password: 'demo123',
  createdAt: now,
  updatedAt: now,
});

console.log('Demo user created!');

// Create some demo posts
const insertPost = db.prepare(`
  INSERT OR REPLACE INTO Post (id, title, content, authorId, spaceId, createdAt, updatedAt)
  VALUES (@id, @title, @content, @authorId, @spaceId, @createdAt, @updatedAt)
`);

const posts = [
  {
    id: 'post_1',
    title: 'Welcome to Claude Code Meetups Australia!',
    content: 'We are excited to launch our community platform! Join us at upcoming meetups in Sydney, Melbourne, Brisbane, Perth, and Adelaide.',
    spaceId: 'space_announcements',
  },
  {
    id: 'post_2',
    title: 'Introduce yourself',
    content: 'Hi everyone! Use this thread to introduce yourself to the community. Tell us what city you are in and what you are building with Claude Code!',
    spaceId: 'space_say-hello',
  },
  {
    id: 'post_3',
    title: 'My first vibe coding project',
    content: 'Just built my first app using Claude Code! It is a simple task tracker and I learned so much along the way. Happy to share my prompts if anyone is interested.',
    spaceId: 'space_show-tell',
  },
  {
    id: 'post_4',
    title: 'Tip: Use specific examples in your prompts',
    content: 'I have found that giving Claude specific examples of what you want makes a huge difference. Instead of saying "make it look nice", try "use a coral color scheme with rounded buttons".',
    spaceId: 'space_tips-tricks',
  },
];

for (const post of posts) {
  insertPost.run({
    ...post,
    authorId: 'user_demo',
    createdAt: now,
    updatedAt: now,
  });
}

console.log('Demo posts created!');

// Create some demo events
const insertEvent = db.prepare(`
  INSERT OR REPLACE INTO Event (id, title, description, location, date, capacity, hostId, createdAt, updatedAt)
  VALUES (@id, @title, @description, @location, @date, @capacity, @hostId, @createdAt, @updatedAt)
`);

const events = [
  {
    id: 'event_sydney',
    title: 'Sydney Claude Code Meetup',
    description: 'Join us for an evening of AI-powered coding, networking, and live demos at our Sydney meetup!',
    location: 'Sydney CBD',
    date: new Date('2025-02-15T18:00:00').toISOString(),
    capacity: 50,
  },
  {
    id: 'event_melbourne',
    title: 'Melbourne Claude Code Meetup',
    description: 'Connect with Melbourne developers and vibe coders exploring the future of AI development.',
    location: 'Melbourne CBD',
    date: new Date('2025-02-22T18:00:00').toISOString(),
    capacity: 40,
  },
];

for (const event of events) {
  insertEvent.run({
    ...event,
    hostId: 'user_demo',
    createdAt: now,
    updatedAt: now,
  });
}

console.log('Demo events created!');
console.log('Database seeded successfully!');

db.close();
