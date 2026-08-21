CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY NOT NULL,
  org_id TEXT NOT NULL,
  requester_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS connections_org_pair ON connections (org_id, requester_id, receiver_id);
CREATE INDEX IF NOT EXISTS connections_org_receiver_idx ON connections (org_id, receiver_id, status);
