-- Run in Supabase SQL Editor after study_groups.sql

-- Add invite code to groups
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- Add admin/member role to memberships
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

-- Backfill: creators become admins
UPDATE group_members gm
SET role = 'admin'
FROM study_groups sg
WHERE sg.id = gm.group_id AND sg.created_by = gm.user_id;

-- Backfill: generate invite codes for existing groups
UPDATE study_groups
SET invite_code = UPPER(SUBSTRING(MD5(id::text || random()::text), 1, 8))
WHERE invite_code IS NULL;

-- Make invite_code unique
ALTER TABLE study_groups ADD CONSTRAINT study_groups_invite_code_key UNIQUE (invite_code);
