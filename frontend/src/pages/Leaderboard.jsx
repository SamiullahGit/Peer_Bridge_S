import { useEffect, useState } from 'react';
import { useNavigate }          from 'react-router-dom';

import Sidebar      from '../components/Sidebar.jsx';
import Avatar       from '../components/Avatar.jsx';
import ToastHost, { toast } from '../components/Toast.jsx';
import { pb }       from '../api/client.js';
import { useAuth }  from '../context/AuthContext.jsx';
import { badgesFor } from '../utils/badges.js';

const DEPTS = ['', 'SEECS', 'NBS', 'SMME', 'CEME', 'SCME', 'S3H', 'ASAB', 'CAE'];
const ROLES = [['', 'Everyone'], ['student', 'Students'], ['mentor', 'Mentors']];

export default function Leaderboard() {
  const { user: me } = useAuth();
  const navigate     = useNavigate();
  const [leaders, setLeaders] = useState([]);
  const [myRank, setMyRank]   = useState(null);
  const [dept, setDept]       = useState('');
  const [role, setRole]       = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [dept, role]);

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (dept) q.set('dept', dept);
      if (role) q.set('role', role);
      const r = await pb.get('/leaderboard?' + q);
      setLeaders(r.leaders || []);
      setMyRank(r.my_rank || null);
    } catch { toast('Failed to load leaderboard'); }
    finally { setLoading(false); }
  }

  const medal = (rank) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  return (
    <Sidebar active="leaderboard">
      <ToastHost />
      <div className="page-shell">
        <section className="page-hero" style={{ marginBottom: 22 }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="tag tag-peach" style={{ marginBottom: 12 }}>🏆 Community</div>
            <h1 className="section-title">Leaderboard</h1>
            <p className="section-subtitle">Top contributors ranked by XP. Earn XP by asking, answering, and mentoring.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', borderRadius: 9, padding: 3 }}>
                {ROLES.map(([k, label]) => (
                  <button key={k} onClick={() => setRole(k)} style={{
                    padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
                    background: role === k ? 'var(--card)' : 'transparent',
                    color: role === k ? 'var(--ink)' : 'var(--ink-3)',
                    boxShadow: role === k ? 'var(--shadow-sm)' : 'none',
                  }}>{label}</button>
                ))}
              </div>
              <select className="input" style={{ width: 'auto', minWidth: 160 }}
                      value={dept} onChange={(e) => setDept(e.target.value)}>
                {DEPTS.map((d) => <option key={d} value={d}>{d || 'All departments'}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* My rank */}
        {myRank && (
          <div className="card" style={{ padding: '14px 20px', marginBottom: 18, display: 'flex',
                                         alignItems: 'center', gap: 14, border: '1.5px solid var(--blue-mid)' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--blue)', minWidth: 44 }}>#{myRank}</div>
            <Avatar name={me?.name} size={40} imgUrl={me?.profile_image || ''} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{me?.name} <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>(you)</span></div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Keep contributing to climb the ranks!</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold-ink)' }}>{me?.total_xp || 0} XP</div>
          </div>
        )}

        <div className="card" style={{ padding: 8 }}>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-3)' }}>Loading…</div>
          ) : leaders.length === 0 ? (
            <div className="empty-state"><p>No one here yet.</p></div>
          ) : leaders.map((u) => {
            const badges = badgesFor(u).slice(0, 3);
            const isMe = u.id === me?.id;
            return (
              <div key={u.id} onClick={() => navigate(`/profile?id=${u.id}`)}
                   className="fade-up"
                   style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 14px',
                            borderRadius: 12, cursor: 'pointer',
                            background: isMe ? 'var(--blue-soft)' : 'transparent',
                            borderBottom: '1px solid var(--line)' }}>
                <div style={{ minWidth: 34, textAlign: 'center', fontSize: u.rank <= 3 ? 22 : 15,
                              fontWeight: 800, color: u.rank <= 3 ? 'inherit' : 'var(--ink-3)' }}>
                  {medal(u.rank) || u.rank}
                </div>
                <Avatar name={u.name} size={42} imgUrl={u.profile_image || ''} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14 }}>{u.name}</strong>
                    {badges.map((b) => (
                      <span key={b.key} title={b.label} style={{ fontSize: 13 }}>{b.emoji}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    {u.department || 'NUST'} · {u.xp_level || 'Bronze'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold-ink)' }}>{u.total_xp || 0}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 600 }}>XP</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Sidebar>
  );
}
