const { supabase } = require('../config/supabase');

const LEVELS = [
  { name: 'Bronze',   min: 0    },
  { name: 'Silver',   min: 300  },
  { name: 'Gold',     min: 700  },
  { name: 'Platinum', min: 1200 },
  { name: 'Legend',   min: 2000 },
];

function getLevel(xp) {
  let level = LEVELS[0].name;
  for (const l of LEVELS) { if (xp >= l.min) level = l.name; }
  return level;
}

/**
 * Award XP to a user.
 *
 * @param {string}  userId   - user uuid
 * @param {string}  reason   - human-readable reason shown in history
 * @param {number}  points
 * @param {string?} refType  - 'post' | 'reply' | 'rating' | 'message' | 'resource' | ...
 * @param {string?} refId    - related row uuid (or null)
 * @param {boolean} passive  - true: store an XpNotification for polling delivery,
 *                             false: caller will return xp_earned directly in the response.
 * @returns {{ newTotal, newLevel, prevLevel, levelUp }}
 */
async function awardXP(userId, reason, points, refType = null, refId = null, passive = false) {
  try {
    await supabase.from('xp_transactions').insert({
      user_id : userId,
      points,
      reason,
      ref_type: refType,
      ref_id  : refId,
    });

    const { data: user } = await supabase
      .from('users')
      .select('total_xp, xp_level')
      .eq('id', userId)
      .maybeSingle();
    if (!user) return { newTotal: 0, newLevel: 'Bronze', prevLevel: 'Bronze', levelUp: false };

    const prevLevel = user.xp_level || 'Bronze';
    const newTotal  = (user.total_xp || 0) + points;
    const newLevel  = getLevel(newTotal);
    const levelUp   = newLevel !== prevLevel;

    await supabase
      .from('users')
      .update({ total_xp: newTotal, xp_level: newLevel })
      .eq('id', userId);

    // Passive XP -> recipient is not the request-maker, so deliver via polling.
    if (passive) {
      await _storeNotification(userId, points, reason, false, null);
      if (levelUp) {
        await _storeNotification(userId, 0, `You reached ${newLevel} level!`, true, newLevel);
      }
    }

    return { newTotal, newLevel, prevLevel, levelUp };
  } catch (err) {
    console.error('[xpManager] awardXP error:', err.message);
    return { newTotal: 0, newLevel: 'Bronze', prevLevel: 'Bronze', levelUp: false };
  }
}

async function _storeNotification(userId, points, message, isLevelUp, newLevel) {
  try {
    await supabase.from('xp_notifications').insert({
      user_id    : userId,
      points,
      message,
      is_level_up: !!isLevelUp,
      new_level  : newLevel || null,
    });
  } catch (err) {
    console.error('[xpManager] _storeNotification error:', err.message);
  }
}

// Awards a one-time daily-login bonus (+2 XP) and returns xp_earned info,
// or null if the user already received it today.
async function awardDailyLogin(userId) {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('last_login_xp_date')
      .eq('id', userId)
      .maybeSingle();
    if (!user) return null;

    const today = new Date().toISOString().slice(0, 10);
    const last  = user.last_login_xp_date
      ? new Date(user.last_login_xp_date).toISOString().slice(0, 10)
      : null;
    if (last === today) return null;

    await supabase
      .from('users')
      .update({ last_login_xp_date: new Date(today).toISOString() })
      .eq('id', userId);

    const xp = await awardXP(userId, 'Daily login bonus', 2, 'login', null);
    return {
      points  : 2,
      message : 'Daily login bonus',
      newTotal: xp.newTotal,
      newLevel: xp.newLevel,
      levelUp : xp.levelUp,
    };
  } catch (err) {
    console.error('[xpManager] awardDailyLogin error:', err.message);
    return null;
  }
}

module.exports = { awardXP, awardDailyLogin, getLevel, LEVELS };
