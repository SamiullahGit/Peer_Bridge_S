// Derive achievement badges from a user's public fields. Pure/computed —
// no schema needed. Returns an array of { key, label, emoji, color }.

export function badgesFor(u = {}) {
  const out = [];
  const xp = u.total_xp || 0;
  const level = (u.xp_level || '').toLowerCase();

  // XP level badge
  if (level === 'platinum' || xp >= 1000) out.push({ key: 'platinum', label: 'Platinum', emoji: '💎', color: '#06b6d4' });
  else if (level === 'gold' || xp >= 500) out.push({ key: 'gold', label: 'Gold', emoji: '🥇', color: '#d97706' });
  else if (level === 'silver' || xp >= 200) out.push({ key: 'silver', label: 'Silver', emoji: '🥈', color: '#64748b' });
  else if (xp > 0) out.push({ key: 'bronze', label: 'Bronze', emoji: '🥉', color: '#b45309' });

  if (u.role === 'mentor') out.push({ key: 'mentor', label: 'Mentor', emoji: '🎓', color: '#2563eb' });
  if ((u.followers_count || 0) >= 100) out.push({ key: 'verified', label: 'Verified', emoji: '✅', color: '#16a34a' });
  if ((u.followers_count || 0) >= 50)  out.push({ key: 'popular', label: 'Popular', emoji: '🔥', color: '#dc2626' });
  if ((u.sessions_count || u.total_students_helped || 0) >= 25) out.push({ key: 'helper', label: 'Top Helper', emoji: '🤝', color: '#7c3aed' });
  if ((u.rating || 0) >= 4.5 && (u.rating_count || 0) >= 10) out.push({ key: 'star', label: 'Star Mentor', emoji: '⭐', color: '#f59e0b' });

  return out;
}
