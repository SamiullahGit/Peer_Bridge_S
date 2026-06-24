const router = require('express').Router();

const auth          = require('../middleware/auth');
const { supabase }  = require('../config/supabase');
const xpManager     = require('../services/xpManager');
const { sendMail }  = require('../services/mailer');
const { PUBLIC_FIELDS, toSafeUser } = require('../data/shapers');

// Make a free-text term safe for a PostgREST ilike / .or() filter.
function likeTerm(s) {
  return String(s).replace(/[%,()]/g, ' ').trim();
}

async function sendEmail(to, subject, text) {
  console.log(`\n[DEV] Email to ${to}: ${subject}\n`);
  await sendMail({ to, subject, text });
}


// GET /api/users/mentors?search=&dept=

router.get('/mentors', auth, async (req, res) => {
  try {
    const { search, dept } = req.query;

    let q = supabase
      .from('users')
      .select(PUBLIC_FIELDS)
      .eq('role', 'mentor')
      .eq('is_under_review', false);

    if (search) {
      const s = likeTerm(search);
      q = q.or(`name.ilike.%${s}%,department.ilike.%${s}%,bio.ilike.%${s}%`);
    }
    if (dept) q = q.eq('department', dept);

    q = q.order('rating', { ascending: false });

    const { data: mentors, error } = await q;
    if (error) throw error;
    res.json(mentors || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch mentors' });
  }
});

// IDs of mentors the current user has already requested.
router.get('/my-requests', auth, async (req, res) => {
  try {
    const { data } = await supabase
      .from('mentorship_requests').select('mentor_id').eq('requester_id', req.user.id);
    res.json((data || []).map(r => r.mentor_id));
  } catch {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Pending requests for the logged-in mentor.
router.get('/incoming-requests', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('mentorship_requests')
      .select('id, message, status, created_at, requester:requester_id(id,name,department,role,profile_image)')
      .eq('mentor_id', req.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.json((data || []).map(r => ({
      id            : r.id,
      message       : r.message,
      status        : r.status,
      created_at    : r.created_at,
      requester_id  : r.requester?.id,
      requester_name: r.requester?.name,
      department    : r.requester?.department,
      role          : r.requester?.role,
      profile_image : r.requester?.profile_image,
    })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch incoming requests' });
  }
});

// Accept or decline a request.
router.patch('/mentorship-requests/:id', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status))
      return res.status(400).json({ error: 'Status must be accepted or declined' });

    const { data: reqDoc } = await supabase
      .from('mentorship_requests')
      .update({ status })
      .eq('id', req.params.id)
      .eq('mentor_id', req.user.id)
      .select()
      .maybeSingle();
    if (!reqDoc) return res.status(404).json({ error: 'Request not found' });

    if (status === 'accepted') {
      const xp = await xpManager.awardXP(req.user.id, 'Accepted a mentorship request', 30, 'mentorship', reqDoc.id);
      supabase.rpc('adjust_counter', { p_table: 'users', p_id: req.user.id, p_column: 'total_students_helped', p_delta: 1 }).then(() => {}, () => {});
      return res.json({
        message  : `Request ${status}`,
        xp_earned: { points: 30, message: 'Mentorship goal completed!', newTotal: xp.newTotal, newLevel: xp.newLevel, levelUp: xp.levelUp },
      });
    }
    res.json({ message: `Request ${status}` });
  } catch {
    res.status(500).json({ error: 'Failed to update request' });
  }
});

// Current user (basic fields only - /api/auth/me returns the full doc).
router.get('/me', auth, async (req, res) => {
  const { data: user } = await supabase
    .from('users').select(PUBLIC_FIELDS).eq('id', req.user.id).maybeSingle();
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

// Update current user's profile.
router.put('/me', auth, async (req, res) => {
  try {
    const { name, department, graduation_year, bio, role } = req.body;
    const update = {};
    if (name             !== undefined) update.name             = name;
    if (department       !== undefined) update.department       = department;
    if (graduation_year  !== undefined) {
      const gy = parseInt(graduation_year, 10);
      update.graduation_year = Number.isNaN(gy) ? null : gy;
    }
    if (bio              !== undefined) update.bio              = bio;
    if (role && ['student', 'mentor'].includes(role)) update.role = role;

    if (Object.keys(update).length === 0) {
      const { data: user } = await supabase
        .from('users').select(PUBLIC_FIELDS).eq('id', req.user.id).maybeSingle();
      return res.json(user);
    }

    const { data: user } = await supabase
      .from('users').update(update).eq('id', req.user.id).select(PUBLIC_FIELDS).maybeSingle();
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.delete('/me', auth, async (req, res) => {
  try {
    await supabase.from('users').delete().eq('id', req.user.id);
    res.json({ message: 'Account deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/users/:id    user + their last 10 posts
// ─────────────────────────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    // Fetch the user, their last 10 posts, and whether the viewer follows
    // them - all in parallel. The non-user results are discarded on 404.
    const [{ data: user }, { data: posts }, { data: followRow }] = await Promise.all([
      supabase.from('users').select(PUBLIC_FIELDS).eq('id', req.params.id).maybeSingle(),
      supabase.from('posts')
        .select('id, tag, title, body, likes_count, comments_count, bookmarks_count, is_hidden, created_at')
        .eq('author_id', req.params.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('follows')
        .select('id')
        .eq('follower_id', req.user.id).eq('following_id', req.params.id)
        .maybeSingle(),
    ]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ ...user, is_following: !!followRow, posts: posts || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/users/:id/rate    { score, comment? }
// ─────────────────────────────────────────────────────────────────────
router.post('/:id/rate', auth, async (req, res) => {
  try {
    const { score, comment } = req.body;
    if (!score || score < 1 || score > 5) return res.status(400).json({ error: 'Score must be 1-5' });
    if (req.params.id === req.user.id)    return res.status(400).json({ error: 'Cannot rate yourself' });

    await supabase.from('ratings').upsert(
      { rater_id: req.user.id, mentor_id: req.params.id, score, comment: comment || null },
      { onConflict: 'rater_id,mentor_id' },
    );

    // Recalculate average rating (tiny N -> compute in JS for identical numbers).
    const { data: scores } = await supabase
      .from('ratings').select('score').eq('mentor_id', req.params.id);
    const cnt = (scores || []).length;
    const avg = cnt ? scores.reduce((a, r) => a + r.score, 0) / cnt : 0;

    await supabase.from('users').update({ rating: avg, rating_count: cnt }).eq('id', req.params.id);

    // Auto under-review: rating < 2.0 AND >= 5 reviews -> flag; improves -> unflag.
    if (avg < 2.0 && cnt >= 5) {
      const { data: mentor } = await supabase
        .from('users').select('email, is_under_review').eq('id', req.params.id).maybeSingle();
      if (mentor && !mentor.is_under_review) {
        await supabase.from('users').update({ is_under_review: true }).eq('id', req.params.id);
        await sendEmail(
          mentor.email,
          'Your Peer Bridge mentor profile is under review',
          'Your mentor profile is under review due to low ratings. It will be restored once your rating improves.',
        );
      }
    } else if (avg >= 2.0) {
      await supabase.from('users').update({ is_under_review: false }).eq('id', req.params.id);
    }

    // Passive XP for the mentor being rated - delivered via /xp/pending poll.
    const xpForRating = score >= 5 ? 25 : score >= 4 ? 10 : score >= 3 ? 5 : 0;
    const starEmoji   = score >= 5 ? ' 5-star' : score >= 4 ? ' 4-star' : '';
    if (xpForRating > 0) {
      xpManager.awardXP(req.params.id, `${score}-star rating received${starEmoji}`, xpForRating, 'rating', req.user.id, true).catch(() => {});
    }

    // Active +5 XP for the rater (students only).
    let xp_earned = null;
    if (req.user.role === 'student') {
      const xp = await xpManager.awardXP(req.user.id, 'Rated a mentor', 5, 'rating', req.params.id);
      xp_earned = { points: 5, message: 'Thanks for rating a mentor', newTotal: xp.newTotal, newLevel: xp.newLevel, levelUp: xp.levelUp };
    }
    res.json({ message: 'Rating saved', rating: avg.toFixed(2), ...(xp_earned ? { xp_earned } : {}) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/users/promote-to-mentor
// Student with >= 300 XP can flip role -> mentor (XP carries over).
// ─────────────────────────────────────────────────────────────────────
router.post('/promote-to-mentor', auth, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users').select('*').eq('id', req.user.id).maybeSingle();
    if (!user)                       return res.status(404).json({ error: 'User not found' });
    if (user.role === 'mentor')      return res.status(400).json({ error: 'You are already a mentor.' });
    if (user.role !== 'student')     return res.status(403).json({ error: 'Only student accounts can be promoted to mentor.' });
    if ((user.total_xp || 0) < 300)  return res.status(403).json({ error: 'You need at least 300 XP (Silver level) before becoming a mentor.' });

    const { data: updated } = await supabase
      .from('users').update({ role: 'mentor' }).eq('id', req.user.id).select('*').maybeSingle();

    res.json({ message: 'Welcome to the mentor community!', user: toSafeUser(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to promote to mentor' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/users/:id/request-mentorship   { message? }
// ─────────────────────────────────────────────────────────────────────
router.post('/:id/request-mentorship', auth, async (req, res) => {
  try {
    await supabase.from('mentorship_requests').insert({
      requester_id: req.user.id,
      mentor_id   : req.params.id,
      message     : req.body.message || null,
    });
    res.json({ message: 'Request sent' });
  } catch {
    res.status(500).json({ error: 'Failed to send request' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// POST /api/users/:id/follow   (toggle follow/unfollow)
// Keeps the denormalized followers_count / following_count in sync.
// ─────────────────────────────────────────────────────────────────────
router.post('/:id/follow', auth, async (req, res) => {
  try {
    const me     = req.user.id;
    const target = req.params.id;
    if (me === target) return res.status(400).json({ error: 'You cannot follow yourself' });

    const { data: removed } = await supabase
      .from('follows').delete()
      .eq('follower_id', me).eq('following_id', target)
      .select();

    if (removed && removed.length) {
      await Promise.all([
        supabase.rpc('adjust_counter', { p_table: 'users', p_id: target, p_column: 'followers_count', p_delta: -1 }),
        supabase.rpc('adjust_counter', { p_table: 'users', p_id: me,     p_column: 'following_count', p_delta: -1 }),
      ]);
      return res.json({ following: false });
    }

    const { error } = await supabase.from('follows').insert({ follower_id: me, following_id: target });
    if (error) throw error;
    await Promise.all([
      supabase.rpc('adjust_counter', { p_table: 'users', p_id: target, p_column: 'followers_count', p_delta: 1 }),
      supabase.rpc('adjust_counter', { p_table: 'users', p_id: me,     p_column: 'following_count', p_delta: 1 }),
    ]);
    res.json({ following: true });
  } catch {
    res.status(500).json({ error: 'Failed to update follow' });
  }
});

// People who follow :id
router.get('/:id/followers', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('created_at, u:follower_id(id,name,role,department,profile_image,followers_count)')
      .eq('following_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json((data || []).map(r => r.u).filter(Boolean));
  } catch {
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// People :id follows
router.get('/:id/following', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('follows')
      .select('created_at, u:following_id(id,name,role,department,profile_image,followers_count)')
      .eq('follower_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    res.json((data || []).map(r => r.u).filter(Boolean));
  } catch {
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

module.exports = router;
