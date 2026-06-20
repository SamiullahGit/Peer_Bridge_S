const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');

const { supabase }        = require('../config/supabase');
const { NUST_DOMAINS }    = require('../data/constants');
const { toSafeUser }      = require('../data/shapers');
const authMw              = require('../middleware/auth');
const { awardDailyLogin } = require('../services/xpManager');
const { sendMail }        = require('../services/mailer');
const { makeStorage, fileUrl } = require('../config/storage');

// ── Avatar upload (during profile setup) ───────────────────────────
const avatarUpload = multer({
  storage: makeStorage('avatars', 'avatar'),
  limits : { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// ── Helpers ────────────────────────────────────────────────────────
function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, otp) {
  const sent = await sendMail({
    to     : email,
    subject: 'Your Peer Bridge verification code',
    text   : `Your 6-digit code is: ${otp}\nExpires in 10 minutes.`,
    html   : `<p>Your Peer Bridge verification code is:</p><h2>${otp}</h2><p>Expires in 10 minutes.</p>`,
  });

  if (!sent) {
    console.log(`\n[DEV] OTP for ${email}: ${otp}\n`);
    console.warn('[auth] Email not sent (no provider configured or send failed) — OTP delivered to console only.');
  }
}


router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const clean  = email.trim().toLowerCase();
    const domain = clean.split('@')[1];

    if (!domain || !NUST_DOMAINS.includes(domain)) {
      return res.status(400).json({
        error: 'Only NUST institutional email addresses are allowed (@nust.edu.pk, @seecs.edu.pk, @nbs.nust.edu.pk, etc.).',
      });
    }

    const otp     = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();   // 10 min

    // Upsert by email, but preserve the existing name on returning users
    // (parity with Mongo's $set + $setOnInsert).
    const { data: existing } = await supabase
      .from('users').select('id').eq('email', clean).maybeSingle();

    if (existing) {
      await supabase.from('users')
        .update({ otp_code: otp, otp_expires: expires })
        .eq('id', existing.id);
    } else {
      const nameFromEmail = clean
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      await supabase.from('users').insert({
        name: nameFromEmail, email: clean, is_verified: false,
        otp_code: otp, otp_expires: expires,
      });
    }

    await sendOTPEmail(clean, otp);

    res.json({ message: 'OTP sent to your NUST email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp   { email, otp }
// New users (no department yet) get a temporary token but is_verified
// stays false; profile setup flips it to true. Returning users are
// fully verified and logged in.
// ─────────────────────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const clean = email.trim().toLowerCase();
    const { data: user } = await supabase
      .from('users').select('*').eq('email', clean).maybeSingle();
    if (!user)                                           return res.status(400).json({ error: 'User not found' });
    if (user.otp_code !== otp)                           return res.status(400).json({ error: 'Invalid OTP' });
    if (!user.otp_expires || new Date() > new Date(user.otp_expires)) return res.status(400).json({ error: 'OTP expired' });

    const isNew = !user.department;

    const update = { otp_code: null, otp_expires: null };
    if (user.department && !user.is_verified) update.is_verified = true;

    const { data: updated } = await supabase
      .from('users').update(update).eq('id', user.id).select('*').maybeSingle();

    res.json({ token: makeToken(updated), user: toSafeUser(updated), is_new_user: isNew });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/auth/setup-profile   (multipart/form-data)
// New-user-only endpoint that finalises the account and flips
// is_verified to true.
// ─────────────────────────────────────────────────────────────────────
router.post('/setup-profile', authMw, avatarUpload.single('profile_image'), async (req, res) => {
  try {
    const { name, department, graduation_year, role, bio, password } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const safeRole = ['student', 'mentor'].includes(role) ? role : 'student';

    const { data: user } = await supabase
      .from('users').select('id').eq('id', req.user.id).maybeSingle();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const gradYear = parseInt(graduation_year, 10);
    const update = {
      name,
      department      : department || null,
      graduation_year : Number.isNaN(gradYear) ? null : gradYear,
      role            : safeRole,
      bio             : bio || null,
      is_verified     : true,
    };
    if (password) update.password_hash = await bcrypt.hash(password, 10);
    if (req.file) update.profile_image = fileUrl(req.file);

    const { data: updated } = await supabase
      .from('users').update(update).eq('id', req.user.id).select('*').maybeSingle();

    res.json({ token: makeToken(updated), user: toSafeUser(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Profile setup failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/auth/login   { email, password }
// ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data: user } = await supabase
      .from('users').select('*').eq('email', email.trim().toLowerCase()).maybeSingle();
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_verified)            return res.status(401).json({ error: 'Account not verified' });
    if (user.is_locked)               return res.status(403).json({ error: 'Your account has been suspended due to community reports.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: makeToken(user), user: toSafeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/auth/me   - current user + opportunistic daily-login XP
// ─────────────────────────────────────────────────────────────────────
router.get('/me', authMw, async (req, res) => {
  const { data: user } = await supabase
    .from('users').select('*').eq('id', req.user.id).maybeSingle();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const xp_earned = await awardDailyLogin(req.user.id);
  const payload   = toSafeUser(user);
  if (xp_earned) payload.xp_earned = xp_earned;
  res.json(payload);
});

module.exports = router;
