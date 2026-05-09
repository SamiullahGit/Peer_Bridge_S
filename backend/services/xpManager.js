const User           = require('../models/User');
const XpTransaction  = require('../models/XpTransaction');
const XpNotification = require('../models/XpNotification');

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
 * @param {string|ObjectId} userId
 * @param {string}  reason   - human-readable reason shown in history
 * @param {number}  points
 * @param {string?} refType  - 'post' | 'reply' | 'rating' | 'message' | 'resource' | ...
 * @param {string?} refId
 * @param {boolean} passive  - true: store an XpNotification for SSE/polling delivery,
 *                             false: caller will return xp_earned directly in the response.
 * @returns {{ newTotal, newLevel, prevLevel, levelUp }}
 */
async function awardXP(userId, reason, points, refType = null, refId = null, passive = false) {
  try {
    await XpTransaction.create({
      user_id : userId,
      points,
      reason,
      ref_type: refType,
      ref_id  : refId,
    });

    const user = await User.findById(userId).select('total_xp xp_level');
    if (!user) return { newTotal: 0, newLevel: 'Bronze', prevLevel: 'Bronze', levelUp: false };

    const prevLevel = user.xp_level || 'Bronze';
    const newTotal  = (user.total_xp || 0) + points;
    const newLevel  = getLevel(newTotal);
    const levelUp   = newLevel !== prevLevel;

    user.total_xp = newTotal;
    user.xp_level = newLevel;
    await user.save();

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
    await XpNotification.create({
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
    const user = await User.findById(userId).select('last_login_xp_date');
    if (!user) return null;

    const today = new Date().toISOString().slice(0, 10);
    const last  = user.last_login_xp_date
      ? new Date(user.last_login_xp_date).toISOString().slice(0, 10)
      : null;
    if (last === today) return null;

    user.last_login_xp_date = new Date(today);
    await user.save();

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
