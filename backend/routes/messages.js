const router   = require('express').Router();
const mongoose = require('mongoose');

const auth      = require('../middleware/auth');
const Message   = require('../models/Message');
const User      = require('../models/User');
const xpManager = require('../services/xpManager');

const { ObjectId } = mongoose.Types;

// ─────────────────────────────────────────────────────────────────────
// GET /api/messages    - inbox (most recent message per contact)
// Aggregation pipeline replaces the SQL ROW_NUMBER() OVER PARTITION BY
// LEAST/GREATEST trick. We pair each message with a deterministic
// "thread key" (smaller_id, larger_id), keep only the newest per thread,
// then join the other-party user.
// ─────────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const me  = new ObjectId(req.user.id);
    const rows = await Message.aggregate([
      { $match: { $or: [{ sender_id: me }, { receiver_id: me }] } },
      { $sort: { created_at: -1 } },
      { $addFields: {
          other_id: { $cond: [{ $eq: ['$sender_id', me] }, '$receiver_id', '$sender_id'] },
      }},
      { $group: {
          _id            : '$other_id',
          last_message   : { $first: '$text' },
          last_at        : { $first: '$created_at' },
          last_sender_id : { $first: '$sender_id' },
      }},
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      // Count unread messages from this contact to the current user.
      { $lookup: {
          from: 'messages',
          let : { otherId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$sender_id',   '$$otherId'] },
              { $eq: ['$receiver_id', me] },
              { $eq: ['$is_read',     false] },
            ] } } },
            { $count: 'cnt' },
          ],
          as: 'unread_arr',
      }},
      { $project: {
          _id          : 0,
          id           : '$_id',
          name         : '$user.name',
          role         : '$user.role',
          department   : '$user.department',
          is_online    : '$user.is_online',
          last_message : 1,
          last_at      : 1,
          unread       : { $ifNull: [{ $arrayElemAt: ['$unread_arr.cnt', 0] }, 0] },
      }},
      { $sort: { last_at: -1 } },
    ]);

    res.json(rows.map(r => ({ ...r, id: r.id.toString() })));
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

    const msgs = await Message.find({
      $or: [
        { sender_id: me,    receiver_id: other },
        { sender_id: other, receiver_id: me    },
      ],
    }).sort({ created_at: 1 }).populate('sender_id', 'name role');

    // Mark received messages as read.
    await Message.updateMany(
      { receiver_id: me, sender_id: other, is_read: false },
      { is_read: true },
    );

    res.json(msgs.map(m => {
      const obj = m.toObject();
      const s   = obj.sender_id || {};
      return {
        ...obj,
        id           : obj._id.toString(),
        sender_id    : s._id ? s._id.toString() : obj.sender_id,
        receiver_id  : obj.receiver_id.toString(),
        sender_name  : s.name,
        sender_role  : s.role,
      };
    }));
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

    const created = await Message.create({
      sender_id  : req.user.id,
      receiver_id: req.params.userId,
      text,
    });
    const msg    = await Message.findById(created._id).populate('sender_id', 'name');
    const sender = msg.sender_id || {};

    // Chat reply XP, role-based:
    //   STUDENT: fast (<1h) = +5 XP, otherwise no XP
    //   MENTOR : fast (<1h) = +15 XP, otherwise +5 XP
    const lastIncoming = await Message.findOne({
      sender_id: req.params.userId, receiver_id: req.user.id,
    }).sort({ created_at: -1 }).select('created_at');

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
      const xp = await xpManager.awardXP(req.user.id, chatMsg, chatXP, 'message', msg._id);
      xp_earned = { points: chatXP, message: chatMsg, newTotal: xp.newTotal, newLevel: xp.newLevel, levelUp: xp.levelUp };
    }

    res.status(201).json({
      ...msg.toObject(),
      id           : msg._id.toString(),
      sender_id    : sender._id ? sender._id.toString() : msg.sender_id,
      receiver_id  : msg.receiver_id.toString(),
      sender_name  : sender.name,
      ...(xp_earned ? { xp_earned } : {}),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
