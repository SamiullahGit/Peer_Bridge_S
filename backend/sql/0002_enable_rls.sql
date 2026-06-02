-- ════════════════════════════════════════════════════════════════════
-- 0002_enable_rls.sql  (OPTIONAL but recommended for a public deployment)
--
-- Enables Row Level Security on every Peer Bridge table and adds NO
-- policies. Effect:
--   * anon / authenticated keys (the "public" Data API roles) are denied
--     all access -> closes the gap the Security Advisor warns about.
--   * the backend is UNAFFECTED: it connects with the secret / service_role
--     key, which bypasses RLS entirely. The app keeps working identically.
--
-- Safe to run anytime after 0001_init.sql. Re-runnable.
-- ════════════════════════════════════════════════════════════════════

alter table users               enable row level security;
alter table posts               enable row level security;
alter table replies             enable row level security;
alter table post_likes          enable row level security;
alter table post_bookmarks      enable row level security;
alter table mentorship_requests enable row level security;
alter table messages            enable row level security;
alter table ratings             enable row level security;
alter table resources           enable row level security;
alter table events              enable row level security;
alter table reports             enable row level security;
alter table certificates        enable row level security;
alter table xp_transactions     enable row level security;
alter table xp_notifications    enable row level security;
