-- ════════════════════════════════════════════════════════════════════
-- 0008_message_replies.sql — reply-to-message (threaded chat).
--
-- Paste into the Supabase SQL editor and run once. Idempotent.
-- A message (DM or group) can quote/reply to an earlier message in the
-- same thread. on delete set null so deleting the parent keeps the reply.
-- ════════════════════════════════════════════════════════════════════

alter table messages       add column if not exists reply_to uuid references messages(id)       on delete set null;
alter table group_messages add column if not exists reply_to uuid references group_messages(id) on delete set null;
