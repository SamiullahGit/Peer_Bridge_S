const router = require('express').Router();

const auth           = require('../middleware/auth');
const XpNotification = require('../models/XpNotification');

// GET /api/xp/pending
// Returns any unsent XP notifications for the current user and marks
// them as sent. Replaces the old /xp/stream SSE endpoint - long-lived
// SSE held an HTTP/1.1 connection slot and starved parallel fetches
// on pages like the home feed.
router.get('/pending', auth, async (req, res) => {
  try {
    const rows = await XpNotification.find({ user_id: req.user.id, is_sent: false })
      .sort({ created_at: 1 })
      .limit(20);

    if (rows.length) {
      const ids = rows.map(r => r._id);
      await XpNotification.updateMany({ _id: { $in: ids } }, { is_sent: true });
    }

    res.json(rows.map(r => ({
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
