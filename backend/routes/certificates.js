const router = require('express').Router();
const fs     = require('fs');
const path   = require('path');

const auth          = require('../middleware/auth');
const { supabase }  = require('../config/supabase');

const { generateCertPDF, cleanupOldCertificates, CERT_DIR } = require('../services/certificateGenerator');
const { getLevel, LEVELS, awardXP }                          = require('../services/xpManager');

async function countResources(uid) {
  const { count } = await supabase
    .from('resources').select('id', { count: 'exact', head: true }).eq('uploader_id', uid);
  return count || 0;
}

async function latestCertDate(uid) {
  const { data } = await supabase
    .from('certificates').select('created_at')
    .eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

function makeCertNumber() {
  const now     = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand    = String(Math.floor(10000 + Math.random() * 90000));
  return `PB-NUST-${dateStr}-${rand}`;
}

// ─────────────────────────────────────────────────────────────────────
// GET /api/certificates/xp-stats   - profile dashboard data
// ─────────────────────────────────────────────────────────────────────
router.get('/xp-stats', auth, async (req, res) => {
  try {
    const uid  = req.user.id;
    const { data: user } = await supabase
      .from('users')
      .select('role, total_xp, xp_level, total_students_helped, total_hours_helped, rating, department')
      .eq('id', uid).maybeSingle();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [resourcesCount, { data: history }, lastCert] = await Promise.all([
      countResources(uid),
      supabase.from('xp_transactions')
        .select('points, reason, ref_type, created_at')
        .eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
      latestCertDate(uid),
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
      history              : history || [],
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
    const { data: user } = await supabase
      .from('users')
      .select('name, role, total_xp, xp_level, total_students_helped, total_hours_helped, rating, department')
      .eq('id', uid).maybeSingle();
    if (!user)                          return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'mentor')         return res.status(403).json({ error: 'Only mentors can generate the Verified Mentor Certificate.' });
    if ((user.total_xp || 0) < 500)     return res.status(403).json({ error: 'You need at least 500 XP to generate a certificate.' });

    const lastCert = await latestCertDate(uid);
    if (lastCert) {
      const diff = Date.now() - new Date(lastCert.created_at).getTime();
      if (diff < 24 * 60 * 60 * 1000) {
        const cooldownEnd = new Date(new Date(lastCert.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
        return res.status(429).json({ error: 'Certificate already generated recently. Try again after 24 hours.', cooldownEnd });
      }
    }

    const resourcesCount = await countResources(uid);
    const certNumber     = makeCertNumber();

    const filePath     = await generateCertPDF({ ...user, resources_count: resourcesCount }, certNumber);
    const relativePath = `/certificates/${path.basename(filePath)}`;

    await supabase.from('certificates').insert({
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
    const { data: cert } = await supabase
      .from('certificates').select('*').eq('cert_number', req.params.certNumber).maybeSingle();
    if (!cert)                            return res.status(404).json({ error: 'Certificate not found' });
    if (cert.user_id !== req.user.id)     return res.status(403).json({ error: 'Forbidden' });

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
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Not available' });
    await awardXP(req.user.id, 'Test XP (dev)', 100, null, null);
    const { data: user } = await supabase
      .from('users').select('total_xp, xp_level').eq('id', req.user.id).maybeSingle();
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
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Not available' });
    const uid  = req.user.id;
    const { data: user } = await supabase
      .from('users')
      .select('name, role, total_xp, xp_level, total_students_helped, total_hours_helped, rating, department')
      .eq('id', uid).maybeSingle();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const resourcesCount = await countResources(uid);
    const certNumber     = makeCertNumber();

    const filePath     = await generateCertPDF({ ...user, resources_count: resourcesCount }, certNumber);
    const relativePath = `/certificates/${path.basename(filePath)}`;

    await supabase.from('certificates').insert({
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
