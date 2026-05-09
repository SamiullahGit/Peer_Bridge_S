import { useEffect, useState } from 'react';

import { pb }       from '../api/client.js';
import { useAuth }  from '../context/AuthContext.jsx';
import { toast }    from './Toast.jsx';
import { timeAgo }  from '../utils/time.js';

import CertificateModal from './CertificateModal.jsx';

// XP dashboard rendered on the user's own /profile page.
//   - shows current level, progress, history
//   - student >= 300 XP -> "Become a mentor" prompt
//   - mentor  >= 500 XP -> "Download certificate" CTA

const PROMOTE_THRESHOLD = 300;

export default function XpSection() {
  const { setAuth, token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [showCert, setShowCert] = useState(false);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    try { setStats(await pb.get('/certificates/xp-stats')); }
    catch { setError('Failed to load XP stats.'); }
  }

  if (error) return <p style={{ color: '#ef4444', fontSize: 13, padding: '8px 0' }}>{error}</p>;
  if (!stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 8px' }}>
        <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2, display: 'inline-block' }} />
        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Loading XP stats…</span>
      </div>
    );
  }

  const isMentor   = stats.isMentor;
  const canGen     = isMentor && stats.canGenerate && !stats.cooldownEnd;
  const locked     = isMentor && !stats.canGenerate;
  const cooldown   = isMentor && stats.canGenerate && !!stats.cooldownEnd;
  const showPromo  = !isMentor && stats.xp >= PROMOTE_THRESHOLD;
  const barW       = Math.min(stats.progress, 100);

  async function promoteToMentor() {
    if (!confirm('Become a mentor?\n\n' +
                 '- You will start receiving mentorship requests from other students.\n' +
                 '- You will earn higher XP for answering questions and uploading resources.\n' +
                 '- You will be able to generate the Verified Mentor Certificate at 500 XP.\n\nContinue?')) return;
    try {
      const data = await pb.post('/users/promote-to-mentor', {});
      if (data.user) setAuth(token, { ...user, ...data.user });
      toast('Welcome to the mentor community!');
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      toast(err.message || 'Failed to promote to mentor');
    }
  }

  async function testAddXP() {
    try {
      const data = await pb.post('/certificates/test-add-xp', {});
      toast(`+100 XP - now ${data.total_xp} XP (${data.xp_level})`);
      loadStats();
    } catch (err) {
      toast('Failed: ' + (err.message || 'unknown error'));
    }
  }

  // Dev-only: regenerate the certificate ignoring the 24h cooldown so we
  // can iterate on the PDF design. Opens the new file in a new tab.
  // Remove this handler + the button below before shipping.
  async function testRegenerate() {
    try {
      const data = await pb.post('/certificates/test-regenerate', {});
      toast(`Regenerated: ${data.certNumber}`);
      window.open(data.downloadUrl, '_blank');
      loadStats();
    } catch (err) {
      toast('Failed: ' + (err.message || 'unknown error'));
    }
  }

  return (
    <>
      <div className="xp-header">
        <h3>XP &amp; Mentor Level</h3>
        <span className={`xp-level-badge ${stats.level}`}>{stats.level}</span>
      </div>

      <div className="xp-points">
        {stats.xp}{' '}
        <span>
          / {stats.nextLevelMin || stats.currentLevelMin} XP
          {stats.nextLevel ? ` to ${stats.nextLevel}` : ' — Max Level'}
        </span>
      </div>

      <div className="xp-bar-wrap"><div className="xp-bar-fill" style={{ width: `${barW}%` }} /></div>
      <div className="xp-bar-label">{barW}% toward {stats.nextLevel || 'Legend'}</div>

      <div className="xp-stats-grid">
        <div className="xp-stat-card">
          <div className="value">{stats.total_students_helped}</div>
          <div className="label">Students Helped</div>
        </div>
        <div className="xp-stat-card">
          <div className="value">{stats.resources_count}</div>
          <div className="label">Resources Shared</div>
        </div>
        <div className="xp-stat-card">
          <div className="value">{stats.rating ? Number(stats.rating).toFixed(1) : '—'}</div>
          <div className="label">Mentor Rating</div>
        </div>
      </div>

      {stats.history?.length > 0 && (
        <>
          <div className="xp-history-title">Recent XP Activity</div>
          <table className="xp-history-table">
            <thead><tr><th>XP</th><th>Action</th><th>When</th></tr></thead>
            <tbody>
              {stats.history.map((h, i) => (
                <tr key={i}>
                  <td className="pts">+{h.points}</td>
                  <td>{h.reason}</td>
                  <td style={{ color: '#9ca3af' }}>{timeAgo(h.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        {isMentor && (
          <button
            className={`cert-btn ${canGen ? 'cert-btn-primary' : 'cert-btn-disabled'}`}
            onClick={() => canGen && setShowCert(true)} disabled={!canGen}
          >Download Certificate</button>
        )}
        <button onClick={testAddXP} style={{
          padding: '8px 14px', borderRadius: 8, border: '1.5px dashed #d1d5db',
          background: '#f9fafb', color: '#6b7280', fontSize: 12, fontWeight: 600,
          fontFamily: 'inherit', cursor: 'pointer',
        }}>+100 XP (test)</button>
        {/* DEV ONLY - bypasses the 24h cooldown so we can preview design
            tweaks. Remove with the matching backend route before shipping. */}
        {isMentor && (
          <button onClick={testRegenerate} style={{
            padding: '8px 14px', borderRadius: 8, border: '1.5px dashed #fcd34d',
            background: '#fffbeb', color: '#92400e', fontSize: 12, fontWeight: 600,
            fontFamily: 'inherit', cursor: 'pointer',
          }}>Regenerate cert (test)</button>
        )}
      </div>

      {showPromo && (
        <div style={{
          marginTop: 16, padding: '20px 22px', borderRadius: 14,
          background: 'linear-gradient(135deg,#1a2744 0%,#304d72 100%)',
          color: '#fff', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
          boxShadow: '0 6px 20px rgba(26,39,68,.18)',
        }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>You're ready to mentor others</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.78)', lineHeight: 1.5 }}>
              You've earned <strong style={{ color: '#fff' }}>{stats.xp} XP</strong> - that crosses the
              {' '}<strong style={{ color: '#fff' }}>{PROMOTE_THRESHOLD} XP</strong> threshold for becoming a mentor.
              Mentors receive mentorship requests from juniors, can answer questions for XP, and unlock
              the Verified Mentor Certificate at 500 XP.
            </div>
          </div>
          <button onClick={promoteToMentor} style={{
            flexShrink: 0, padding: '10px 20px', borderRadius: 10, border: 'none',
            background: '#C5A028', color: '#1a2744',
            fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(197,160,40,.35)',
          }}>Become a Mentor -&gt;</button>
        </div>
      )}

      {!isMentor && !showPromo && (
        <div className="xp-locked-msg">
          Earn <strong>{PROMOTE_THRESHOLD - stats.xp} more XP</strong> to unlock the option to become a mentor.
        </div>
      )}

      {locked && (
        <div className="xp-locked-msg">
          Earn <strong>{500 - stats.xp} more XP</strong> to unlock your certificate.
        </div>
      )}

      {cooldown && (
        <div className="xp-cooldown-msg">
          Certificate already generated today. Available again at{' '}
          <strong>{new Date(stats.cooldownEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>.
        </div>
      )}

      {showCert && (
        <CertificateModal
          stats={stats}
          onClose={() => setShowCert(false)}
          onGenerated={loadStats}
        />
      )}
    </>
  );
}
