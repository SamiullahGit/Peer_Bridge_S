const router = require('express').Router();
const auth   = require('../middleware/auth');
const { supabase } = require('../config/supabase');

// ── GET /api/leaderboard?dept=&role=  — top users by XP ─────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { dept, role } = req.query;
    let q = supabase
      .from('users')
      .select('id, name, profile_image, department, role, total_xp, xp_level, rating, rating_count, sessions_count, followers_count, total_students_helped')
      .eq('is_locked', false)
      .order('total_xp', { ascending: false })
      .limit(50);
    if (dept) q = q.eq('department', dept);
    if (role && ['student', 'mentor'].includes(role)) q = q.eq('role', role);

    const { data, error } = await q;
    if (error) throw error;

    // Rank + the caller's own position (even if outside top 50).
    const rows = (data || []).map((u, i) => ({ ...u, rank: i + 1 }));
    const meInList = rows.find(u => u.id === req.user.id);

    let myRank = meInList?.rank || null;
    if (!myRank) {
      // Count users strictly above me (same filters).
      const { data: meRow } = await supabase
        .from('users').select('total_xp, department, role').eq('id', req.user.id).maybeSingle();
      if (meRow) {
        let cq = supabase.from('users').select('id', { count: 'exact', head: true })
          .eq('is_locked', false).gt('total_xp', meRow.total_xp || 0);
        if (dept) cq = cq.eq('department', dept);
        if (role && ['student', 'mentor'].includes(role)) cq = cq.eq('role', role);
        const { count } = await cq;
        myRank = (count || 0) + 1;
      }
    }

    res.json({ leaders: rows, my_rank: myRank });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

module.exports = router;
