import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams }   from 'react-router-dom';

import Sidebar      from '../components/Sidebar.jsx';
import ToastHost, { toast }   from '../components/Toast.jsx';
import { pb }       from '../api/client.js';
import { useAuth }  from '../context/AuthContext.jsx';
import { initialsOf, avatarColors } from '../utils/avatar.js';
import { timeAgo }  from '../utils/time.js';
import { ConvoItemSkeleton } from '../components/Skeleton.jsx';

import '../styles/messages.css';

// Two-pane chat. Conversations list on the left, active thread on the
// right. Polls the open thread every 4 seconds.

export default function Messages() {
  const { user: me } = useAuth();
  const navigate     = useNavigate();
  const [params]     = useSearchParams();

  const initialId    = params.get('to') || null;
  const initialName  = params.get('name') ? decodeURIComponent(params.get('name')) : '';

  const [convos, setConvos]     = useState([]);
  const [convosLoading, setConvosLoading] = useState(true);
  const [activeId, setActiveId] = useState(initialId);
  const [activeName, setActiveName] = useState(initialName);
  const [msgs, setMsgs]         = useState([]);
  const [draft, setDraft]       = useState('');
  const [search, setSearch]     = useState('');
  const pollRef     = useRef(null);
  const scrollRef   = useRef(null);

  useEffect(() => { loadConvos(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    if (!activeId) return;
    loadMsgs();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(loadMsgs, 4000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) {
      requestAnimationFrame(() => { scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
    }
  }, [msgs]);

  async function loadConvos() {
    try {
      const list = await pb.get('/messages');
      // If the URL targets a user we don't yet have a conversation
      // with, surface them at the top so we can chat immediately.
      let next = list;
      if (initialId && !list.find((c) => c.id === initialId) && initialName) {
        next = [{ id: initialId, name: initialName, last_message: '', is_online: false, unread: 0 }, ...list];
      }
      setConvos(next);
    } catch { /* silent */ }
    finally { setConvosLoading(false); }
  }

  async function loadMsgs() {
    try {
      const fresh = await pb.get(`/messages/${activeId}`);
      setMsgs(fresh);
    } catch { /* silent */ }
  }

  async function sendMsg() {
    const text = draft.trim();
    if (!text || !activeId) return;
    setDraft('');
    try {
      const m = await pb.post(`/messages/${activeId}`, { text });
      setMsgs((prev) => [...prev, m]);
      loadConvos();
    } catch {
      toast('Failed to send');
      setDraft(text);
    }
  }

  function openConvo(id, name) {
    setActiveId(id);
    setActiveName(name);
  }

  const filteredConvos = !search.trim()
    ? convos
    : convos.filter((c) => (c.name || '').toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Sidebar active="messages" extraClass="messages-page">
      <ToastHost />
      <div className="msg-wrapper">
        <div className={`msg-layout${activeId ? ' has-active-chat' : ''}`}>
          <div className="convo-panel">
            <div className="convo-panel-head">
              <div className="convo-panel-title">Messages</div>
              <div className="convo-search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="var(--ink-3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="text" placeholder="Search conversations…"
                  value={search} onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="convo-list-wrap">
              {convosLoading
                ? [0, 1, 2, 3, 4].map((i) => <ConvoItemSkeleton key={i} />)
                : filteredConvos.length === 0
                ? <ConvoEmpty />
                : filteredConvos.map((c) => (
                    <ConvoItem key={c.id} c={c} active={activeId === c.id}
                               onClick={() => openConvo(c.id, c.name)} />
                  ))}
            </div>
          </div>

          <div className="chat-pane">
            {activeId ? (
              <>
                <div className="chat-header">
                  <button className="chat-back-btn" onClick={() => setActiveId(null)}>Back</button>
                  <Bubble name={activeName} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a className="chat-header-name" onClick={() => navigate(`/profile?id=${activeId}`)}>{activeName}</a>
                    <div className="chat-header-sub">NUST community member</div>
                  </div>
                  <a href={`/profile?id=${activeId}`}
                     onClick={(e) => { e.preventDefault(); navigate(`/profile?id=${activeId}`); }}
                     style={{
                       display: 'flex', alignItems: 'center', gap: 5,
                       padding: '7px 13px', borderRadius: 8,
                       border: '1.5px solid var(--line)',
                       fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)',
                       textDecoration: 'none',
                     }}>Profile</a>
                </div>

                <div className="chat-msgs" ref={scrollRef}>
                  <div className="chat-date-divider">Today</div>
                  {msgs.map((m) => (
                    <div key={m.id}
                         className={`bubble ${m.sender_id === me?.id ? 'bubble-me' : 'bubble-them'}`}>
                      {m.text}
                      <div className="bubble-time"
                           style={{ textAlign: m.sender_id === me?.id ? 'right' : 'left' }}>
                        {timeAgo(m.created_at)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="chat-input-bar">
                  <input
                    className="chat-input-field" placeholder="Type a message…"
                    value={draft} onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                  />
                  <button className="chat-send-btn" onClick={sendMsg} title="Send">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                         stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2 11 13" />
                      <path d="M22 2 15 22l-4-9-9-4 20-7z" />
                    </svg>
                  </button>
                </div>
              </>
            ) : <ChatEmpty onFindMentor={() => navigate('/mentors')} />}
          </div>
        </div>
      </div>
    </Sidebar>
  );
}

/* ── Bits ────────────────────────────────────────────────────────── */

function ConvoItem({ c, active, onClick }) {
  return (
    <div className={`convo-item${active ? ' active' : ''}`} onClick={onClick}>
      <Bubble name={c.name} size={44} online={c.is_online} />
      <div className="convo-item-info">
        <div className="convo-item-top">
          <span className="convo-item-name">{c.name || 'Unknown'}</span>
          {c.unread ? <span className="convo-badge">{c.unread}</span> : null}
        </div>
        <div className="convo-item-preview">{c.last_message || 'Start a conversation'}</div>
      </div>
    </div>
  );
}

function Bubble({ name = '?', size = 38, online = false }) {
  const init = initialsOf(name);
  const [bg, fg] = avatarColors(name);
  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `linear-gradient(135deg, ${bg}, ${bg}cc)`,
        border: '2px solid rgba(0,0,0,.06)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.37), fontWeight: 800, color: fg, fontFamily: 'inherit',
      }}>{init}</div>
      {online && (
        <span style={{
          position: 'absolute', bottom: 0, right: 0,
          width: Math.round(size * 0.28), height: Math.round(size * 0.28),
          borderRadius: '50%', background: '#22c55e', border: '2px solid #fff',
        }} />
      )}
    </div>
  );
}

function ConvoEmpty() {
  return (
    <div className="convo-empty">
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'var(--blue-soft)', border: '1.5px solid var(--blue-mid)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
             stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8 8 0 0 1-8 8 8 8 0 0 1-3.5-.8L4 21l1.3-4.5A8 8 0 0 1 13 4a8 8 0 0 1 8 8Z" />
        </svg>
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>No conversations yet</h3>
      <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
        Connect with a mentor or peer<br />to start your first chat.
      </p>
      <a href="/mentors" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4,
        padding: '9px 16px', borderRadius: 9,
        background: 'var(--blue)', color: '#fff',
        fontSize: 13, fontWeight: 700, textDecoration: 'none',
        boxShadow: '0 2px 8px rgba(37,99,235,.24)',
      }}>Browse Mentors</a>
    </div>
  );
}

function ChatEmpty({ onFindMentor }) {
  return (
    <div className="chat-empty">
      <div className="chat-empty-card">
        <div className="chat-empty-icon-wrap">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none"
               stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a8 8 0 0 1-8 8 8 8 0 0 1-3.5-.8L4 21l1.3-4.5A8 8 0 0 1 13 4a8 8 0 0 1 8 8Z" />
          </svg>
        </div>
        <div className="chat-empty-title">Start a conversation</div>
        <div className="chat-empty-sub">
          Select someone from the list on the left, or connect with a mentor to kick off your first chat.
        </div>
        <button className="chat-empty-btn" onClick={onFindMentor}>Find a Mentor</button>
      </div>
    </div>
  );
}
