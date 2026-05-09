const router = require('express').Router();
const multer = require('multer');

const auth  = require('../middleware/auth');
const Event = require('../models/Event');
const { makeStorage, fileUrl } = require('../config/storage');

const upload = multer({
  storage: makeStorage('events', 'event'),
  limits : { fileSize: 10 * 1024 * 1024 },
});

function shape(e) {
  const obj          = e.toObject ? e.toObject() : e;
  obj.id             = obj._id.toString();
  obj.organizer_id   = obj.organizer_id?._id ? obj.organizer_id._id.toString() : obj.organizer_id?.toString();
  obj.organizer_name = obj.organizer && obj.organizer.name ? obj.organizer.name : obj.organizer_name;
  obj.organizer_role = obj.organizer && obj.organizer.role ? obj.organizer.role : obj.organizer_role;
  return obj;
}

// ─────────────────────────────────────────────────────────────────────
// GET /api/events?when=upcoming|past&category=
// ─────────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { when = 'upcoming', upcoming, category } = req.query;
    const mode = upcoming === 'true' ? 'upcoming' : when;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filter = {};
    filter.event_date = mode === 'past' ? { $lt: today } : { $gte: today };
    if (category) filter.category = category;

    const sortDir = mode === 'past' ? -1 : 1;

    const events = await Event.find(filter)
      .sort({ event_date: sortDir })
      .limit(50)
      .populate({ path: 'organizer_id', select: 'name role', options: { lean: true } });

    res.json(events.map(e => {
      const obj = e.toObject();
      const o   = obj.organizer_id || {};
      return {
        ...obj,
        id            : obj._id.toString(),
        organizer_id  : o._id ? o._id.toString() : obj.organizer_id,
        organizer_name: o.name,
        organizer_role: o.role,
      };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/events    (multipart/form-data)
// ─────────────────────────────────────────────────────────────────────
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { title, description, venue, event_date, event_time, category } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!venue || !venue.trim()) return res.status(400).json({ error: 'Venue is required' });
    if (!event_date)             return res.status(400).json({ error: 'Date is required' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(event_date) < today) return res.status(400).json({ error: 'Event date cannot be in the past' });

    const created = await Event.create({
      organizer_id: req.user.id,
      title       : title.trim(),
      description : description || null,
      venue       : venue.trim(),
      event_date  : new Date(event_date),
      event_time  : event_time || null,
      category    : category || 'Other',
      image_path  : fileUrl(req.file),
    });

    const event = await Event.findById(created._id).populate('organizer_id', 'name role');
    const o     = event.organizer_id || {};
    res.status(201).json({
      ...event.toObject(),
      id            : event._id.toString(),
      organizer_id  : o._id ? o._id.toString() : event.organizer_id,
      organizer_name: o.name,
      organizer_role: o.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// DELETE /api/events/:id   - organizer or admin only
// ─────────────────────────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const e = await Event.findById(req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    if (e.organizer_id.toString() !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Forbidden' });

    await e.deleteOne();
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
