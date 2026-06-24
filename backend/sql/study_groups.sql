-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Study groups table
CREATE TABLE IF NOT EXISTS study_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  topic        TEXT,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  member_count INT  NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Group membership table
CREATE TABLE IF NOT EXISTS group_members (
  group_id  UUID REFERENCES study_groups(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- Group messages table
CREATE TABLE IF NOT EXISTS group_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID REFERENCES study_groups(id) ON DELETE CASCADE,
  sender_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anonymous posts support (add column if posts table exists)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast message retrieval per group
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_group_members_user   ON group_members(user_id);
