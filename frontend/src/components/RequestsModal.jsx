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
        background: '#fff', width: '100%', maxWidth: 520,
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,.18)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid #E4EAF2',
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0D1B2A' }}>Mentorship Requests</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 22, lineHeight: 1,
            color: '#8899B0', cursor: 'pointer',
          }}>&times;</button>
        </div>

        <div style={{ padding: '14px 18px', maxHeight: '60vh', overflow: 'auto' }}>
          {requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#8899B0', fontSize: 14 }}>
              No pending requests
            </div>
          ) : requests.map(r => (
            <div key={r.id} style={{
              display: 'flex', gap: 12, padding: '12px 4px',
              borderBottom: '1px solid #F1F5F9',
            }}>
              {r.profile_image
                ? <img src={r.profile_image} alt={r.requester_name}
                       style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{
                    width: 42, height: 42, borderRadius: '50%', background: '#EFF3FF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14, color: '#2563EB', flexShrink: 0,
                  }}>{initialsOf(r.requester_name)}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A' }}>{r.requester_name}</div>
                <div style={{ fontSize: 12, color: '#8899B0', marginBottom: 6 }}>
                  {r.department || ''}{r.role ? ` · ${roleLabel(r.role)}` : ''}
                </div>
                {r.message && (
                  <div style={{ fontSize: 13, color: '#4B5C73', marginBottom: 8, lineHeight: 1.5 }}>
                    {r.message}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => onRespond(r.id, 'accepted')}
                    style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700,
                             border: 'none', borderRadius: 8, background: '#2563EB',
                             color: '#fff', cursor: 'pointer' }}
                  >Accept</button>
                  <button
                    onClick={() => onRespond(r.id, 'declined')}
                    style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700,
                             border: '1.5px solid #E4EAF2', borderRadius: 8,
                             background: '#fff', color: '#4B5C73', cursor: 'pointer' }}
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
