-- ════════════════════════════════════════════════════════════════════
-- 0007_more_features.sql — three more features.
--
-- Paste into the Supabase SQL editor and run once. Idempotent / re-runnable.
--
--   5. Chat attachments (DM + group: image / file / voice note)
--   6. Nested replies (reply-to-reply threads)
--   7. Saved collections (organise bookmarked posts into folders)
-- ════════════════════════════════════════════════════════════════════

-- ── 5. CHAT ATTACHMENTS ─────────────────────────────────────────────────
-- A message may carry one attachment. type ∈ image | file | audio.
alter table messages       add column if not exists attachment_url  text;
alter table messages       add column if not exists attachment_type text;
alter table messages       add column if not exists attachment_name text;
alter table group_messages add column if not exists attachment_url  text;
alter table group_messages add column if not exists attachment_type text;
alter table group_messages add column if not exists attachment_name text;
-- Allow attachment-only messages (no text body).
alter table messages       alter column text drop not null;
alter table group_messages alter column text drop not null;

-- ── 6. NESTED REPLIES ───────────────────────────────────────────────────
-- A reply can point at a parent reply (one level of threading in the UI;
-- the column supports arbitrary depth if you want it later).
alter table replies add column if not exists parent_id uuid references replies(id) on delete cascade;
create index if not exists replies_parent_idx on replies(parent_id);

-- ── 7. SAVED COLLECTIONS ────────────────────────────────────────────────
create table if not exists collections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index if not exists collections_user_idx on collections(user_id);

create table if not exists collection_items (
  collection_id uuid not null references collections(id) on delete cascade,
  post_id       uuid not null references posts(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (collection_id, post_id)
);
