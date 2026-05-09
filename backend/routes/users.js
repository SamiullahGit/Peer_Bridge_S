const router   = require('express').Router();
const mongoose = require('mongoose');

const auth               = require('../middleware/auth');
const User               = require('../models/User');
const Post               = require('../models/Post');
const Rating             = require('../models/Rating');
const MentorshipRequest  = require('../models/MentorshipRequest');
const xpManager          = require('../services/xpManager');

const { ObjectId } = mongoose.Types;

// Lightweight projection for any "list users" response.
const PUBLIC_FIELDS = '_id name role department graduation_year bio profile_image rating rating_count sessions_count is_online is_locked is_under_review created_at total_xp xp_level email';

function shapeUser(u) {
  if (!u) return u;
  const obj = u.toObject ? u.toObject() : u;
  obj.id    = obj._id.toString();
  return obj;
}

async function sendEmail(to, subject, text) {
  console.log(`\n[DEV] Email to ${to}: ${subject}\n`);
  if (process.env.NODE_ENV !== 'production') return;
  const nodemailer  = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  await transporter.sendMail({ from: `"Peer Bridge" <${process.env.EMAIL_USER}>`, to, subject, text });
}

// ─────────────────────────────────────────────────────────────────────
// GET /api/users/mentors?search=&dept=
// ─────────────────────────────────────────────────────────────────────
router.get('/mentors', auth, async (req, res) => {
  try {
    const { search, dept } = req.query;
    const filter = { role: 'mentor', is_under_review: false };

    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ name: re }, { department: re }, { bio: re }];
    }
    if (dept) filter.department = dept;

    const mentors = await User.find(filter).select(PUBLIC_FIELDS).sort({ rating: -1 });
    res.json(mentors.map(shapeUser));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch mentors' });
  }
});

// IDs of mentors the current user has already requested.
router.get('/my-requests', auth, async (req, res) => {
  try {
    const rows = await MentorshipRequest.find({ requester_id: req.user.id }).select('mentor_id');
    res.json(rows.map(r => r.mentor_id.toString()));
  } catch {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Pending requests for the logged-in mentor.
router.get('/incoming-requests', auth, async (req, res) => {
  try {
    const rows = await MentorshipRequest.find({ mentor_id: req.user.id, status: 'pending' })
      .sort({ created_at: -1 })
      .populate('requester_id', 'name department role profile_image');

    res.json(rows.map(r => ({
      id            : r._id.toString(),
      message       : r.message,
      status        : r.status,
      created_at    : r.created_at,
      requester_id  : r.requester_id?._id?.toString(),
      requester_name: r.requester_id?.name,
      department    : r.requester_id?.department,
      role          : r.requester_id?.role,
      profile_image : r.requester_id?.profile_image,
    })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch incoming requests' });
  }
});

// Accept or decline a request.
router.patch('/mentorship-requests/:id', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status))
      return res.status(400).json({ error: 'Status must be accepted or declined' });

    const reqDoc = await MentorshipRequest.findOneAndUpdate(
      { _id: req.params.id, mentor_id: req.user.id },
      { status },
      { new: true },
    );
    if (!reqDoc) return res.status(404).json({ error: 'Request not found' });

    if (status === 'accepted') {
      const xp = await xpManager.awardXP(req.user.id, 'Accepted a mentorship request', 30, 'mentorship', reqDoc._id);
      User.findByIdAndUpdate(req.user.id, { $inc: { total_students_helped: 1 } }).catch(() => {});
      return res.json({
        message  : `Request ${status}`,
        xp_earned: { points: 30, message: 'Mentorship goal completed!', newTotal: xp.newTotal, newLevel: xp.newLevel, levelUp: xp.levelUp },
      });
    }
    res.json({ message: `Request ${status}` });
  } catch {
    res.status(500).json({ error: 'Failed to update request' });
  }
});

// Current user (basic fields only - /api/auth/me returns the full doc).
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select(PUBLIC_FIELDS);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(shapeUser(user));
});

// Update current user's profile.
router.put('/me', auth, async (req, res) => {
  try {
    const { name, department, graduation_year, bio, role } = req.body;
    const update = {};
    if (name             !== undefined) update.name             = name;
    if (department       !== undefined) update.department       = department;
    if (graduation_year  !== undefined) update.graduation_year  = graduation_year || null;
    if (bio              !== undefined) update.bio              = bio;
    if (role && ['student', 'mentor'].includes(role)) update.role = role;

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select(PUBLIC_FIELDS);
    res.json(shapeUser(user));
  } catch {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.delete('/me', auth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    res.json({ message: 'Account deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/users/:id    user + their last 10 posts
// ─────────────────────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(PUBLIC_FIELDS);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const posts = await Post.find({ author_id: req.params.id })
      .sort({ created_at: -1 })
      .limit(10)
      .select('_id tag title body likes_count comments_count bookmarks_count is_hidden created_at');

    res.json({
      ...shapeUser(user),
      posts: posts.map(p => ({ ...p.toObject(), id: p._id.toString() })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/users/:id/rate    { score, comment? }
// ─────────────────────────────────────────────────────────────────────
router.post('/:id/rate', auth, async (req, res) => {
  try {
    const { score, comment } = req.body;
    if (!score || score < 1 || score > 5) return res.status(400).json({ error: 'Score must be 1-5' });
    if (req.params.id === req.user.id)    return res.status(400).json({ error: 'Cannot rate yourself' });

    await Rating.findOneAndUpdate(
      { rater_id: req.user.id, mentor_id: req.params.id },
      { score, comment: comment || null },
      { upsert: true, setDefaultsOnInsert: true, new: true },
    );

    // Recalculate average rating.
    const stats = await Rating.aggregate([
      { $match: { mentor_id: new ObjectId(req.params.id) } },
      { $group: { _id: null, avg: { $avg: '$score' }, cnt: { $sum: 1 } } },
    ]);
    const avg = stats[0]?.avg || 0;
    const cnt = stats[0]?.cnt || 0;

    await User.findByIdAndUpdate(req.params.id, { rating: avg, rating_count: cnt });

    // Auto under-review: rating < 2.0 AND >= 5 reviews -> flag; improves -> unflag.
    if (avg < 2.0 && cnt >= 5) {
      const mentor = await User.findById(req.params.id).select('email is_under_review');
      if (mentor && !mentor.is_under_review) {
        mentor.is_under_review = true;
        await mentor.save();
        await sendEmail(
          mentor.email,
          'Your Peer Bridge mentor profile is under review',
          'Your mentor profile is under review due to low ratings. It will be restored once your rating improves.',
        );
      }
    } else if (avg >= 2.0) {
      await User.findByIdAndUpdate(req.params.id, { is_under_review: false });
    }

    // Passive XP for the mentor being rated - delivered via /xp/pending poll.
    const xpForRating = score >= 5 ? 25 : score >= 4 ? 10 : score >= 3 ? 5 : 0;
    const starEmoji   = score >= 5 ? ' 5-star' : score >= 4 ? ' 4-star' : '';
    if (xpForRating > 0) {
      xpManager.awardXP(req.params.id, `${score}-star rating received${starEmoji}`, xpForRating, 'rating', req.user.id, true).catch(() => {});
    }

    // Active +5 XP for the rater (students only).
    let xp_earned = null;
    if (req.user.role === 'student') {
      const xp = await xpManager.awardXP(req.user.id, 'Rated a mentor', 5, 'rating', req.params.id);
      xp_earned = { points: 5, message: 'Thanks for rating a mentor', newTotal: xp.newTotal, newLevel: xp.newLevel, levelUp: xp.levelUp };
    }
    res.json({ message: 'Rating saved', rating: avg.toFixed(2), ...(xp_earned ? { xp_earned } : {}) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/users/promote-to-mentor
// Student with >= 300 XP can flip role -> mentor (XP carries over).
// ─────────────────────────────────────────────────────────────────────
router.post('/promote-to-mentor', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user)                       return res.status(404).json({ error: 'User not found' });
    if (user.role === 'mentor')      return res.status(400).json({ error: 'You are already a mentor.' });
    if (user.role !== 'student')     return res.status(403).json({ error: 'Only student accounts can be promoted to mentor.' });
    if ((user.total_xp || 0) < 300)  return res.status(403).json({ error: 'You need at least 300 XP (Silver level) before becoming a mentor.' });

    user.role = 'mentor';
    await user.save();

    res.json({ message: 'Welcome to the mentor community!', user: user.toSafeJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to promote to mentor' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/users/:id/request-mentorship   { message? }
// ─────────────────────────────────────────────────────────────────────
router.post('/:id/request-mentorship', auth, async (req, res) => {
  try {
    await MentorshipRequest.create({
      requester_id: req.user.id,
      mentor_id   : req.params.id,
      message     : req.body.message || null,
    });
    res.json({ message: 'Request sent' });
  } catch {
    res.status(500).json({ error: 'Failed to send request' });
  }
});

module.exports = router;
