const router = require('express').Router();
const fs     = require('fs');
const path   = require('path');

const auth          = require('../middleware/auth');
const User          = require('../models/User');
const Resource      = require('../models/Resource');
const Certificate   = require('../models/Certificate');
const XpTransaction = require('../models/XpTransaction');

const { generateCertPDF, cleanupOldCertificates, CERT_DIR } = require('../services/certificateGenerator');
const { getLevel, LEVELS, awardXP }                          = require('../services/xpManager');

// ─────────────────────────────────────────────────────────────────────
// GET /api/certificates/xp-stats   - profile dashboard data
// ─────────────────────────────────────────────────────────────────────
router.get('/xp-stats', auth, async (req, res) => {
  try {
    const uid  = req.user.id;
    const user = await User.findById(uid).select('role total_xp xp_level total_students_helped total_hours_helped rating department');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [resourcesCount, history, lastCert] = await Promise.all([
      Resource.countDocuments({ uploader_id: uid }),
      XpTransaction.find({ user_id: uid }).sort({ created_at: -1 }).limit(20).select('points reason ref_type created_at'),
      Certificate.findOne({ user_id: uid }).sort({ created_at: -1 }).select('created_at'),
    ]);

    const xp       = user.total_xp || 0;
    const level    = user.xp_level || getLevel(xp);
    const levelIdx = LEVELS.findIndex(l => l.name === level);
    const nextLvl  = LEVELS[levelIdx + 1] || null;
    const prevMin  = LEVELS[levelIdx]?.min || 0;
    const nextMin  = nextLvl?.min || prevMin;
    const progress = nextLvl
      ? Math.min(Math.round(((xp - prevMin) / (nextMin - prevMin)) * 100), 100)
      : 100;

    let cooldownEnd = null;
    if (lastCert) {
      const diff = Date.now() - new Date(lastCert.created_at).getTime();
      if (diff < 24 * 60 * 60 * 1000) {
        cooldownEnd = new Date(new Date(lastCert.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
      }
    }

    const isMentor = user.role === 'mentor';
    res.json({
      xp,
      level,
      progress,
      role                 : user.role,
      isMentor,
      nextLevel            : nextLvl?.name || null,
      nextLevelMin         : nextMin,
      currentLevelMin      : prevMin,
      total_students_helped: user.total_students_helped || 0,
      total_hours_helped   : user.total_hours_helped    || 0,
      resources_count      : resourcesCount,
      rating               : user.rating,
      canGenerate          : isMentor && xp >= 500,
      cooldownEnd,
      history,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch XP stats' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/certificates/generate   - mentors >= 500 XP, 24h cooldown
// ─────────────────────────────────────────────────────────────────────
router.post('/generate', auth, async (req, res) => {
  try {
    const uid  = req.user.id;
    const user = await User.findById(uid).select('name role total_xp xp_level total_students_helped total_hours_helped rating department');
    if (!user)                          return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'mentor')         return res.status(403).json({ error: 'Only mentors can generate the Verified Mentor Certificate.' });
    if ((user.total_xp || 0) < 500)     return res.status(403).json({ error: 'You need at least 500 XP to generate a certificate.' });

    const lastCert = await Certificate.findOne({ user_id: uid }).sort({ created_at: -1 }).select('created_at');
    if (lastCert) {
      const diff = Date.now() - new Date(lastCert.created_at).getTime();
      if (diff < 24 * 60 * 60 * 1000) {
        const cooldownEnd = new Date(new Date(lastCert.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
        return res.status(429).json({ error: 'Certificate already generated recently. Try again after 24 hours.', cooldownEnd });
      }
    }

    const resourcesCount = await Resource.countDocuments({ uploader_id: uid });

    const now        = new Date();
    const dateStr    = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand       = String(Math.floor(10000 + Math.random() * 90000));
    const certNumber = `PB-NUST-${dateStr}-${rand}`;

    const filePath     = await generateCertPDF({ ...user.toObject(), resources_count: resourcesCount }, certNumber);
    const relativePath = `/certificates/${path.basename(filePath)}`;

    await Certificate.create({
      user_id       : uid,
      cert_number   : certNumber,
      xp_snapshot   : user.total_xp,
      level_snapshot: user.xp_level,
      file_path     : relativePath,
    });

    cleanupOldCertificates().catch(() => {});

    res.json({ certNumber, downloadUrl: relativePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate certificate' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/certificates/download/:certNumber
// ─────────────────────────────────────────────────────────────────────
router.get('/download/:certNumber', auth, async (req, res) => {
  try {
    const cert = await Certificate.findOne({ cert_number: req.params.certNumber });
    if (!cert)                                 return res.status(404).json({ error: 'Certificate not found' });
    if (cert.user_id.toString() !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const fp = path.join(CERT_DIR, `${cert.cert_number}.pdf`);
    if (!fs.existsSync(fp))
      return res.status(410).json({ error: 'Certificate file has expired. Please regenerate.' });

    res.download(fp, `PeerBridge-Certificate-${cert.cert_number}.pdf`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to download certificate' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/certificates/test-add-xp   (DEV only - +100 XP for testing)
// ─────────────────────────────────────────────────────────────────────
router.post('/test-add-xp', auth, async (req, res) => {
  try {
    await awardXP(req.user.id, 'Test XP (dev)', 100, null, null);
    const user = await User.findById(req.user.id).select('total_xp xp_level');
    res.json({ total_xp: user.total_xp, xp_level: user.xp_level });
  } catch {
    res.status(500).json({ error: 'Failed to add test XP' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/certificates/test-regenerate
//
// DEV-only endpoint for previewing certificate layout changes. Skips
// the 24h cooldown and the mentor/XP gating so you can iterate on the
// PDF design without waiting between regenerations. Remove this route
// (and the matching button in XpSection.jsx) before shipping.
// ─────────────────────────────────────────────────────────────────────
router.post('/test-regenerate', auth, async (req, res) => {
  try {
    const uid  = req.user.id;
    const user = await User.findById(uid).select('name role total_xp xp_level total_students_helped total_hours_helped rating department');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const resourcesCount = await Resource.countDocuments({ uploader_id: uid });

    const now        = new Date();
    const dateStr    = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand       = String(Math.floor(10000 + Math.random() * 90000));
    const certNumber = `PB-NUST-${dateStr}-${rand}`;

    const filePath     = await generateCertPDF({ ...user.toObject(), resources_count: resourcesCount }, certNumber);
    const relativePath = `/certificates/${path.basename(filePath)}`;

    await Certificate.create({
      user_id       : uid,
      cert_number   : certNumber,
      xp_snapshot   : user.total_xp,
      level_snapshot: user.xp_level,
      file_path     : relativePath,
    });

    res.json({ certNumber, downloadUrl: relativePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to regenerate certificate' });
  }
});

module.exports = router;
