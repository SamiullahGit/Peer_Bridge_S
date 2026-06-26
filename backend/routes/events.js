const router = require('express').Router();
const multer = require('multer');

const auth          = require('../middleware/auth');
const { supabase }  = require('../config/supabase');
const { shapeEvent } = require('../data/shapers');
const { makeStorage, fileUrl } = require('../config/storage');

const upload = multer({
  storage: makeStorage('events', 'event'),
  limits : { fileSize: 10 * 1024 * 1024 },
});

const EVENT_ORGANIZER = 'organizer:organizer_id(name,role)';

// Local-time YYYY-MM-DD (parity with the old local-midnight Date filter).
function todayLocalDate() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────
// GET /api/events?when=upcoming|past&category=
// ─────────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { when = 'upcoming', upcoming, category } = req.query;
    const mode = upcoming === 'true' ? 'upcoming' : when;

    const todayStr = todayLocalDate();

    let q = supabase.from('events').select(`*, ${EVENT_ORGANIZER}`);
    q = mode === 'past' ? q.lt('event_date', todayStr) : q.gte('event_date', todayStr);
    if (category) q = q.eq('category', category);

    q = q.order('event_date', { ascending: mode !== 'past' }).limit(50);

    const { data: events, error } = await q;
    if (error) throw error;

    // Decorate with the viewer's RSVP flags.
    const ids = (events || []).map(e => e.id);
    let goingSet = new Set();
    if (ids.length) {
      const { data: rsvps } = await supabase
        .from('event_rsvps').select('event_id')
        .eq('user_id', req.user.id).in('event_id', ids);
      goingSet = new Set((rsvps || []).map(r => r.event_id));
    }
    res.json((events || []).map(e => ({ ...shapeEvent(e), my_rsvp: goingSet.has(e.id) })));
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

    if (event_date < todayLocalDate()) return res.status(400).json({ error: 'Event date cannot be in the past' });

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        organizer_id: req.user.id,
        title       : title.trim(),
        description : description || null,
        venue       : venue.trim(),
        event_date,                         // 'YYYY-MM-DD' from <input type=date>
        event_time  : event_time || null,
        category    : category || 'Other',
        image_path  : fileUrl(req.file),
      })
      .select(`*, ${EVENT_ORGANIZER}`)
      .single();
    if (error) throw error;

    res.status(201).json(shapeEvent(event));
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
    const { data: e } = await supabase
      .from('events').select('id, organizer_id').eq('id', req.params.id).maybeSingle();
    if (!e) return res.status(404).json({ error: 'Not found' });
    if (e.organizer_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Forbidden' });

    await supabase.from('events').delete().eq('id', req.params.id);
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/events/:id/rsvp   (toggle "I'm going")
// ─────────────────────────────────────────────────────────────────────
router.post('/:id/rsvp', auth, async (req, res) => {
  try {
    const { data: removed } = await supabase
      .from('event_rsvps').delete()
      .eq('user_id', req.user.id).eq('event_id', req.params.id)
      .select();
    if (removed && removed.length) {
      await supabase.rpc('adjust_counter', { p_table: 'events', p_id: req.params.id, p_column: 'rsvp_count', p_delta: -1 });
      return res.json({ going: false });
    }
    await supabase.from('event_rsvps').insert({ user_id: req.user.id, event_id: req.params.id });
    await supabase.rpc('adjust_counter', { p_table: 'events', p_id: req.params.id, p_column: 'rsvp_count', p_delta: 1 });
    res.json({ going: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to RSVP' });
  }
});

module.exports = router;
