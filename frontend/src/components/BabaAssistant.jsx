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
  const [showHint, setShowHint] = useState(false);   // one-time "drag me" tip
  const scrollRef = useRef(null);
  const inputRef  = useRef(null);

  // Drag-to-reposition. `pos` is the panel's top-left in px once the user has
  // dragged it; null means "use the default bottom-left anchor". Pointer
  // capture on the header keeps the drag smooth even past the handle's edges.
  const [pos, setPos] = useState(null);
  const panelRef = useRef(null);
  const drag     = useRef(null);

  function startDrag(e) {
    if (!panelRef.current) return;
    const r = panelRef.current.getBoundingClientRect();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, w: r.width, h: r.height };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.currentTarget.style.cursor = 'grabbing';
  }
  function onDrag(e) {
    const d = drag.current;
    if (!d) return;
    const x = Math.max(8, Math.min(d.ox + e.clientX - d.sx, window.innerWidth  - d.w - 8));
    const y = Math.max(8, Math.min(d.oy + e.clientY - d.sy, window.innerHeight - d.h - 8));
    setPos({ x, y });
  }
  function endDrag(e) {
    drag.current = null;
    e.currentTarget.style.cursor = 'grab';
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
  }

  // Launcher button is both clickable AND draggable. We tell a tap from a drag
  // with a small movement threshold: if the pointer barely moves it's a tap
  // (toggle the chat); if it travels past the threshold it's a drag (reposition
  // and suppress the toggle).
  const [btnPos, setBtnPos] = useState(null);
  const btnDrag = useRef(null);

  function btnDown(e) {
    const r = e.currentTarget.getBoundingClientRect();
    btnDrag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, w: r.width, h: r.height, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function btnMove(e) {
    const d = btnDrag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;   // below threshold → still a tap
    d.moved = true;
    const x = Math.max(8, Math.min(d.ox + dx, window.innerWidth  - d.w - 8));
    const y = Math.max(8, Math.min(d.oy + dy, window.innerHeight - d.h - 8));
    setBtnPos({ x, y });
  }
  function btnUp(e) {
    const d = btnDrag.current;
    btnDrag.current = null;
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* noop */ }
    if (d && !d.moved) setOpen((o) => !o);   // it was a tap → toggle the chat
  }

  useEffect(() => {
    if (open) requestAnimationFrame(() => { inputRef.current?.focus(); scrollToEnd(); });
  }, [open]);
  useEffect(() => { scrollToEnd(); }, [messages, busy]);

  // Show a friendly "you can drag me" tip once per sign-in session.
  useEffect(() => {
    if (!user || sessionStorage.getItem('pb_baba_hint')) return;
    sessionStorage.setItem('pb_baba_hint', '1');
    const show = setTimeout(() => setShowHint(true), 1000);
    const hide = setTimeout(() => setShowHint(false), 9000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [user]);

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
      {/* One-time "drag me" tip — only while the button is at its default spot */}
      {showHint && !btnPos && !open && (
        <div style={{
          position: 'fixed', left: 22, bottom: 94, zIndex: 1001, maxWidth: 236,
          background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)',
          borderRadius: 14, padding: '11px 30px 12px 14px',
          boxShadow: '0 14px 36px rgba(0,0,0,.3)', animation: 'fade-up .28s ease both',
        }}>
          <button onClick={() => setShowHint(false)} aria-label="Dismiss tip" style={{
            position: 'absolute', top: 7, right: 8, width: 20, height: 20, border: 'none',
            background: 'transparent', color: 'var(--ink-3)', cursor: 'pointer', fontSize: 15, lineHeight: 1,
          }}>×</button>
          <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 3 }}>👋 Hi, I'm Baba</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            You can drag me anywhere on the screen — I'll stay wherever you drop me.
          </div>
          {/* tail pointing down to the button */}
          <span aria-hidden style={{
            position: 'absolute', bottom: -7, left: 24, width: 13, height: 13,
            background: 'var(--card)', borderRight: '1px solid var(--line)',
            borderBottom: '1px solid var(--line)', transform: 'rotate(45deg)',
          }} />
        </div>
      )}

      {/* Floating button — tap to open, drag to reposition */}
      <button
        onPointerDown={btnDown}
        onPointerMove={btnMove}
        onPointerUp={btnUp}
        onPointerCancel={btnUp}
        title="Ask Baba — drag to move me"
        aria-label="Ask Baba"
        style={{
          position: 'fixed', zIndex: 1000,
          ...(btnPos ? { left: btnPos.x, top: btnPos.y } : { left: 24, bottom: 24 }),
          width: 58, height: 58, borderRadius: '50%', cursor: 'pointer',
          border: '1px solid rgba(255,255,255,.35)',
          background: 'linear-gradient(140deg,#8B5CF6 0%,#6366F1 52%,#2563EB 100%)',
          boxShadow: '0 10px 26px rgba(99,102,241,.5), inset 0 1px 1px rgba(255,255,255,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform .15s, box-shadow .2s', touchAction: 'none',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {/* soft pulsing glow halo (sits behind the orb) */}
        <span aria-hidden style={{
          position: 'absolute', inset: -5, borderRadius: '50%', zIndex: -1,
          background: 'linear-gradient(140deg,#8B5CF6,#2563EB)', filter: 'blur(9px)',
          opacity: 0.6, pointerEvents: 'none',
          animation: open ? 'none' : 'babaPulse 2.6s ease-in-out infinite',
        }} />
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        ) : (
          // Clean chat bubble with typing dots — instantly reads as "ask / chat".
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none">
            <path d="M5 4h14a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-7.2l-4.3 3.1a.6.6 0 0 1-1-.5V17H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"
                  fill="#fff" />
            <circle cx="8.5"  cy="10.5" r="1.25" fill="#6D28D9" />
            <circle cx="12"   cy="10.5" r="1.25" fill="#6D28D9" />
            <circle cx="15.5" cy="10.5" r="1.25" fill="#6D28D9" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div ref={panelRef} style={{
          position: 'fixed', zIndex: 1000,
          ...(pos ? { left: pos.x, top: pos.y } : { left: 24, bottom: 92 }),
          width: 'min(380px, calc(100vw - 48px))', height: 'min(540px, calc(100vh - 140px))',
          background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 18,
          boxShadow: '0 24px 64px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', animation: pos ? 'none' : 'fade-up .2s ease both',
        }}>
          {/* Header — doubles as the drag handle */}
          <div
            onPointerDown={startDrag}
            onPointerMove={onDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 11,
              background: 'linear-gradient(135deg,#7C3AED,#2563EB)', flexShrink: 0,
              cursor: 'grab', touchAction: 'none', userSelect: 'none',
            }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧕</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>Ask Baba</div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.8)' }}>Your AI study buddy</div>
            </div>
            {/* Grip affordance so users know the bar is draggable */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)"
                 strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }} aria-hidden="true">
              <circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" />
              <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
              <circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" />
            </svg>
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

      <style>{`@keyframes babaBlink{0%,100%{opacity:.3}50%{opacity:1}}@keyframes babaPulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.75;transform:scale(1.15)}}`}</style>
    </>
  );
}
