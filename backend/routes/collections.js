const router = require('express').Router();
const auth   = require('../middleware/auth');
const { supabase } = require('../config/supabase');
const { shapePost } = require('../data/shapers');

const POST_AUTHOR = 'author:author_id(name,role,department,graduation_year)';

// ── GET /api/collections  — my collections + item counts ────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { data: cols, error } = await supabase
      .from('collections').select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const ids = (cols || []).map(c => c.id);
    let counts = {};
    if (ids.length) {
      const { data: items } = await supabase
        .from('collection_items').select('collection_id').in('collection_id', ids);
      (items || []).forEach(i => { counts[i.collection_id] = (counts[i.collection_id] || 0) + 1; });
    }
    res.json((cols || []).map(c => ({ ...c, item_count: counts[c.id] || 0 })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// ── POST /api/collections  { name } ─────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Collection name is required' });
    const { data, error } = await supabase
      .from('collections').insert({ user_id: req.user.id, name: name.slice(0, 60) })
      .select().single();
    if (error) throw error;
    res.status(201).json({ ...data, item_count: 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

// ── DELETE /api/collections/:id ─────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    await supabase.from('collections').delete()
      .eq('id', req.params.id).eq('user_id', req.user.id);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

// ── GET /api/collections/:id  — collection + its posts ──────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const { data: col } = await supabase
      .from('collections').select('*')
      .eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (!col) return res.status(404).json({ error: 'Collection not found' });

    const { data: items } = await supabase
      .from('collection_items').select('post_id').eq('collection_id', col.id);
    const ids = (items || []).map(i => i.post_id);
    if (!ids.length) return res.json({ ...col, posts: [] });

    const { data: posts } = await supabase
      .from('posts').select(`*, ${POST_AUTHOR}`).in('id', ids).eq('is_hidden', false)
      .order('created_at', { ascending: false });

    const [{ data: liked }, { data: bookmarked }] = await Promise.all([
      supabase.from('post_likes').select('post_id').eq('user_id', req.user.id).in('post_id', ids),
      supabase.from('post_bookmarks').select('post_id').eq('user_id', req.user.id).in('post_id', ids),
    ]);
    const likedSet = new Set((liked || []).map(r => r.post_id));
    const bmSet    = new Set((bookmarked || []).map(r => r.post_id));

    res.json({ ...col, posts: (posts || []).map(p => shapePost(p, likedSet, bmSet)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

// ── POST /api/collections/:id/items  { post_id } ────────────────────────
router.post('/:id/items', auth, async (req, res) => {
  try {
    const { post_id } = req.body;
    if (!post_id) return res.status(400).json({ error: 'post_id is required' });
    // Ownership check on the collection.
    const { data: col } = await supabase
      .from('collections').select('id').eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
    if (!col) return res.status(404).json({ error: 'Collection not found' });

    const { error } = await supabase
      .from('collection_items').insert({ collection_id: req.params.id, post_id });
    if (error && error.code !== '23505') throw error;   // ignore duplicate
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add to collection' });
  }
});

// ── DELETE /api/collections/:id/items/:postId ───────────────────────────
router.delete('/:id/items/:postId', auth, async (req, res) => {
  try {
    await supabase.from('collection_items').delete()
      .eq('collection_id', req.params.id).eq('post_id', req.params.postId);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to remove from collection' });
  }
});

module.exports = router;
