CREATE TABLE IF NOT EXISTS scheduled_courses (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  location TEXT,
  city TEXT,
  timezone TEXT,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  is_online INTEGER NOT NULL DEFAULT 0,
  meeting_url TEXT,
  image_url TEXT,
  registration_url TEXT,
  course_type TEXT NOT NULL DEFAULT 'workshop',
  is_published INTEGER NOT NULL DEFAULT 0,
  price TEXT,
  instructor TEXT,
  max_attendees INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS scheduled_courses_org_slug ON scheduled_courses (org_id, slug);
CREATE INDEX IF NOT EXISTS scheduled_courses_org_start ON scheduled_courses (org_id, start_time);

CREATE TABLE IF NOT EXISTS likes (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS likes_org_user_post ON likes (org_id, user_id, post_id);
