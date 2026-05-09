const router = require('express').Router();
const multer = require('multer');

const auth         = require('../middleware/auth');
const Post         = require('../models/Post');
const PostLike     = require('../models/PostLike');
const PostBookmark = require('../models/PostBookmark');
const Reply        = require('../models/Reply');
const xpManager    = require('../services/xpManager');
const { makeStorage, fileUrl } = require('../config/storage');

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

// Shared helper: shape a Post + populated author into the legacy JSON
// the frontend has been consuming since the SQL days.
async function decoratePosts(posts, viewerId) {
  if (!posts.length) return [];
  const ids = posts.map(p => p._id);

  // One round-trip each for the viewer's likes/bookmarks on this page of posts.
  const [liked, bookmarked] = await Promise.all([
    PostLike.find({ user_id: viewerId, post_id: { $in: ids } }).distinct('post_id'),
    PostBookmark.find({ user_id: viewerId, post_id: { $in: ids } }).distinct('post_id'),
  ]);
  const likedSet = new Set(liked.map(String));
  const bmSet    = new Set(bookmarked.map(String));

  return posts.map(p => {
    const obj = p.toObject();
    const a   = obj.author_id || {};
    return {
      ...obj,
      id              : obj._id.toString(),
      author_id       : a._id ? a._id.toString() : obj.author_id,
      author_name     : a.name,
      author_role     : a.role,
      department      : a.department,
      graduation_year : a.graduation_year,
      liked           : likedSet.has(obj._id.toString()),
      bookmarked      : bmSet.has(obj._id.toString()),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────
// GET /api/posts?tag=&search=&limit=&offset=
// ─────────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { tag, search, limit = 30, offset = 0 } = req.query;
    const safeLimit  = Math.min(Math.max(parseInt(limit,  10) || 30, 1), 100);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const filter = { is_hidden: false };
    if (tag && tag !== 'For you') filter.tag = { $regex: tag, $options: 'i' };
    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [{ title: re }, { body: re }];
    }

    const posts = await Post.find(filter)
      .sort({ created_at: -1 })
      .skip(safeOffset)
      .limit(safeLimit)
      .populate('author_id', 'name role department graduation_year');

    res.json(await decoratePosts(posts, req.user.id));
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
      const { tag, title, body } = req.body;
      if (!tag || !title) return res.status(400).json({ error: 'Tag and title are required' });

      const created = await Post.create({
        author_id : req.user.id,
        tag,
        title,
        body      : body || null,
        image_path: fileUrl(req.file),
      });

      const post = await Post.findById(created._id)
        .populate('author_id', 'name role department graduation_year');

      const [shaped] = await decoratePosts([post], req.user.id);

      // Asking a question -> +5 XP for STUDENT only.
      let xp_earned = null;
      if (req.user.role === 'student') {
        const xp = await xpManager.awardXP(req.user.id, 'Asked a question', 5, 'post', post._id);
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
    const bookmarks = await PostBookmark.find({ user_id: req.user.id }).select('post_id');
    const ids       = bookmarks.map(b => b.post_id);
    if (!ids.length) return res.json([]);

    const posts = await Post.find({ _id: { $in: ids }, is_hidden: false })
      .sort({ created_at: -1 })
      .populate('author_id', 'name role department graduation_year');

    res.json(await decoratePosts(posts, req.user.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch saved posts' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// DELETE /api/posts/:id   - author only
// ─────────────────────────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.author_id.toString() !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await post.deleteOne();
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
    const existing = await PostLike.findOneAndDelete({ user_id: req.user.id, post_id: req.params.id });
    if (existing) {
      await Post.findOneAndUpdate({ _id: req.params.id, likes_count: { $gt: 0 } }, { $inc: { likes_count: -1 } });
      return res.json({ liked: false });
    }
    await PostLike.create({ user_id: req.user.id, post_id: req.params.id });
    await Post.findByIdAndUpdate(req.params.id, { $inc: { likes_count: 1 } });
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
    const existing = await PostBookmark.findOneAndDelete({ user_id: req.user.id, post_id: req.params.id });
    if (existing) {
      await Post.findOneAndUpdate({ _id: req.params.id, bookmarks_count: { $gt: 0 } }, { $inc: { bookmarks_count: -1 } });
      return res.json({ bookmarked: false });
    }
    await PostBookmark.create({ user_id: req.user.id, post_id: req.params.id });
    await Post.findByIdAndUpdate(req.params.id, { $inc: { bookmarks_count: 1 } });
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
    const replies = await Reply.find({ post_id: req.params.id })
      .sort({ created_at: 1 })
      .populate('author_id', 'name role');

    res.json(replies.map(r => {
      const obj = r.toObject();
      const a   = obj.author_id || {};
      return {
        ...obj,
        id          : obj._id.toString(),
        author_id   : a._id ? a._id.toString() : obj.author_id,
        author_name : a.name,
        author_role : a.role,
      };
    }));
  } catch {
    res.status(500).json({ error: 'Failed to fetch replies' });
  }
});

router.post('/:id/replies', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Reply text is required' });

    const created = await Reply.create({
      post_id  : req.params.id,
      author_id: req.user.id,
      text,
    });
    await Post.findByIdAndUpdate(req.params.id, { $inc: { comments_count: 1 } });

    const reply = await Reply.findById(created._id).populate('author_id', 'name role');
    const a     = reply.author_id || {};

    // Answering -> +10 XP for MENTOR only.
    let xp_earned = null;
    if (req.user.role === 'mentor') {
      const xp = await xpManager.awardXP(req.user.id, 'Answered a question', 10, 'reply', reply._id);
      xp_earned = { points: 10, message: 'You answered a question', newTotal: xp.newTotal, newLevel: xp.newLevel, levelUp: xp.levelUp };
    }

    res.status(201).json({
      ...reply.toObject(),
      id          : reply._id.toString(),
      author_id   : a._id ? a._id.toString() : reply.author_id,
      author_name : a.name,
      author_role : a.role,
      ...(xp_earned ? { xp_earned } : {}),
    });
  } catch {
    res.status(500).json({ error: 'Failed to add reply' });
  }
});

module.exports = router;
