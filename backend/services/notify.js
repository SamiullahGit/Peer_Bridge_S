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

// Parse @mentions from text and notify matched users. Best-effort, never
// throws. Matches users whose name starts with the @token (case-insensitive).
async function notifyMentions(text, { actorId, type = 'mention', entityType, entityId }) {
  try {
    if (!text) return;
    const tokens = [...new Set((text.match(/(?:^|\s)@([A-Za-z][A-Za-z0-9_]{1,29})/g) || [])
      .map(s => s.trim().replace(/^@/, '')))];
    if (!tokens.length) return;

    const notified = new Set([actorId]);
    for (const token of tokens.slice(0, 5)) {
      const { data: users } = await supabase
        .from('users').select('id').ilike('name', `${token}%`).limit(2);
      for (const u of (users || [])) {
        if (notified.has(u.id)) continue;
        notified.add(u.id);
        await notify({
          userId: u.id, actorId, type,
          entityType, entityId, text: 'mentioned you',
        });
      }
    }
  } catch (err) {
    console.error('notifyMentions failed:', err.message);
  }
}

module.exports = { notify, notifyMentions };
