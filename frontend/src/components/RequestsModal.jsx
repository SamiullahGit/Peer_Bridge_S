import { initialsOf }  from '../utils/avatar.js';
import { roleLabel }   from '../utils/role.js';

// Mentor's incoming-mentorship-requests modal. Triggered from the
// "Requests" item in the sidebar.

export default function RequestsModal({ requests, onRespond, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)', padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--card)', width: '100%', maxWidth: 520,
        borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)',
        boxShadow: 'var(--shadow-lg)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid var(--line)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>Mentorship Requests</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 22, lineHeight: 1,
            color: 'var(--ink-3)', cursor: 'pointer',
          }}>&times;</button>
        </div>

        <div style={{ padding: '14px 18px', maxHeight: '60vh', overflow: 'auto' }}>
          {requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)', fontSize: 14 }}>
              No pending requests
            </div>
          ) : requests.map(r => (
            <div key={r.id} style={{
              display: 'flex', gap: 12, padding: '12px 4px',
              borderBottom: '1px solid var(--line)',
            }}>
              {r.profile_image
                ? <img src={r.profile_image} alt={r.requester_name}
                       style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{
                    width: 42, height: 42, borderRadius: '50%', background: 'var(--blue-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14, color: 'var(--blue)', flexShrink: 0,
                  }}>{initialsOf(r.requester_name)}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{r.requester_name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>
                  {r.department || ''}{r.role ? ` · ${roleLabel(r.role)}` : ''}
                </div>
                {r.message && (
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 8, lineHeight: 1.5 }}>
                    {r.message}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => onRespond(r.id, 'accepted')}
                    style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700,
                             border: 'none', borderRadius: 8, background: 'var(--blue)',
                             color: '#fff', cursor: 'pointer' }}
                  >Accept</button>
                  <button
                    onClick={() => onRespond(r.id, 'declined')}
                    style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700,
                             border: '1.5px solid var(--line)', borderRadius: 8,
                             background: 'var(--card)', color: 'var(--ink-2)', cursor: 'pointer' }}
                  >Decline</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
