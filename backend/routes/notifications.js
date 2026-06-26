const router = require('express').Router();
const auth   = require('../middleware/auth');
const { supabase } = require('../config/supabase');

// ── GET /api/notifications  — recent notifications + unread count ───────
router.get('/', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(name,profile_image)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) throw error;

    const items = (data || []).map(n => ({
      id: n.id, type: n.type, text: n.text,
      entity_type: n.entity_type, entity_id: n.entity_id,
      is_read: n.is_read, created_at: n.created_at,
      actor_name: n.actor?.name || null,
      actor_image: n.actor?.profile_image || null,
    }));
    const unread = items.filter(n => !n.is_read).length;
    res.json({ items, unread });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ── GET /api/notifications/unread-count ────────────────────────────────
router.get('/unread-count', auth, async (req, res) => {
  try {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id).eq('is_read', false);
    res.json({ unread: count || 0 });
  } catch {
    res.json({ unread: 0 });
  }
});

// ── POST /api/notifications/read  — mark all read ──────────────────────
router.post('/read', auth, async (req, res) => {
  try {
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id).eq('is_read', false);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// ── POST /api/notifications/:id/read  — mark one read ──────────────────
router.post('/:id/read', auth, async (req, res) => {
  try {
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id).eq('user_id', req.user.id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

module.exports = router;
