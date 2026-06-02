-- ════════════════════════════════════════════════════════════════════
-- 0003_harden_functions.sql  (recommended before a PUBLIC deployment)
--
-- Clears the Security Advisor warnings about the helper functions:
--   1. "Function Search Path Mutable"  -> pin each function's search_path.
--   2. "Public/Signed-In Users Can Execute SECURITY DEFINER Function"
--      -> adjust_counter runs with owner rights; revoke it from the public
--         Data API roles so ONLY the backend (service_role / secret key)
--         can call it. Otherwise anyone with the anon key could bump any
--         counter (e.g. inflate their own XP).
--
-- The app is UNAFFECTED: the backend connects as service_role, which keeps
-- EXECUTE on both functions. Safe to run after 0001/0002. Re-runnable.
-- ════════════════════════════════════════════════════════════════════

-- 1. Pin search_path on all three functions ───────────────────────────
-- Trigger fn: now() lives in pg_catalog (always in path), so '' is safe.
alter function public.touch_updated_at() set search_path = '';
-- These two reference tables by unqualified name, so they need `public`.
alter function public.adjust_counter(text, uuid, text, int) set search_path = public, pg_temp;
alter function public.get_conversations(uuid)                set search_path = public, pg_temp;

-- 2. Lock the SECURITY DEFINER function to the backend only ────────────
revoke execute on function public.adjust_counter(text, uuid, text, int) from public, anon, authenticated;
grant  execute on function public.adjust_counter(text, uuid, text, int) to service_role;

-- 3. get_conversations is backend-only too; lock it down for consistency.
revoke execute on function public.get_conversations(uuid) from public, anon, authenticated;
grant  execute on function public.get_conversations(uuid) to service_role;
