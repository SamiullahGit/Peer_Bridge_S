const router = require('express').Router();

const auth   = require('../middleware/auth');
const Report = require('../models/Report');
const Post   = require('../models/Post');
const User   = require('../models/User');

const VALID_TYPES   = Report.REPORT_TYPES;
const VALID_REASONS = Report.REPORT_REASONS;

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
// POST /api/reports   { target_type, target_id, reason }
// Auto-actions: post hidden after 5 reports, user locked after 10.
// ─────────────────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { target_type, target_id, reason } = req.body;

    if (!VALID_TYPES.includes(target_type)) return res.status(400).json({ error: 'Invalid target type' });
    if (!VALID_REASONS.includes(reason))    return res.status(400).json({ error: 'Invalid reason' });
    if (!target_id)                         return res.status(400).json({ error: 'target_id is required' });

    const existing = await Report.findOne({ reporter_id: req.user.id, target_type, target_id });
    if (existing) return res.status(409).json({ error: 'You have already reported this' });

    await Report.create({ reporter_id: req.user.id, target_type, target_id, reason });

    // Auto-hide post after 5 unique reports.
    if (target_type === 'post') {
      const cnt = await Report.countDocuments({ target_type: 'post', target_id });
      if (cnt >= 5) await Post.findByIdAndUpdate(target_id, { is_hidden: true });
    }

    // Auto-lock user after 10 unique reports.
    if (target_type === 'user') {
      const cnt = await Report.countDocuments({ target_type: 'user', target_id });
      if (cnt >= 10) {
        const reported = await User.findById(target_id).select('email is_locked');
        if (reported && !reported.is_locked) {
          reported.is_locked = true;
          await reported.save();
          await sendEmail(
            reported.email,
            'Your Peer Bridge account has been temporarily locked',
            'Your account has been temporarily locked due to multiple community reports.\n\nIf you believe this is a mistake, please contact support.',
          );
        }
      }
    }

    res.status(201).json({ message: 'Report submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

module.exports = router;
