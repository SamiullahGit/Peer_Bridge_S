// Generic info modal used by the landing-page footer (About / Blog /
// Contact / Privacy / Terms / Support). Title + scrollable body; click
// outside or the X button closes.

export default function InfoModal({ title, children, onClose }) {
  return (
    <div
      className="lp-auth-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="lp-auth-modal" style={{ maxWidth: 560 }}>
        <button className="lp-auth-close" onClick={onClose}>X</button>
        <div className="lp-auth-body" style={{ paddingTop: 28 }}>
          <div style={{
            fontSize: 22, fontWeight: 800, color: '#0D1B2A',
            marginBottom: 14, letterSpacing: '-0.01em',
          }}>{title}</div>
          <div style={{
            fontSize: 14, color: '#4B5C73', lineHeight: 1.65,
            maxHeight: '60vh', overflowY: 'auto', paddingRight: 4,
          }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
