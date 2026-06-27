import { useEffect, useState } from 'react';
import { useNavigate }          from 'react-router-dom';

import Sidebar      from '../components/Sidebar.jsx';
import Avatar       from '../components/Avatar.jsx';
import ToastHost, { toast } from '../components/Toast.jsx';
import { pb }       from '../api/client.js';
import { useAuth }  from '../context/AuthContext.jsx';

export default function Admin() {
  const { user: me } = useAuth();
  const navigate     = useNavigate();
  const [tab, setTab]       = useState('reports');
  const [stats, setStats]   = useState(null);
  const [reports, setReports] = useState([]);
  const [pending, setPending] = useState([]);

  const isAdmin = me?.role === 'admin';

  useEffect(() => { if (isAdmin) loadAll(); /* eslint-disable-next-line */ }, [isAdmin]);

  async function loadAll() {
    try {
      const [s, r, p] = await Promise.all([
        pb.get('/admin/stats'), pb.get('/admin/reports'), pb.get('/admin/pending-mentors'),
      ]);
      setStats(s); setReports(r); setPending(p);
    } catch (e) { toast(e.message || 'Failed to load'); }
  }

  async function hidePost(id, hidden)   { try { await pb.post(`/admin/posts/${id}/hide`, { hidden }); toast(hidden ? 'Post hidden' : 'Post restored'); loadAll(); } catch (e) { toast(e.message); } }
  async function lockUser(id, locked)   { try { await pb.post(`/admin/users/${id}/lock`, { locked }); toast(locked ? 'User locked' : 'User unlocked'); loadAll(); } catch (e) { toast(e.message); } }
  async function dismiss(type, id)      { try { await pb.post(`/admin/reports/${type}/${id}/dismiss`, {}); toast('Reports dismissed'); loadAll(); } catch (e) { toast(e.message); } }
  async function reviewMentor(id, approve) { try { await pb.post(`/admin/mentors/${id}/review`, { approve }); toast(approve ? 'Mentor approved' : 'Mentor rejected'); loadAll(); } catch (e) { toast(e.message); } }

  if (!isAdmin) {
    return (
      <Sidebar active="admin">
        <ToastHost />
        <div className="page-shell">
          <div className="empty-state" style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>Admins only</h2>
            <p>You don't have permission to view this page.</p>
          </div>
        </div>
      </Sidebar>
    );
  }

  const STAT_CARDS = stats ? [
    ['Users', stats.users, 'var(--blue)'],
    ['Mentors', stats.mentors, 'var(--mint-ink)'],
    ['Posts', stats.posts, 'var(--ink)'],
    ['Hidden posts', stats.hidden, 'var(--gold-ink)'],
    ['Reports', stats.reports, 'var(--blush-ink)'],
    ['Pending mentors', stats.pending_mentors, '#7C3AED'],
    ['Locked users', stats.locked, 'var(--blush-ink)'],
  ] : [];

  return (
    <Sidebar active="admin">
      <ToastHost />
      <div className="page-shell">
        <section className="page-hero" style={{ marginBottom: 22 }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="tag tag-blush" style={{ marginBottom: 12 }}>🛡️ Moderation</div>
            <h1 className="section-title">Admin dashboard</h1>
            <p className="section-subtitle">Review reports, moderate content, and approve mentors.</p>
          </div>
        </section>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 22 }}>
          {STAT_CARDS.map(([label, value, color]) => (
            <div key={label} className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', borderRadius: 9, padding: 3, marginBottom: 18, width: 'fit-content' }}>
          {[['reports', `Reports (${reports.length})`], ['mentors', `Pending mentors (${pending.length})`]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: '8px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              background: tab === k ? 'var(--card)' : 'transparent',
              color: tab === k ? 'var(--ink)' : 'var(--ink-3)',
              boxShadow: tab === k ? 'var(--shadow-sm)' : 'none',
            }}>{label}</button>
          ))}
        </div>

        {tab === 'reports' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.length === 0 ? (
              <div className="empty-state"><p>No reports. The community is behaving 🎉</p></div>
            ) : reports.map((g) => (
              <div key={`${g.target_type}-${g.target_id}`} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em',
                                     padding: '2px 8px', borderRadius: 999, background: 'var(--blush)', color: 'var(--blush-ink)' }}>
                        {g.count} report{g.count === 1 ? '' : 's'}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{g.target_type}</span>
                    </div>
                    {g.target_type === 'post' ? (
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                        {g.detail?.title || '(deleted post)'}
                        {g.detail?.is_hidden && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--gold-ink)' }}>● hidden</span>}
                        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 500 }}>by {g.detail?.author?.name || 'unknown'}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }}
                           onClick={() => g.detail && navigate(`/profile?id=${g.target_id}`)}>
                        {g.detail?.name || '(deleted user)'}
                        {g.detail?.is_locked && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--blush-ink)' }}>● locked</span>}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 5 }}>
                      {Object.entries(g.reasons).map(([r, c]) => `${r} ×${c}`).join('  ·  ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {g.target_type === 'post' && g.detail && (
                      g.detail.is_hidden
                        ? <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '8px 12px' }} onClick={() => hidePost(g.target_id, false)}>Restore</button>
                        : <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '8px 12px', color: 'var(--gold-ink)' }} onClick={() => hidePost(g.target_id, true)}>Hide post</button>
                    )}
                    {g.target_type === 'user' && g.detail && (
                      g.detail.is_locked
                        ? <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '8px 12px' }} onClick={() => lockUser(g.target_id, false)}>Unlock</button>
                        : <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '8px 12px', color: 'var(--blush-ink)' }} onClick={() => lockUser(g.target_id, true)}>Lock user</button>
                    )}
                    <button className="btn btn-ghost" style={{ fontSize: 12.5, padding: '8px 12px' }} onClick={() => dismiss(g.target_type, g.target_id)}>Dismiss</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.length === 0 ? (
              <div className="empty-state"><p>No mentors awaiting review.</p></div>
            ) : pending.map((m) => (
              <div key={m.id} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <Avatar name={m.name} size={48} imgUrl={m.profile_image || ''} />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => navigate(`/profile?id=${m.id}`)}>{m.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{m.department || 'NUST'}</div>
                  {m.bio && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3 }}>{m.bio}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ fontSize: 13, padding: '9px 16px' }} onClick={() => reviewMentor(m.id, true)}>Approve</button>
                  <button className="btn btn-ghost" style={{ fontSize: 13, padding: '9px 16px', color: 'var(--blush-ink)' }} onClick={() => reviewMentor(m.id, false)}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sidebar>
  );
}
