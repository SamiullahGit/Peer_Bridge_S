const router = require('express').Router();

const auth          = require('../middleware/auth');
const { supabase }  = require('../config/supabase');
const { REPORT_TYPES, REPORT_REASONS } = require('../data/constants');

const VALID_TYPES   = REPORT_TYPES;
const VALID_REASONS = REPORT_REASONS;

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

// Count reports for a given target.
async function countReports(target_type, target_id) {
  const { count } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('target_type', target_type)
    .eq('target_id', target_id);
  return count || 0;
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

    const { data: existing } = await supabase
      .from('reports').select('id')
      .eq('reporter_id', req.user.id).eq('target_type', target_type).eq('target_id', target_id)
      .maybeSingle();
    if (existing) return res.status(409).json({ error: 'You have already reported this' });

    await supabase.from('reports').insert({ reporter_id: req.user.id, target_type, target_id, reason });

    // Auto-hide post after 5 unique reports.
    if (target_type === 'post') {
      const cnt = await countReports('post', target_id);
      if (cnt >= 5) await supabase.from('posts').update({ is_hidden: true }).eq('id', target_id);
    }

    // Auto-lock user after 10 unique reports.
    if (target_type === 'user') {
      const cnt = await countReports('user', target_id);
      if (cnt >= 10) {
        const { data: reported } = await supabase
          .from('users').select('email, is_locked').eq('id', target_id).maybeSingle();
        if (reported && !reported.is_locked) {
          await supabase.from('users').update({ is_locked: true }).eq('id', target_id);
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
