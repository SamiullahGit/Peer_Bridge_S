import { useEffect, useState } from 'react';

import { pb }        from '../api/client.js';
import Avatar        from './Avatar.jsx';
import VerifiedTick, { isVerified } from './VerifiedTick.jsx';
import { roleLabel } from '../utils/role.js';

// Modal listing a profile's followers or following.
// mode: 'followers' | 'following'
export default function FollowListModal({ userId, mode, onClose, onOpenProfile }) {
  const [list, setList] = useState(null);

  useEffect(() => {
    let live = true;
    pb.get(`/users/${userId}/${mode}`)
      .then((d) => { if (live) setList(d); })
      .catch(() => { if (live) setList([]); });
    return () => { live = false; };
  }, [userId, mode]);

  const title = mode === 'followers' ? 'Followers' : 'Following';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(26,31,58,.25)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{
        width: '100%', maxWidth: 420, maxHeight: '72vh',
        display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{title}</div>
          <button className="chip-btn" onClick={onClose} style={{ padding: 6 }}>X</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '6px 0' }}>
          {list === null ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>Loading…</div>
          ) : list.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
              {mode === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </div>
          ) : list.map((u) => (
            <div
              key={u.id}
              onClick={() => { onOpenProfile(u.id); onClose(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--blue-soft)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Avatar name={u.name} size={42} imgUrl={u.profile_image || ''} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 600 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                  {isVerified(u) && <VerifiedTick size={14} />}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {[roleLabel(u.role), u.department].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
