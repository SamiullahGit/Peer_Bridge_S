// ── Notification helper ─────────────────────────────────────────────────
// Fire-and-forget insert into the notifications table. Never throws into
// the caller — a failed notification must not fail the underlying action.
const { supabase } = require('../config/supabase');

async function notify({ userId, actorId = null, type, entityType = null, entityId = null, text }) {
  try {
    // Don't notify yourself about your own action.
    if (userId && actorId && userId === actorId) return;
    if (!userId || !text) return;
    await supabase.from('notifications').insert({
      user_id: userId, actor_id: actorId, type,
      entity_type: entityType, entity_id: entityId, text,
    });
  } catch (err) {
    console.error('notify failed:', err.message);
  }
}

module.exports = { notify };
