-- ════════════════════════════════════════════════════════════════════
-- Peer Bridge — Supabase / PostgreSQL schema (0001_init.sql)
--
-- Paste the whole file into the Supabase dashboard SQL editor and run it
-- once. It is idempotent-ish: it drops the Peer Bridge tables/functions
-- first, so re-running gives you a clean schema.
--
-- Design notes (why these exact types):
--   * Primary keys are uuid (gen_random_uuid()) — drop-in for Mongo's
--     ObjectId; the frontend treats every id as an opaque string.
--   * COUNTS are `integer`, RATING/HOURS are `double precision`. This is
--     deliberate: PostgREST returns `numeric` columns as JSON *strings*
--     but integer/float8 as JSON *numbers*. The frontend relies on these
--     being numbers (e.g. `{rating || '0.0'}` must see falsy 0).
--   * created_at/updated_at are timestamptz (ISO strings, parse-identical
--     to the old Mongoose output). event_date is `date`, event_time is
--     `text` to preserve the "HH:mm" string verbatim.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ── Clean slate (safe to re-run) ───────────────────────────────────────
drop function if exists adjust_counter(text, uuid, text, int) cascade;
drop function if exists get_conversations(uuid) cascade;
drop function if exists touch_updated_at() cascade;
drop table if exists xp_notifications     cascade;
drop table if exists xp_transactions      cascade;
drop table if exists certificates         cascade;
drop table if exists reports              cascade;
drop table if exists events               cascade;
drop table if exists resources            cascade;
drop table if exists ratings              cascade;
drop table if exists messages             cascade;
drop table if exists mentorship_requests  cascade;
drop table if exists post_bookmarks       cascade;
drop table if exists post_likes           cascade;
drop table if exists replies              cascade;
drop table if exists posts                cascade;
drop table if exists users                cascade;

-- ── USERS ──────────────────────────────────────────────────────────────
create table users (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  email                 text not null unique,
  password_hash         text,
  role                  text not null default 'student' check (role in ('student','mentor','admin')),
  department            text,
  graduation_year       integer,
  bio                   text,
  profile_image         text,
  is_verified           boolean not null default false,
  otp_code              text,
  otp_expires           timestamptz,
  rating                double precision not null default 0,
  rating_count          integer not null default 0,
  sessions_count        integer not null default 0,
  is_online             boolean not null default false,
  is_locked             boolean not null default false,
  is_under_review       boolean not null default false,
  total_xp              integer not null default 0,
  xp_level              text not null default 'Bronze',
  total_students_helped integer not null default 0,
  total_hours_helped    double precision not null default 0,
  last_login_xp_date    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── POSTS ──────────────────────────────────────────────────────────────
create table posts (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references users(id) on delete cascade,
  tag             text not null check (tag in ('Academic Help','Career & Internships','Resources','Events & Societies')),
  title           text not null,
  body            text,
  image_path      text,
  likes_count     integer not null default 0,
  comments_count  integer not null default 0,
  bookmarks_count integer not null default 0,
  is_hidden       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index posts_author_idx     on posts(author_id);
create index posts_tag_idx        on posts(tag);
create index posts_created_at_idx on posts(created_at desc);

-- ── REPLIES ────────────────────────────────────────────────────────────
create table replies (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  author_id   uuid not null references users(id) on delete cascade,
  text        text not null,
  likes_count integer not null default 0,
  created_at  timestamptz not null default now()
);
create index replies_post_idx on replies(post_id);

-- ── POST LIKES / BOOKMARKS (join tables) ───────────────────────────────
create table post_likes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  post_id    uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create table post_bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  post_id    uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

-- ── MENTORSHIP REQUESTS ────────────────────────────────────────────────
create table mentorship_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references users(id) on delete cascade,
  mentor_id    uuid not null references users(id) on delete cascade,
  message      text,
  status       text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at   timestamptz not null default now()
);
create index mreq_requester_idx on mentorship_requests(requester_id);
create index mreq_mentor_idx    on mentorship_requests(mentor_id);

-- ── MESSAGES ───────────────────────────────────────────────────────────
create table messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references users(id) on delete cascade,
  receiver_id uuid not null references users(id) on delete cascade,
  text        text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index messages_sender_idx     on messages(sender_id);
create index messages_receiver_idx   on messages(receiver_id);
create index messages_created_at_idx on messages(created_at desc);

-- ── RATINGS ────────────────────────────────────────────────────────────
create table ratings (
  id         uuid primary key default gen_random_uuid(),
  rater_id   uuid not null references users(id) on delete cascade,
  mentor_id  uuid not null references users(id) on delete cascade,
  score      integer not null check (score between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  unique (rater_id, mentor_id)
);

-- ── RESOURCES ──────────────────────────────────────────────────────────
create table resources (
  id              uuid primary key default gen_random_uuid(),
  uploader_id     uuid not null references users(id) on delete cascade,
  title           text not null,
  description     text,
  file_path       text,
  file_name       text,
  file_type       text,
  file_size       bigint,
  category        text default 'Other',
  course_code     text,
  downloads_count integer not null default 0,
  created_at      timestamptz not null default now()
);
create index resources_category_idx on resources(category);

-- ── EVENTS ─────────────────────────────────────────────────────────────
create table events (
  id           uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references users(id) on delete cascade,
  title        text not null,
  description  text,
  venue        text not null,
  event_date   date not null,
  event_time   text,              -- "HH:mm" string, preserved verbatim
  category     text default 'Other',
  image_path   text,
  created_at   timestamptz not null default now()
);
create index events_date_idx on events(event_date);

-- ── REPORTS (target_id is polymorphic -> no FK) ────────────────────────
create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id) on delete cascade,
  target_type text not null check (target_type in ('post','user','resource')),
  target_id   uuid not null,
  reason      text not null check (reason in ('Spam','Harassment','Inappropriate','Misinformation')),
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_target_idx on reports(target_type, target_id);

-- ── CERTIFICATES ───────────────────────────────────────────────────────
create table certificates (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  cert_number    text not null unique,
  xp_snapshot    integer not null,
  level_snapshot text not null,
  file_path      text,
  created_at     timestamptz not null default now()
);
create index certificates_user_idx on certificates(user_id);

-- ── XP TRANSACTIONS (ref_id polymorphic -> no FK) ──────────────────────
create table xp_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  points     integer not null,
  reason     text not null,
  ref_type   text,
  ref_id     uuid,
  created_at timestamptz not null default now()
);
create index xp_tx_user_idx on xp_transactions(user_id);

-- ── XP NOTIFICATIONS ───────────────────────────────────────────────────
create table xp_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  points      integer not null default 0,
  message     text not null,
  is_level_up boolean not null default false,
  new_level   text,
  is_sent     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index xp_notif_user_idx on xp_notifications(user_id);
create index xp_notif_sent_idx on xp_notifications(is_sent);

-- ════════════════════════════════════════════════════════════════════
-- updated_at auto-touch (parity with Mongoose `timestamps`)
-- ════════════════════════════════════════════════════════════════════
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger users_touch before update on users
  for each row execute function touch_updated_at();
create trigger posts_touch before update on posts
  for each row execute function touch_updated_at();

-- ════════════════════════════════════════════════════════════════════
-- adjust_counter — atomic replacement for Mongo's $inc, with the ">0"
-- floor that the like/bookmark toggles rely on. Table/column names are
-- supplied only by our own server code (never user input) and are
-- safely quoted with %I.
-- ════════════════════════════════════════════════════════════════════
create or replace function adjust_counter(p_table text, p_id uuid, p_column text, p_delta int)
returns void
language plpgsql security definer as $$
begin
  execute format(
    'update %I set %I = greatest(0, coalesce(%I, 0) + $1) where id = $2',
    p_table, p_column, p_column
  ) using p_delta, p_id;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- get_conversations — inbox list: newest message per partner + unread
-- count. Faithful port of the Mongo aggregation (originally a SQL window
-- function before the Mongo migration). Returns exactly the columns the
-- /api/messages handler emits.
-- ════════════════════════════════════════════════════════════════════
create or replace function get_conversations(me uuid)
returns table (
  id           uuid,
  name         text,
  role         text,
  department   text,
  is_online    boolean,
  last_message text,
  last_at      timestamptz,
  unread       integer       -- cast from count() so PostgREST emits a JSON number, not a string
)
language sql stable as $$
  with threads as (
    select distinct on (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
      case when sender_id = me then receiver_id else sender_id end as other_id,
      text       as last_message,
      created_at as last_at
    from messages
    where sender_id = me or receiver_id = me
    order by least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at desc
  )
  select
    u.id, u.name, u.role, u.department, u.is_online,
    t.last_message, t.last_at,
    (select count(*) from messages m
       where m.sender_id = t.other_id and m.receiver_id = me and m.is_read = false)::int as unread
  from threads t
  join users u on u.id = t.other_id
  order by t.last_at desc;
$$;
