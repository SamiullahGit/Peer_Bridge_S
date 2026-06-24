-- ════════════════════════════════════════════════════════════════════
-- 0005_follows.sql  — social follow system (Instagram/LinkedIn style)
--
-- * follows table: who follows whom (one row per relationship).
-- * Denormalized followers_count / following_count on users so the count
--   (and the "verified" tick at 100+ followers) is available wherever a
--   user is selected, without extra COUNT queries.
--
-- Run after 0001-0004. Safe to re-run (idempotent + recomputes counters).
-- ════════════════════════════════════════════════════════════════════

alter table users add column if not exists followers_count integer not null default 0;
alter table users add column if not exists following_count integer not null default 0;

create table if not exists follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid not null references users(id) on delete cascade,  -- the one doing the following
  following_id uuid not null references users(id) on delete cascade,  -- the one being followed
  created_at   timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists follows_following_idx on follows(following_id);
create index if not exists follows_follower_idx  on follows(follower_id);

alter table follows enable row level security;   -- backend uses the service key (bypasses RLS)

-- Recompute the denormalized counters from the source of truth (safe to re-run).
update users u set
  followers_count = (select count(*) from follows f where f.following_id = u.id),
  following_count = (select count(*) from follows f where f.follower_id  = u.id);
