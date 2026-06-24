import { useEffect }  from 'react';
import { useNavigate } from 'react-router-dom';

import { useNotifications }        from '../context/NotificationContext.jsx';
import { initialsOf, avatarColors } from '../utils/avatar.js';

export default function MsgPopupHost() {
  const { popups, dismissPopup } = useNotifications();
  const navigate = useNavigate();

  if (!popups.length) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      zIndex: 9999,
      display: 'flex', flexDirection: 'column-reverse', gap: 10,
      pointerEvents: 'none',
    }}>
      {popups.map(p => (
        <MsgPopupItem
          key={p.key}
          popup={p}
          onDismiss={() => dismissPopup(p.key)}
          onOpen={() => {
            dismissPopup(p.key);
            navigate(`/messages?to=${p.id}&name=${encodeURIComponent(p.name)}`);
          }}
        />
      ))}
    </div>
  );
}

function MsgPopupItem({ popup, onDismiss, onOpen }) {
  const [bg, fg] = avatarColors(popup.name);
  const initials = initialsOf(popup.name);

  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="msg-popup-item"
      onClick={onOpen}
      style={{ pointerEvents: 'all' }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg, ${bg}, ${bg}cc)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 800, color: fg,
      }}>{initials}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>
          {popup.name}
        </div>
        <div style={{
          fontSize: 12.5, color: 'var(--ink-3)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {popup.text || 'Sent you a message'}
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'var(--bg-2)', border: 'none',
          cursor: 'pointer', color: 'var(--ink-3)',
          fontSize: 14, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >×</button>
    </div>
  );
}
