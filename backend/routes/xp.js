const router = require('express').Router();

const auth         = require('../middleware/auth');
const { supabase } = require('../config/supabase');

// GET /api/xp/pending
// Returns any unsent XP notifications for the current user and marks
// them as sent. Replaces the old /xp/stream SSE endpoint - long-lived
// SSE held an HTTP/1.1 connection slot and starved parallel fetches
// on pages like the home feed.
router.get('/pending', auth, async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('xp_notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('is_sent', false)
      .order('created_at', { ascending: true })
      .limit(20);
    if (error) throw error;

    if (rows && rows.length) {
      const ids = rows.map(r => r.id);
      await supabase.from('xp_notifications').update({ is_sent: true }).in('id', ids);
    }

    res.json((rows || []).map(r => ({
      points   : r.points,
      message  : r.message,
      isLevelUp: !!r.is_level_up,
      newLevel : r.new_level,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch XP notifications' });
  }
});

module.exports = router;
