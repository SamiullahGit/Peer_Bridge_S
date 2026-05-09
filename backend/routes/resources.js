const router = require('express').Router();
const multer = require('multer');
const path   = require('path');

const auth      = require('../middleware/auth');
const Resource  = require('../models/Resource');
const xpManager = require('../services/xpManager');
const { makeStorage, fileUrl, HAS_CLOUDINARY } = require('../config/storage');

// Cloudinary's free-tier raw upload cap is 10 MB per file. When running
// locally with disk storage we keep the original 100 MB ceiling so the
// dev experience is unchanged.
const RESOURCE_MAX_BYTES = HAS_CLOUDINARY ? 10 * 1024 * 1024 : 100 * 1024 * 1024;

const upload = multer({
  storage: makeStorage('resources', 'resource'),
  limits : { fileSize: RESOURCE_MAX_BYTES },
});

function shape(r) {
  const obj         = r.toObject ? r.toObject() : r;
  obj.id            = obj._id.toString();
  const u           = obj.uploader_id || {};
  obj.uploader_id   = u._id ? u._id.toString() : obj.uploader_id;
  obj.uploader_name = u.name;
  obj.uploader_role = u.role;
  return obj;
}

// ─────────────────────────────────────────────────────────────────────
// GET /api/resources?category=&search=&course=
// ─────────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { category, search, course } = req.query;
    const filter = {};
    if (category) filter.category    = category;
    if (course)   filter.course_code = course;
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ title: re }, { description: re }];
    }

    const rows = await Resource.find(filter)
      .sort({ created_at: -1 })
      .limit(50)
      .populate('uploader_id', 'name role');

    res.json(rows.map(shape));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch resources' });
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
    const created = await Resource.create({
      uploader_id: req.user.id,
      title,
      description: description || null,
      // file_path is the canonical URL/path used for download. With
      // Cloudinary it's an https URL we can redirect to; with local disk
      // it's the absolute filesystem path res.download() needs.
      file_path  : file ? (HAS_CLOUDINARY ? fileUrl(file) : file.path) : null,
      file_name  : file ? file.originalname : null,
      file_type  : file ? path.extname(file.originalname).slice(1).toUpperCase() : null,
      file_size  : file ? file.size : null,
      category   : category || 'Other',
      course_code: course_code || null,
    });

    const resource = await Resource.findById(created._id).populate('uploader_id', 'name role');

    // Resource upload: +10 XP (student) or +20 XP (mentor).
    const points = req.user.role === 'mentor' ? 20 : 10;
    const xp     = await xpManager.awardXP(req.user.id, 'Uploaded a resource', points, 'resource', resource._id);

    res.status(201).json({
      ...shape(resource),
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
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ error: 'Not found' });

    await Resource.findByIdAndUpdate(req.params.id, { $inc: { downloads_count: 1 } });

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
    const r = await Resource.findById(req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.uploader_id.toString() !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Forbidden' });

    await r.deleteOne();
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

module.exports = router;
