import { useEffect, useRef, useState } from 'react';
import { useNavigate }                  from 'react-router-dom';

import { pb }            from '../api/client.js';
import { useAuth }       from '../context/AuthContext.jsx';
import { initialsOf }    from '../utils/avatar.js';
import { toast }         from './Toast.jsx';

// Slide-out chat overlay used from the Feed page (and the right panel).
// Polls the active conversation every 4 s while open.

export default function ChatOverlay({ peerId, peerName, onClose }) {
  const { user: me } = useAuth();
  const navigate     = useNavigate();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const pollRef     = useRef(null);
  const scrollRef   = useRef(null);

  // Initial fetch + polling.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const fresh = await pb.get(`/messages/${peerId}`);
        if (!cancelled) setMsgs(fresh);
      } catch { /* silent */ }
    }
    load();
    pollRef.current = setInterval(load, 4000);
    return () => { cancelled = true; clearInterval(pollRef.current); };
  }, [peerId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    setText('');
    try {
      const m = await pb.post(`/messages/${peerId}`, { text: t });
      setMsgs((prev) => [...prev, m]);
    } catch {
      toast('Message failed');
      setText(t);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(13,27,42,.4)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: 380, background: 'white',
        borderLeft: '1.5px solid #E4EAF2',
        boxShadow: '-8px 0 40px rgba(0,0,0,.1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '16px 18px', borderBottom: '1.5px solid #E4EAF2',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg,#2563EB,#60A5FA)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0,
          }}>{initialsOf(peerName)}</div>
          <div style={{ flex: 1 }}>
            <div
              style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', cursor: 'pointer' }}
              onClick={() => navigate(`/profile?id=${peerId}`)}
            >{peerName}</div>
            <div style={{ fontSize: 11.5, color: '#8899B0' }}>usually replies in ~1h</div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l10 10M12 2 2 12" />
            </svg>
          </button>
        </div>

        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 10, background: '#EEF0F5',
        }}>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#8899B0' }}>
            Conversation started · today
          </div>
          {msgs.map((m) => {
            const mine = m.sender_id === me?.id;
            return (
              <div key={m.id} style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '78%', padding: '10px 14px', borderRadius: 14,
                background: mine ? '#2563EB' : 'white',
                color     : mine ? 'white' : '#0D1B2A',
                fontSize: 14, lineHeight: 1.45,
                border  : mine ? 'none' : '1.5px solid #E4EAF2',
              }}>{m.text}</div>
            );
          })}
        </div>

        <div style={{ padding: 12, borderTop: '1.5px solid #E4EAF2', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="reply-input" placeholder="Type a message…" value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button className="send-btn" onClick={send}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
