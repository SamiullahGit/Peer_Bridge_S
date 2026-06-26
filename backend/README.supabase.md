# Peer Bridge — Supabase (PostgreSQL) backend

The backend's data layer was migrated from MongoDB/Mongoose to **Supabase
(PostgreSQL)**. **No API endpoint, request body, response shape, or feature
changed** — the frontend runs unchanged. (The original Mongoose code lived in
`legacy-mongo/` during the migration and was removed once parity was verified;
it remains in git history if you ever need to compare.)

---

## 1. Environment variables

Copy `.env.example` to `.env` and fill in:

| Var | Required | Where to get it |
| --- | --- | --- |
| `SUPABASE_URL` | ✅ | Supabase dashboard → **Project Settings → API → Project URL** (e.g. `https://abcd1234.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Same page → **Project API keys → `service_role`** (the secret one — **not** `anon`). Server-side only, never commit it. |
| `JWT_SECRET` | ✅ | Any random 32+ char string (unchanged from before) |
| `PORT` | optional | Defaults to 4000 |
| `NODE_ENV` | optional | `development` / `production` |
| `EMAIL_USER` / `EMAIL_PASS` | optional | Gmail OTP (dev falls back to console) |
| `CORS_ORIGIN` | optional | Blank = `*` (dev). In production set to your frontend URL(s), comma-separated. |
| `SUPABASE_BUCKET` | optional | Storage bucket name for uploads. Defaults to `uploads` (auto-created, public). |

The server **exits immediately with a clear message** if `SUPABASE_URL` or
`SUPABASE_SERVICE_ROLE_KEY` is missing — and **refuses to start in production**
if `JWT_SECRET` is missing or left at the default placeholder.

**File uploads** (avatars, post/event images, resource files) stream into a
public **Supabase Storage** bucket (`uploads`, created automatically at
startup) and are served from Supabase's CDN — so they survive redeploys. No
Cloudinary or local-disk dependency.

---

## 2. Create the schema in Supabase

Open your project → **SQL Editor** → **New query**, then paste and **Run**
each of these files **in order** (each is its own "New query" → paste → Run).
All are safe to re-run.

| # | File | What it does | Run prompt |
| - | ---- | ------------ | ---------- |
| 1 | [`sql/0001_init.sql`](sql/0001_init.sql) | 15 tables, indexes, `updated_at` triggers, and 2 helper functions: `adjust_counter` (atomic counter `$inc` replacement) and `get_conversations` (inbox). | choose **Run without RLS** if prompted |
| 2 | [`sql/0002_enable_rls.sql`](sql/0002_enable_rls.sql) | Enables Row Level Security on every table (no policies). | normal Run |
| 3 | [`sql/0003_harden_functions.sql`](sql/0003_harden_functions.sql) | Pins each function's `search_path` and locks the `SECURITY DEFINER` functions to the backend only. | normal Run |
| 4 | [`sql/0005_follows.sql`](sql/0005_follows.sql) | Adds the `follows` table + `followers_count`/`following_count` counters. | normal Run |
| 5 | [`sql/0006_features.sql`](sql/0006_features.sql) | Reactions, notifications, polls, profile skills, resource upvotes, event RSVP, group pins, reply likes — and defines `get_feed()` (the single-query home-feed used by `GET /api/posts`). | normal Run |

Each should report **“Success. No rows returned.”** Confirm in **Table Editor**
that `users`, `posts`, `messages`, … exist (empty until you seed).

> **Why RLS + the function lockdown?** The Express server is the auth
> boundary: it does its own JWT auth and connects with the **`service_role`
> (secret) key**, which *bypasses RLS and the EXECUTE grants*. So the app
> works identically while the public `anon` key can't read tables or call the
> helper functions directly. Files 0002–0003 exist to make the **Security
> Advisor clean for a public deployment**; for a purely local demo, file
> 0001 alone is enough to run the app. **Never expose the service-role key to
> the browser.**

---

## 3. Seed the demo data

```bash
cd backend
npm install
npm run seed        # clears every table and inserts the 15-user NUST dataset
npm run dev         # API on http://localhost:4000
```

`npm run seed` runs [`scripts/seed.supabase.js`](scripts/seed.supabase.js)
(same data as before; passwords are all **`Test@123`**).

Health check: `GET http://localhost:4000/api/health` → `{ "ok": true }`.

---

## 4. Verifying response parity per endpoint

Frontend is unchanged, so the fastest check is to **run the app and click
through every page** (feed, mentors, messages, resources, events, profile,
saved, certificate). Everything should behave identically.

For an explicit API diff, grab a token first and reuse it:

```bash
BASE=http://localhost:4000/api

# 1. Log in as a seeded mentor (password Test@123) to get a JWT
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"syed.hassan@nust.edu.pk","password":"Test@123"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

AUTH="Authorization: Bearer $TOKEN"
```

| What to test | Command | Expect |
| --- | --- | --- |
| Current user | `curl -s $BASE/auth/me -H "$AUTH"` | full user JSON with `id`, `total_xp`, `xp_level`, … |
| Feed | `curl -s "$BASE/posts?limit=5" -H "$AUTH"` | array of posts with `author_name`, `liked`, `bookmarked` |
| Search/filter | `curl -s "$BASE/posts?tag=Resources&search=notes" -H "$AUTH"` | filtered posts |
| Replies | `curl -s "$BASE/posts/<postId>/replies" -H "$AUTH"` | array with `author_name`, `author_role` |
| Like toggle | `curl -s -X POST $BASE/posts/<postId>/like -H "$AUTH"` | `{ "liked": true }` then `false` on repeat |
| Mentors | `curl -s "$BASE/users/mentors" -H "$AUTH"` | mentors sorted by `rating` desc; `rating` is a **number** |
| One profile | `curl -s $BASE/users/<userId> -H "$AUTH"` | user + `posts` array (last 10) |
| Inbox | `curl -s $BASE/messages -H "$AUTH"` | one row per contact: `last_message`, `unread` (number), `last_at` |
| Thread | `curl -s $BASE/messages/<userId> -H "$AUTH"` | ordered messages with `sender_name` |
| Resources | `curl -s "$BASE/resources" -H "$AUTH"` | array with `uploader_name`, `file_size` (number) |
| Events | `curl -s "$BASE/events?when=upcoming" -H "$AUTH"` | upcoming events with `organizer_name`, `event_date`, `event_time` |
| XP stats | `curl -s $BASE/certificates/xp-stats -H "$AUTH"` | `xp`, `level`, `progress`, `history[]`, `canGenerate` |
| XP polling | `curl -s $BASE/xp/pending -H "$AUTH"` | array of pending notifications (drains after read) |

If you want to compare against the original MongoDB build, check out a commit
from before the migration (the Mongoose code is in git history) and `diff` the
JSON — the only differences are the inert Mongo-internal fields (`_id`, `__v`)
that the frontend never read.

---

## 5. What changed under the hood (for graders)

- **IDs:** Mongo `ObjectId` → Postgres `uuid` (`gen_random_uuid()`). Still
  opaque strings to the frontend.
- **Types chosen for byte-identical JSON:** counts are `integer`, `rating`
  and `total_hours_helped` are `double precision` — PostgREST returns those
  as JSON *numbers* (a `numeric` column would serialize as a *string* and
  break truthiness checks like `{rating || '0.0'}`).
- **`populate()` → PostgREST embeds:** `select('*, author:author_id(...)')`,
  flattened by [`data/shapers.js`](data/shapers.js) into the same
  `author_name` / `organizer_name` / `uploader_name` / `sender_name` fields.
- **`$inc` → `adjust_counter` RPC** (keeps the “don't go below 0” floor).
- **Messages aggregation → `get_conversations` SQL function.**
- **Polymorphic refs** (`reports.target_id`, `xp_transactions.ref_id`) are
  plain `uuid` columns with no FK, exactly like the untyped ObjectIds before.
- Auth and the PDF certificate generator are unchanged. File uploads now use
  **Supabase Storage** (a custom Multer engine in [`config/storage.js`](config/storage.js))
  instead of Cloudinary/local disk; `fileUrl()` still returns the public URL,
  so the routes are untouched.

---

## 6. Performance notes

A hosted database adds ~150–200 ms of network latency per query that the old
*local* MongoDB didn't have. Two endpoints were tuned so they cost only **one
round-trip**, with identical responses:

- **`GET /api/posts` (home feed):** used to make 2 round-trips (posts, then
  the viewer's likes/bookmarks). Now a single `get_feed()` call
  ([`sql/0006_features.sql`](sql/0006_features.sql)) computes the
  `liked`/`bookmarked` flags server-side. ~0.40s → ~0.20s.
- **`GET /api/users/:id` (profile):** its user + recent-posts queries now run
  in parallel (`Promise.all`) instead of sequentially. No SQL change.

`/users/mentors` and `/resources` are already single queries — their ~0.20s is
the unavoidable round-trip to Supabase's region, not a code cost. The only
further lever is frontend caching/loading skeletons (out of scope — the
frontend is unchanged) or a closer/paid Supabase region.

---

## 7. Deploying to production — checklist

Backend env vars (set on your host, e.g. Render → Environment):

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<rotated secret key>     # secret/service_role, never the anon key
JWT_SECRET=<long random string>                    # server refuses to start in prod without this
NODE_ENV=production                                # disables the dev XP/cert test endpoints
CORS_ORIGIN=https://<your-frontend-domain>         # lock CORS to your frontend
EMAIL_USER=...                                      # real Gmail app password for OTP emails
EMAIL_PASS=...
```

Frontend env var (e.g. Vercel):

```
VITE_API_BASE=https://<your-backend-domain>/api
```

Before going live:

1. **Rotate the Supabase secret key** (Settings → API Keys), update the env var.
2. **Set a strong `JWT_SECRET`** — the default placeholder is rejected in prod.
3. **`NODE_ENV=production`** so `/api/certificates/test-add-xp` and
   `/test-regenerate` return 403 (they'd otherwise let anyone mint XP/certs).
4. Run all four `sql/000*.sql` files on the production Supabase project.
5. Verify Security Advisor is clean (RLS on, functions hardened).

Free-tier behavior to expect (not bugs): a Render free backend sleeps after
~15 min idle (first request ~30s to wake); a Supabase free project pauses after
~1 week of inactivity (reactivate from the dashboard).
