const router = require('express').Router();

const auth          = require('../middleware/auth');
const { supabase }  = require('../config/supabase');
const xpManager     = require('../services/xpManager');
const { shapeMessage } = require('../data/shapers');

// ─────────────────────────────────────────────────────────────────────
// GET /api/messages    - inbox (most recent message per contact)
// The window-function logic lives in the get_conversations() SQL function
// (faithful port of the old Mongo aggregation pipeline).
// ─────────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_conversations', { me: req.user.id });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/messages/:userId   - full thread with one user
// ─────────────────────────────────────────────────────────────────────
router.get('/:userId', auth, async (req, res) => {
  try {
    const me    = req.user.id;
    const other = req.params.userId;

    const { data: msgs, error } = await supabase
      .from('messages')
      .select('*, sender:sender_id(name,role)')
      .or(`and(sender_id.eq.${me},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${me})`)
      .order('created_at', { ascending: true });
    if (error) throw error;

    // Mark received messages as read.
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', me).eq('sender_id', other).eq('is_read', false);

    res.json((msgs || []).map(shapeMessage));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/messages/:userId   { text }
// ─────────────────────────────────────────────────────────────────────
router.post('/:userId', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Message text is required' });

    const { data: msg, error } = await supabase
      .from('messages')
      .insert({ sender_id: req.user.id, receiver_id: req.params.userId, text })
      .select('*, sender:sender_id(name)')
      .single();
    if (error) throw error;

    // Chat reply XP, role-based:
    //   STUDENT: fast (<1h) = +5 XP, otherwise no XP
    //   MENTOR : fast (<1h) = +15 XP, otherwise +5 XP
    const { data: lastIncoming } = await supabase
      .from('messages')
      .select('created_at')
      .eq('sender_id', req.params.userId).eq('receiver_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const isFast = lastIncoming && (Date.now() - new Date(lastIncoming.created_at).getTime()) < 60 * 60 * 1000;
    let chatXP = 0, chatMsg = '';
    if (req.user.role === 'mentor') {
      chatXP  = isFast ? 15 : 5;
      chatMsg = isFast ? 'Fast chat reply!' : 'Chat reply sent';
    } else if (req.user.role === 'student' && isFast) {
      chatXP  = 5;
      chatMsg = 'Fast chat reply!';
    }

    let xp_earned = null;
    if (chatXP > 0) {
      const xp = await xpManager.awardXP(req.user.id, chatMsg, chatXP, 'message', msg.id);
      xp_earned = { points: chatXP, message: chatMsg, newTotal: xp.newTotal, newLevel: xp.newLevel, levelUp: xp.levelUp };
    }

    res.status(201).json({ ...shapeMessage(msg), ...(xp_earned ? { xp_earned } : {}) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
