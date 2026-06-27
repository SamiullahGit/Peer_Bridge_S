import { useEffect, useState } from 'react';

// A modern share bottom-sheet (Instagram / Facebook style). Offers the common
// web share targets, a copy-link action, and — where the browser supports it
// (mostly mobile) — a "More" button that opens the native OS share sheet so
// users can pick Instagram, Messages, etc.

const enc = encodeURIComponent;

function ringStyle(bg) {
  return {
    width: 52, height: 52, borderRadius: '50%', background: bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,.18)',
  };
}

export default function ShareSheet({ url, title = '', onClose }) {
  const [copied, setCopied] = useState(false);
  const text     = title?.trim() ? title.trim() : 'Check this out on Peer Bridge';
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const targets = [
    { key: 'whatsapp', label: 'WhatsApp', bg: '#25D366',
      href: `https://wa.me/?text=${enc(`${text} ${url}`)}`,
      svg: <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5 14.2c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.7-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3 0-1.5.8-2.2 1-2.4.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.3c-.1.1-.3.3-.1.5.1.3.7 1.1 1.4 1.7.9.8 1.7 1.1 2 1.2.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.6-.1l1.9.9c.3.1.4.2.5.3.1.2.1.7-.1 1.3z" fill="currentColor" stroke="none" /> },
    { key: 'facebook', label: 'Facebook', bg: '#1877F2',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      text: 'f' },
    { key: 'x', label: 'X', bg: '#000000',
      href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`,
      svg: <path d="M4 3l7 9-7 9h2.2l5.8-7.5L17.8 21H21l-7.3-9.4L20.5 3h-2.2l-5.4 7L7.2 3H4z" fill="currentColor" stroke="none" /> },
    { key: 'telegram', label: 'Telegram', bg: '#229ED9',
      href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
      svg: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /> },
    { key: 'linkedin', label: 'LinkedIn', bg: '#0A66C2',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
      text: 'in' },
    { key: 'email', label: 'Email', bg: '#6B7280',
      href: `mailto:?subject=${enc(text)}&body=${enc(`${text}\n\n${url}`)}`,
      svg: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></> },
  ];

  function openTarget(href) {
    window.open(href, '_blank', 'noopener,noreferrer');
    onClose();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1400); }
    catch { /* ignore */ }
  }
  async function native() {
    try { await navigator.share({ title: title || 'Peer Bridge', text, url }); onClose(); }
    catch { /* user cancelled */ }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div className="fade-up" style={{
        width: '100%', maxWidth: 520, background: 'var(--card)',
        borderRadius: '20px 20px 0 0', border: '1px solid var(--line)', borderBottom: 'none',
        padding: '14px 20px 22px', boxShadow: '0 -12px 48px rgba(0,0,0,.35)',
      }}>
        {/* grab handle */}
        <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--line-2)', margin: '2px auto 14px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>Share</div>
          <button onClick={onClose} aria-label="Close" style={{
            width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)',
            background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l10 10M12 2 2 12" /></svg>
          </button>
        </div>

        {/* App targets */}
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 6 }}>
          {targets.map((t) => (
            <button key={t.key} onClick={() => openTarget(t.href)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
              background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, width: 64,
            }}>
              <span style={ringStyle(t.bg)}>
                {t.svg
                  ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{t.svg}</svg>
                  : <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Georgia, serif' }}>{t.text}</span>}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600 }}>{t.label}</span>
            </button>
          ))}
          {canNative && (
            <button onClick={native} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
              background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, width: 64,
            }}>
              <span style={{ ...ringStyle('var(--bg-2)'), color: 'var(--ink)', border: '1px solid var(--line)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
                </svg>
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600 }}>More</span>
            </button>
          )}
        </div>

        {/* Copy link */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 18,
          padding: '10px 12px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-2)',
        }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink-2)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{url}</div>
          <button onClick={copy} style={{
            flexShrink: 0, padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: copied ? 'var(--mint)' : 'var(--blue)', color: copied ? 'var(--mint-ink)' : '#fff',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
          }}>{copied ? '✓ Copied' : 'Copy link'}</button>
        </div>
      </div>
    </div>
  );
}
