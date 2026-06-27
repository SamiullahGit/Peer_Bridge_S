import { useState } from 'react';

import { pb }    from '../api/client.js';
import { toast } from './Toast.jsx';

const REASONS = ['Spam', 'Harassment', 'Inappropriate', 'Misinformation'];

// Generic report modal. Used for reporting posts (Feed) and users (Profile).

export default function ReportModal({ targetType, targetId, onClose }) {
  const [reason, setReason]   = useState(REASONS[0]);
  const [busy, setBusy]       = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await pb.post('/reports', { target_type: targetType, target_id: targetId, reason });
      toast('Report submitted. Thank you for keeping Peer Bridge safe.');
      onClose();
    } catch (e) {
      toast(e.message || 'Failed to submit report');
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 420 }}>
        <div style={{
          padding: '18px 22px', borderBottom: '1.5px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>Report content</div>
          <button className="modal-close-btn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l10 10M12 2 2 12" />
            </svg>
          </button>
        </div>
        <div style={{ padding: 22 }}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 16 }}>Why are you reporting this?</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {REASONS.map((r) => {
              const active = r === reason;
              return (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  style={{
                    flex: 1, padding: '9px 6px', borderRadius: 9,
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                    background: active ? 'var(--ink)' : 'transparent',
                    color    : active ? 'white' : 'var(--ink-2)',
                  }}
                >{r}</button>
              );
            })}
          </div>
          <button onClick={submit} disabled={busy} style={{
            width: '100%', padding: 12, border: 'none', borderRadius: 10,
            background: 'var(--blue)', color: 'white', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
          }}>{busy ? 'Submitting…' : 'Submit'}</button>
        </div>
      </div>
    </div>
  );
}
