import { useEffect, useRef, useState } from 'react';

import { pb } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

// "Ask Baba" — floating AI study-assistant widget. Mounted globally; only
// renders for logged-in users. Talks to POST /api/ai/ask (OpenRouter).

const GREETING = {
  role: 'assistant',
  content: "Assalam-o-Alaikum! I'm Baba, your study buddy 🧕\nAsk me anything — concepts, study tips, career advice, or NUST life. How can I help?",
};

const SUGGESTIONS = [
  'Explain recursion simply',
  'How do I prepare for FAST?',
  'Tips to beat exam stress',
  'How do I find an internship?',
];

export default function BabaAssistant() {
  const { user } = useAuth();
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [draft, setDraft]     = useState('');
  const [busy, setBusy]       = useState(false);
  const scrollRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => { inputRef.current?.focus(); scrollToEnd(); });
  }, [open]);
  useEffect(() => { scrollToEnd(); }, [messages, busy]);

  function scrollToEnd() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }

  async function send(text) {
    const q = (text ?? draft).trim();
    if (!q || busy) return;
    const next = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    try {
      // Send the recent conversation (minus the greeting) for context.
      const convo = next.filter((m) => m !== GREETING).map((m) => ({ role: m.role, content: m.content }));
      const r = await pb.post('/ai/ask', { messages: convo });
      setMessages((prev) => [...prev, { role: 'assistant', content: r.answer }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${e.message || 'Baba could not answer. Try again.'}` }]);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Ask Baba"
        style={{
          position: 'fixed', left: 24, bottom: 24, zIndex: 1000,
          width: 56, height: 56, borderRadius: '50%', cursor: 'pointer', border: 'none',
          background: 'linear-gradient(135deg,#7C3AED,#2563EB)',
          boxShadow: '0 8px 24px rgba(124,58,237,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform .15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a2 2 0 0 1 2 2v1h3a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-3l-4 3v-3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h3V4a2 2 0 0 1 2-2z" />
            <circle cx="9" cy="11.5" r="1.1" fill="#fff" stroke="none" /><circle cx="15" cy="11.5" r="1.1" fill="#fff" stroke="none" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', left: 24, bottom: 92, zIndex: 1000,
          width: 'min(380px, calc(100vw - 48px))', height: 'min(540px, calc(100vh - 140px))',
          background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 18,
          boxShadow: '0 24px 64px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', animation: 'fade-up .2s ease both',
        }}>
          {/* Header */}
          <div style={{
            padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 11,
            background: 'linear-gradient(135deg,#7C3AED,#2563EB)', flexShrink: 0,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧕</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>Ask Baba</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.8)' }}>Your AI study buddy</div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14,
                                        display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-2)' }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%',
                padding: '9px 13px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: m.role === 'user' ? 'var(--blue)' : 'var(--card)',
                color: m.role === 'user' ? '#fff' : 'var(--ink)',
                border: m.role === 'user' ? 'none' : '1px solid var(--line)',
                fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>{m.content}</div>
            ))}
            {busy && (
              <div style={{ alignSelf: 'flex-start', padding: '9px 14px', borderRadius: 14,
                            background: 'var(--card)', border: '1px solid var(--line)', display: 'flex', gap: 4 }}>
                {[0, 1, 2].map((d) => (
                  <span key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-3)',
                                         animation: `babaBlink 1s ${d * 0.15}s infinite` }} />
                ))}
              </div>
            )}
            {messages.length === 1 && !busy && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 4 }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} style={{
                    padding: '6px 11px', borderRadius: 999, cursor: 'pointer',
                    border: '1.5px solid var(--blue-mid)', background: 'var(--blue-soft)',
                    color: 'var(--blue)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                  }}>{s}</button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: 11, borderTop: '1px solid var(--line)', background: 'var(--card)',
                        display: 'flex', gap: 8, flexShrink: 0 }}>
            <input
              ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask Baba anything…"
              style={{ flex: 1, padding: '10px 13px', borderRadius: 10, border: '1.5px solid var(--line)',
                       background: 'var(--bg-2)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 13.5, outline: 'none' }}
            />
            <button onClick={() => send()} disabled={!draft.trim() || busy} style={{
              width: 42, borderRadius: 10, border: 'none', flexShrink: 0, cursor: draft.trim() && !busy ? 'pointer' : 'default',
              background: draft.trim() && !busy ? 'var(--blue)' : 'var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)', textAlign: 'center', padding: '0 10px 8px', background: 'var(--card)' }}>
            Baba can make mistakes. Double-check important info.
          </div>
        </div>
      )}

      <style>{`@keyframes babaBlink{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
    </>
  );
}
