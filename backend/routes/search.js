const router = require('express').Router();
const auth   = require('../middleware/auth');
const { supabase } = require('../config/supabase');
const { PUBLIC_FIELDS } = require('../data/shapers');

function likeTerm(s) {
  return String(s).replace(/[%,()]/g, ' ').trim();
}

// ── GET /api/search?q=  — unified search across posts, mentors, resources ─
router.get('/', auth, async (req, res) => {
  try {
    const q = likeTerm(req.query.q || '');
    if (!q || q.length < 2) return res.json({ posts: [], mentors: [], resources: [] });

    const [postsRes, mentorsRes, resourcesRes] = await Promise.all([
      supabase.from('posts')
        .select('id, title, tag, created_at, author:author_id(name)')
        .or(`title.ilike.%${q}%,body.ilike.%${q}%`)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false }).limit(6),
      supabase.from('users')
        .select(PUBLIC_FIELDS)
        .eq('role', 'mentor').eq('is_under_review', false)
        .or(`name.ilike.%${q}%,department.ilike.%${q}%,bio.ilike.%${q}%`)
        .limit(6),
      supabase.from('resources')
        .select('id, title, category, course_code, file_type')
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .order('created_at', { ascending: false }).limit(6),
    ]);

    res.json({
      posts: (postsRes.data || []).map(p => ({
        id: p.id, title: p.title, tag: p.tag,
        author_name: p.author?.name || 'Unknown',
      })),
      mentors: mentorsRes.data || [],
      resources: resourcesRes.data || [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
