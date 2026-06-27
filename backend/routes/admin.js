const router = require('express').Router();
const auth   = require('../middleware/auth');
const admin  = require('../middleware/admin');
const { supabase } = require('../config/supabase');

// All routes require a logged-in admin.
router.use(auth, admin);

// ── GET /api/admin/stats ────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const count = (table, filter) => {
      let q = supabase.from(table).select('id', { count: 'exact', head: true });
      if (filter) q = filter(q);
      return q.then(r => r.count || 0);
    };
    const [users, mentors, posts, hidden, reports, pending, locked] = await Promise.all([
      count('users'),
      count('users', q => q.eq('role', 'mentor')),
      count('posts'),
      count('posts', q => q.eq('is_hidden', true)),
      count('reports'),
      count('users', q => q.eq('is_under_review', true)),
      count('users', q => q.eq('is_locked', true)),
    ]);
    res.json({ users, mentors, posts, hidden, reports, pending_mentors: pending, locked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ── GET /api/admin/reports — grouped by target, with details ────────────
router.get('/reports', async (req, res) => {
  try {
    const { data: rows } = await supabase
      .from('reports').select('target_type, target_id, reason, created_at')
      .order('created_at', { ascending: false }).limit(500);

    // Group by target.
    const map = new Map();
    for (const r of (rows || [])) {
      const k = `${r.target_type}:${r.target_id}`;
      if (!map.has(k)) map.set(k, { target_type: r.target_type, target_id: r.target_id, count: 0, reasons: {}, last: r.created_at });
      const g = map.get(k);
      g.count++; g.reasons[r.reason] = (g.reasons[r.reason] || 0) + 1;
    }
    const groups = [...map.values()].sort((a, b) => b.count - a.count).slice(0, 60);

    // Hydrate target details.
    const postIds = groups.filter(g => g.target_type === 'post').map(g => g.target_id);
    const userIds = groups.filter(g => g.target_type === 'user').map(g => g.target_id);
    const [{ data: posts }, { data: users }] = await Promise.all([
      postIds.length ? supabase.from('posts').select('id, title, is_hidden, author:author_id(name)').in('id', postIds) : { data: [] },
      userIds.length ? supabase.from('users').select('id, name, is_locked, role').in('id', userIds) : { data: [] },
    ]);
    const postMap = Object.fromEntries((posts || []).map(p => [p.id, p]));
    const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));

    res.json(groups.map(g => ({
      ...g,
      detail: g.target_type === 'post' ? postMap[g.target_id] : userMap[g.target_id],
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load reports' });
  }
});

// ── GET /api/admin/pending-mentors ──────────────────────────────────────
router.get('/pending-mentors', async (req, res) => {
  try {
    const { data } = await supabase
      .from('users').select('id, name, department, bio, profile_image, created_at')
      .eq('role', 'mentor').eq('is_under_review', true)
      .order('created_at', { ascending: false });
    res.json(data || []);
  } catch {
    res.status(500).json({ error: 'Failed to load pending mentors' });
  }
});

// ── POST /api/admin/posts/:id/hide  { hidden } ──────────────────────────
router.post('/posts/:id/hide', async (req, res) => {
  try {
    const hidden = req.body.hidden !== false;
    await supabase.from('posts').update({ is_hidden: hidden }).eq('id', req.params.id);
    res.json({ ok: true, is_hidden: hidden });
  } catch {
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// ── POST /api/admin/users/:id/lock  { locked } ──────────────────────────
router.post('/users/:id/lock', async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot lock yourself' });
    const locked = req.body.locked !== false;
    await supabase.from('users').update({ is_locked: locked }).eq('id', req.params.id);
    res.json({ ok: true, is_locked: locked });
  } catch {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── POST /api/admin/mentors/:id/review  { approve } ─────────────────────
router.post('/mentors/:id/review', async (req, res) => {
  try {
    const approve = req.body.approve !== false;
    // Approve = clear the under-review flag. Reject = demote to student.
    const update = approve ? { is_under_review: false } : { is_under_review: false, role: 'student' };
    await supabase.from('users').update(update).eq('id', req.params.id);
    res.json({ ok: true, approved: approve });
  } catch {
    res.status(500).json({ error: 'Failed to update mentor' });
  }
});

// ── POST /api/admin/reports/:type/:id/dismiss — clear reports ───────────
router.post('/reports/:type/:id/dismiss', async (req, res) => {
  try {
    await supabase.from('reports').delete()
      .eq('target_type', req.params.type).eq('target_id', req.params.id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to dismiss reports' });
  }
});

module.exports = router;
