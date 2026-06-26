-- ════════════════════════════════════════════════════════════════════
-- 0006_features.sql — nine new features in one migration.
--
-- Paste into the Supabase SQL editor and run once. Fully idempotent
-- (IF NOT EXISTS / re-runnable), safe to run on an existing database.
--
-- Covers:
--   1. Post reactions (emoji)        6. Event RSVP
--   2. Notifications feed            7. Group pinned announcements
--   3. Polls in posts                8. Reply (comment) likes
--   4. Profile skills/tags           9. Global search (no schema)
--   5. Resource upvotes
-- ════════════════════════════════════════════════════════════════════

-- ── 1. POST REACTIONS ──────────────────────────────────────────────────
-- One reaction per user per post; `emoji` holds the reaction key.
create table if not exists post_reactions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);
create index if not exists post_reactions_post_idx on post_reactions(post_id);

-- ── 2. NOTIFICATIONS ───────────────────────────────────────────────────
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,   -- recipient
  actor_id    uuid references users(id) on delete set null,           -- who triggered it
  type        text not null,    -- reply | reaction | follow | mentorship | group | rsvp
  entity_type text,             -- post | user | group | event
  entity_id   uuid,
  text        text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on notifications(user_id, is_read);

-- ── 3. POLLS IN POSTS ──────────────────────────────────────────────────
-- A post can have at most one poll. Options stored as a text array;
-- votes reference the option index (0-based).
create table if not exists post_polls (
  post_id    uuid primary key references posts(id) on delete cascade,
  question   text not null,
  options    text[] not null,
  created_at timestamptz not null default now()
);
create table if not exists poll_votes (
  post_id      uuid not null references posts(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  option_index integer not null,
  created_at   timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ── 4. PROFILE SKILLS / TAGS ───────────────────────────────────────────
alter table users add column if not exists skills text[] not null default '{}';

-- ── 5. RESOURCE UPVOTES ────────────────────────────────────────────────
alter table resources add column if not exists upvotes_count integer not null default 0;
create table if not exists resource_votes (
  resource_id uuid not null references resources(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (resource_id, user_id)
);

-- ── 6. EVENT RSVP ──────────────────────────────────────────────────────
alter table events add column if not exists rsvp_count integer not null default 0;
create table if not exists event_rsvps (
  event_id   uuid not null references events(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ── 7. GROUP PINNED ANNOUNCEMENTS ──────────────────────────────────────
alter table group_messages add column if not exists is_pinned boolean not null default false;

-- ── 8. REPLY (COMMENT) LIKES ───────────────────────────────────────────
-- replies.likes_count already exists in 0001_init.sql.
create table if not exists reply_likes (
  reply_id   uuid not null references replies(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);

-- ════════════════════════════════════════════════════════════════════
-- get_feed v2 — add reaction summary + poll flag to the feed payload.
-- Re-creatable; returns the same columns plus my_reaction, reactions_count,
-- has_poll. Backwards-compatible with the route.
-- ════════════════════════════════════════════════════════════════════
-- Drop first: create-or-replace cannot change the return columns of an
-- existing function (Postgres error 42P13).
drop function if exists get_feed(uuid, text, text, int, int);

create or replace function get_feed(
  viewer    uuid,
  p_tag     text,
  p_search  text,
  p_limit   int,
  p_offset  int
)
returns table (
  id              uuid,
  author_id       uuid,
  tag             text,
  title           text,
  body            text,
  image_path      text,
  likes_count     integer,
  comments_count  integer,
  bookmarks_count integer,
  is_hidden       boolean,
  is_anonymous    boolean,
  created_at      timestamptz,
  updated_at      timestamptz,
  author_name     text,
  author_role     text,
  department      text,
  graduation_year integer,
  liked           boolean,
  bookmarked      boolean,
  reactions_count integer,
  my_reaction     text,
  has_poll        boolean
)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    p.id, p.author_id, p.tag, p.title, p.body, p.image_path,
    p.likes_count, p.comments_count, p.bookmarks_count, p.is_hidden,
    p.is_anonymous,
    p.created_at, p.updated_at,
    u.name, u.role, u.department, u.graduation_year,
    exists(select 1 from post_likes     pl where pl.post_id = p.id and pl.user_id = viewer) as liked,
    exists(select 1 from post_bookmarks pb where pb.post_id = p.id and pb.user_id = viewer) as bookmarked,
    (select count(*) from post_reactions pr where pr.post_id = p.id)::int as reactions_count,
    (select pr.emoji from post_reactions pr where pr.post_id = p.id and pr.user_id = viewer) as my_reaction,
    exists(select 1 from post_polls pp where pp.post_id = p.id) as has_poll
  from posts p
  join users u on u.id = p.author_id
  where p.is_hidden = false
    and (p_tag    is null or p.tag   ilike '%' || p_tag    || '%')
    and (p_search is null or p.title ilike '%' || p_search || '%'
                          or p.body  ilike '%' || p_search || '%')
  order by p.created_at desc
  offset greatest(p_offset, 0)
  limit  least(greatest(p_limit, 1), 100);
$$;

revoke execute on function get_feed(uuid, text, text, int, int) from public, anon, authenticated;
grant  execute on function get_feed(uuid, text, text, int, int) to service_role;
