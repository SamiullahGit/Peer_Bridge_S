const router = require('express').Router();
const multer = require('multer');
const path   = require('path');

const auth          = require('../middleware/auth');
const { supabase }  = require('../config/supabase');
const xpManager     = require('../services/xpManager');
const { shapeResource } = require('../data/shapers');
const { makeStorage, fileUrl } = require('../config/storage');

// Per-file cap for resource uploads. Kept comfortably under Supabase's
// default 50 MB project upload limit (and buffered in memory during upload).
const RESOURCE_MAX_BYTES = 25 * 1024 * 1024;

const upload = multer({
  storage: makeStorage('resources', 'resource'),
  limits : { fileSize: RESOURCE_MAX_BYTES },
});

function likeTerm(s) {
  return String(s).replace(/[%,()]/g, ' ').trim();
}

const RES_UPLOADER = 'uploader:uploader_id(name,role)';

// ─────────────────────────────────────────────────────────────────────
// GET /api/resources?category=&search=&course=
// ─────────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { category, search, course } = req.query;

    let q = supabase.from('resources').select(`*, ${RES_UPLOADER}`);
    if (category) q = q.eq('category', category);
    if (course)   q = q.eq('course_code', course);
    if (search) {
      const s = likeTerm(search);
      q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
    }
    q = q.order('created_at', { ascending: false }).limit(50);

    const { data: rows, error } = await q;
    if (error) throw error;

    // Decorate with the viewer's upvote flags.
    const ids = (rows || []).map(r => r.id);
    let votedSet = new Set();
    if (ids.length) {
      const { data: votes } = await supabase
        .from('resource_votes').select('resource_id')
        .eq('user_id', req.user.id).in('resource_id', ids);
      votedSet = new Set((votes || []).map(v => v.resource_id));
    }
    res.json((rows || []).map(r => ({ ...shapeResource(r), my_voted: votedSet.has(r.id) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/resources/:id/upvote   (toggle)
// ─────────────────────────────────────────────────────────────────────
router.post('/:id/upvote', auth, async (req, res) => {
  try {
    const { data: removed } = await supabase
      .from('resource_votes').delete()
      .eq('user_id', req.user.id).eq('resource_id', req.params.id)
      .select();
    if (removed && removed.length) {
      await supabase.rpc('adjust_counter', { p_table: 'resources', p_id: req.params.id, p_column: 'upvotes_count', p_delta: -1 });
      return res.json({ voted: false });
    }
    await supabase.from('resource_votes').insert({ user_id: req.user.id, resource_id: req.params.id });
    await supabase.rpc('adjust_counter', { p_table: 'resources', p_id: req.params.id, p_column: 'upvotes_count', p_delta: 1 });
    res.json({ voted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upvote' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/resources    (multipart/form-data)
// ─────────────────────────────────────────────────────────────────────
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    const { title, description, category, course_code } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const file = req.file;
    const { data: resource, error } = await supabase
      .from('resources')
      .insert({
        uploader_id: req.user.id,
        title,
        description: description || null,
        // file_path is the public Supabase Storage URL the download route
        // redirects to.
        file_path  : file ? fileUrl(file) : null,
        file_name  : file ? file.originalname : null,
        file_type  : file ? path.extname(file.originalname).slice(1).toUpperCase() : null,
        file_size  : file ? file.size : null,
        category   : category || 'Other',
        course_code: course_code || null,
      })
      .select(`*, ${RES_UPLOADER}`)
      .single();
    if (error) throw error;

    // Resource upload: +10 XP (student) or +20 XP (mentor).
    const points = req.user.role === 'mentor' ? 20 : 10;
    const xp     = await xpManager.awardXP(req.user.id, 'Uploaded a resource', points, 'resource', resource.id);

    res.status(201).json({
      ...shapeResource(resource),
      xp_earned: { points, message: 'Resource uploaded', newTotal: xp.newTotal, newLevel: xp.newLevel, levelUp: xp.levelUp },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload resource' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/resources/:id/download
// ─────────────────────────────────────────────────────────────────────
router.get('/:id/download', auth, async (req, res) => {
  try {
    const { data: resource } = await supabase
      .from('resources').select('*').eq('id', req.params.id).maybeSingle();
    if (!resource) return res.status(404).json({ error: 'Not found' });

    await supabase.rpc('adjust_counter', { p_table: 'resources', p_id: req.params.id, p_column: 'downloads_count', p_delta: 1 });

    if (!resource.file_path) {
      return res.status(404).json({ error: 'File not available' });
    }
    // Cloudinary-backed resources have an https URL stored in file_path -
    // redirect the client to it (Cloudinary handles delivery + CDN).
    if (/^https?:\/\//i.test(resource.file_path)) {
      return res.redirect(resource.file_path);
    }
    // Local-disk-backed resources use Express's res.download() so the
    // browser sees the original filename in the Save dialog.
    return res.download(resource.file_path, resource.file_name);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Download failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// DELETE /api/resources/:id   - uploader or admin only
// ─────────────────────────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const { data: r } = await supabase
      .from('resources').select('id, uploader_id').eq('id', req.params.id).maybeSingle();
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.uploader_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Forbidden' });

    await supabase.from('resources').delete().eq('id', req.params.id);
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;
