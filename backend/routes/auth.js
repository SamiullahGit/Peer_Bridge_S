const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');

const User                = require('../models/User');
const authMw              = require('../middleware/auth');
const { awardDailyLogin } = require('../services/xpManager');
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
    { id: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, otp) {
  console.log(`\n[DEV] OTP for ${email}: ${otp}\n`);
  if (process.env.NODE_ENV !== 'production') return;

  const nodemailer  = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  await transporter.sendMail({
    from   : `"Peer Bridge" <${process.env.EMAIL_USER}>`,
    to     : email,
    subject: 'Your Peer Bridge verification code',
    text   : `Your 6-digit code is: ${otp}\nExpires in 10 minutes.`,
    html   : `<p>Your Peer Bridge verification code is:</p><h2>${otp}</h2><p>Expires in 10 minutes.</p>`,
  });
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/auth/send-otp   { email }
// Creates a stub user (or refreshes the OTP for an existing one) and
// emails a 6-digit code. In dev the OTP is also returned in the JSON
// response and printed to the server console for easy testing.
// ─────────────────────────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const clean  = email.trim().toLowerCase();
    const domain = clean.split('@')[1];

    if (!domain || !User.NUST_DOMAINS.includes(domain)) {
      return res.status(400).json({
        error: 'Only NUST institutional email addresses are allowed (@nust.edu.pk, @seecs.edu.pk, @nbs.nust.edu.pk, etc.).',
      });
    }

    const otp     = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000);   // 10 min

    let user = await User.findOne({ email: clean });
    if (user) {
      user.otp_code    = otp;
      user.otp_expires = expires;
      await user.save();
    } else {
      // Pre-fill the name from the local-part of the email so the row
      // satisfies the required-name validation. Real name is set during
      // profile setup.
      const nameFromEmail = clean
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      user = await User.create({
        name       : nameFromEmail,
        email      : clean,
        otp_code   : otp,
        otp_expires: expires,
        is_verified: false,
      });
    }

    await sendOTPEmail(clean, otp);

    const resp = { message: 'OTP sent to your NUST email' };
    if (process.env.NODE_ENV !== 'production') resp.dev_otp = otp;
    res.json(resp);
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
    const user  = await User.findOne({ email: clean });
    if (!user)                                           return res.status(400).json({ error: 'User not found' });
    if (user.otp_code !== otp)                           return res.status(400).json({ error: 'Invalid OTP' });
    if (!user.otp_expires || new Date() > user.otp_expires) return res.status(400).json({ error: 'OTP expired' });

    const isNew = !user.department;

    user.otp_code    = null;
    user.otp_expires = null;
    if (!isNew) user.is_verified = true;
    await user.save();

    res.json({ token: makeToken(user), user: user.toSafeJSON(), is_new_user: isNew });
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

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.name             = name;
    user.department       = department || null;
    user.graduation_year  = graduation_year || null;
    user.role             = safeRole;
    user.bio              = bio || null;
    user.is_verified      = true;
    if (password)        user.password_hash  = await bcrypt.hash(password, 10);
    if (req.file)        user.profile_image  = fileUrl(req.file);
    await user.save();

    res.json({ token: makeToken(user), user: user.toSafeJSON() });
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

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_verified)            return res.status(401).json({ error: 'Account not verified' });
    if (user.is_locked)               return res.status(403).json({ error: 'Your account has been suspended due to community reports.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: makeToken(user), user: user.toSafeJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/auth/me   - current user + opportunistic daily-login XP
// ─────────────────────────────────────────────────────────────────────
router.get('/me', authMw, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const xp_earned = await awardDailyLogin(req.user.id);
  const payload   = user.toSafeJSON();
  if (xp_earned) payload.xp_earned = xp_earned;
  res.json(payload);
});

module.exports = router;
