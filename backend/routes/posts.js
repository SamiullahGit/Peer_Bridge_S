const router = require('express').Router();
const multer = require('multer');

const auth         = require('../middleware/auth');
const { supabase } = require('../config/supabase');
const xpManager    = require('../services/xpManager');
const { shapePost, shapeReply } = require('../data/shapers');
const { makeStorage, fileUrl }  = require('../config/storage');

// Embedded author projection reused across post queries.
const POST_AUTHOR = 'author:author_id(name,role,department,graduation_year)';

const upload = multer({
  storage: makeStorage('posts', 'post'),
  limits : { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  },
});

// Make a free-text term safe for a PostgREST ilike / .or() filter.
function likeTerm(s) {
  return String(s).replace(/[%,()]/g, ' ').trim();
}

// Shared helper: attach the viewer's liked/bookmarked flags to a page of posts.
async function decoratePosts(posts, viewerId) {
  if (!posts.length) return [];
  const ids = posts.map(p => p.id);

  const [{ data: liked }, { data: bookmarked }] = await Promise.all([
    supabase.from('post_likes').select('post_id').eq('user_id', viewerId).in('post_id', ids),
    supabase.from('post_bookmarks').select('post_id').eq('user_id', viewerId).in('post_id', ids),
  ]);
  const likedSet = new Set((liked || []).map(r => r.post_id));
  const bmSet    = new Set((bookmarked || []).map(r => r.post_id));

  return posts.map(p => shapePost(p, likedSet, bmSet));
}

// ─────────────────────────────────────────────────────────────────────
// GET /api/posts?tag=&search=&limit=&offset=
// ─────────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { tag, search, limit = 30, offset = 0 } = req.query;
    const safeLimit  = Math.min(Math.max(parseInt(limit,  10) || 30, 1), 100);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

    // Single round-trip: posts + the viewer's liked/bookmarked flags,
    // computed server-side in get_feed() (see sql/0004_get_feed.sql).
    const { data, error } = await supabase.rpc('get_feed', {
      viewer  : req.user.id,
      p_tag   : (tag && tag !== 'For you') ? likeTerm(tag) : null,
      p_search: search ? likeTerm(search) : null,
      p_limit : safeLimit,
      p_offset: safeOffset,
    });
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/posts   (multipart/form-data: tag, title, body, image?)
// ─────────────────────────────────────────────────────────────────────
router.post('/', auth, (req, res) => {
  upload.single('image')(req, res, async (uploadErr) => {
    if (uploadErr) {
      const message = uploadErr.message === 'Only image uploads are allowed'
        ? 'Please upload a valid image file'
        : uploadErr.code === 'LIMIT_FILE_SIZE'
          ? 'Image must be smaller than 8 MB'
          : 'Failed to upload image';
      return res.status(400).json({ error: message });
    }

    try {
      const { tag, title, body, is_anonymous } = req.body;
      if (!tag || !title) return res.status(400).json({ error: 'Tag and title are required' });

      const { data: post, error } = await supabase
        .from('posts')
        .insert({
          author_id   : req.user.id,
          tag,
          title,
          body        : body || null,
          image_path  : fileUrl(req.file),
          is_anonymous: is_anonymous === 'true',
        })
        .select(`*, ${POST_AUTHOR}`)
        .single();
      if (error) throw error;

      const [shaped] = await decoratePosts([post], req.user.id);

      // Asking a question -> +5 XP for STUDENT only.
      let xp_earned = null;
      if (req.user.role === 'student') {
        const xp = await xpManager.awardXP(req.user.id, 'Asked a question', 5, 'post', post.id);
        xp_earned = { points: 5, message: 'You asked a question', newTotal: xp.newTotal, newLevel: xp.newLevel, levelUp: xp.levelUp };
      }
      res.status(201).json({ ...shaped, ...(xp_earned ? { xp_earned } : {}) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create post' });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/posts/bookmarks   - the current user's saved posts
// ─────────────────────────────────────────────────────────────────────
router.get('/bookmarks', auth, async (req, res) => {
  try {
    const { data: bookmarks } = await supabase
      .from('post_bookmarks').select('post_id').eq('user_id', req.user.id);
    const ids = (bookmarks || []).map(b => b.post_id);
    if (!ids.length) return res.json([]);

    const { data: posts, error } = await supabase
      .from('posts')
      .select(`*, ${POST_AUTHOR}`)
      .in('id', ids)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.json(await decoratePosts(posts, req.user.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch saved posts' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// PATCH /api/posts/:id   - author only  { tag?, title?, body? }
// ─────────────────────────────────────────────────────────────────────
router.patch('/:id', auth, async (req, res) => {
  try {
    const { data: post } = await supabase
      .from('posts').select('id, author_id').eq('id', req.params.id).maybeSingle();
    if (!post)              return res.status(404).json({ error: 'Post not found' });
    if (post.author_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const { tag, title, body } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const { data: updated, error } = await supabase
      .from('posts')
      .update({ tag, title: title.trim(), body: body || null })
      .eq('id', req.params.id)
      .select(`*, ${POST_AUTHOR}`)
      .single();
    if (error) throw error;

    const [shaped] = await decoratePosts([updated], req.user.id);
    res.json(shaped);
  } catch {
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// DELETE /api/posts/:id   - author only
// ─────────────────────────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const { data: post } = await supabase
      .from('posts').select('id, author_id').eq('id', req.params.id).maybeSingle();
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.author_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await supabase.from('posts').delete().eq('id', req.params.id);
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/posts/:id/like   (toggle)
// ─────────────────────────────────────────────────────────────────────
router.post('/:id/like', auth, async (req, res) => {
  try {
    const { data: removed } = await supabase
      .from('post_likes').delete()
      .eq('user_id', req.user.id).eq('post_id', req.params.id)
      .select();
    if (removed && removed.length) {
      await supabase.rpc('adjust_counter', { p_table: 'posts', p_id: req.params.id, p_column: 'likes_count', p_delta: -1 });
      return res.json({ liked: false });
    }
    await supabase.from('post_likes').insert({ user_id: req.user.id, post_id: req.params.id });
    await supabase.rpc('adjust_counter', { p_table: 'posts', p_id: req.params.id, p_column: 'likes_count', p_delta: 1 });
    res.json({ liked: true });
  } catch {
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/posts/:id/bookmark   (toggle)
// ─────────────────────────────────────────────────────────────────────
router.post('/:id/bookmark', auth, async (req, res) => {
  try {
    const { data: removed } = await supabase
      .from('post_bookmarks').delete()
      .eq('user_id', req.user.id).eq('post_id', req.params.id)
      .select();
    if (removed && removed.length) {
      await supabase.rpc('adjust_counter', { p_table: 'posts', p_id: req.params.id, p_column: 'bookmarks_count', p_delta: -1 });
      return res.json({ bookmarked: false });
    }
    await supabase.from('post_bookmarks').insert({ user_id: req.user.id, post_id: req.params.id });
    await supabase.rpc('adjust_counter', { p_table: 'posts', p_id: req.params.id, p_column: 'bookmarks_count', p_delta: 1 });
    res.json({ bookmarked: true });
  } catch {
    res.status(500).json({ error: 'Failed to toggle bookmark' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// GET / POST  /api/posts/:id/replies
// ─────────────────────────────────────────────────────────────────────
router.get('/:id/replies', auth, async (req, res) => {
  try {
    const { data: replies, error } = await supabase
      .from('replies')
      .select('*, author:author_id(name,role)')
      .eq('post_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    res.json((replies || []).map(shapeReply));
  } catch {
    res.status(500).json({ error: 'Failed to fetch replies' });
  }
});

router.post('/:id/replies', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Reply text is required' });

    const { data: reply, error } = await supabase
      .from('replies')
      .insert({ post_id: req.params.id, author_id: req.user.id, text })
      .select('*, author:author_id(name,role)')
      .single();
    if (error) throw error;

    await supabase.rpc('adjust_counter', { p_table: 'posts', p_id: req.params.id, p_column: 'comments_count', p_delta: 1 });

    // Answering -> +10 XP for MENTOR only.
    let xp_earned = null;
    if (req.user.role === 'mentor') {
      const xp = await xpManager.awardXP(req.user.id, 'Answered a question', 10, 'reply', reply.id);
      xp_earned = { points: 10, message: 'You answered a question', newTotal: xp.newTotal, newLevel: xp.newLevel, levelUp: xp.levelUp };
    }

    res.status(201).json({ ...shapeReply(reply), ...(xp_earned ? { xp_earned } : {}) });
  } catch {
    res.status(500).json({ error: 'Failed to add reply' });
  }
});

module.exports = router;
