import { useEffect, useRef, useState } from 'react';

import { onXpEarned, pb } from '../api/client.js';

// Renders the gold/purple XP toasts. Two sources:
//   1. xp_earned in any pb.* response  -> emitted via api/client.js
//   2. /api/xp/pending poll (15 s while tab is visible)
//
// Visual layout is provided by the imported xpToast.css.

let nextId = 1;

export default function XpToastHost() {
  const [toasts, setToasts] = useState([]);
  const pollRef = useRef(null);

  function pushToast(points, message, isLevelUp = false, newLevel = null) {
    const id = nextId++;
    setToasts(prev => [...prev, { id, points, message, isLevelUp, newLevel, removing: false }]);
    setTimeout(() => setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t)), 3000);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3400);
  }

  // Listen for xp_earned events from any API call.
  useEffect(() => {
    return onXpEarned(x => {
      pushToast(x.points, x.message, false);
      if (x.levelUp) {
        setTimeout(() => pushToast(0, `You're now ${x.newLevel} level!`, true, x.newLevel), 700);
      }
    });
  }, []);

  // Poll /xp/pending every 15s while the tab is visible. Replaces the
  // old long-lived SSE stream that used to starve the connection pool.
  useEffect(() => {
    async function pollOnce() {
      if (!sessionStorage.getItem('pb_token')) return;
      if (document.hidden)                     return;
      try {
        const items = await pb.get('/xp/pending');
        if (Array.isArray(items)) {
          for (const d of items) pushToast(d.points, d.message, d.isLevelUp, d.newLevel);
        }
      } catch { /* network blip - try again next tick */ }
    }

    function start() {
      if (pollRef.current) return;
      pollOnce();
      pollRef.current = setInterval(pollOnce, 15000);
    }
    function stop() {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    }

    start();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (sessionStorage.getItem('pb_token')) start();
    });
    return stop;
  }, []);

  return (
    <div className="xp-toast-container">
      {toasts.map(t => {
        const icon = t.isLevelUp ? 'L' : t.points >= 25 ? '*' : t.points >= 15 ? '+' : '.';
        const pts  = t.isLevelUp ? `LEVEL UP! You're now ${t.newLevel}` : `+${t.points} XP`;
        return (
          <div
            key={t.id}
            className={`xp-toast${t.isLevelUp ? ' xp-levelup' : ''}${t.removing ? ' xp-removing' : ''}`}
          >
            <div className="xp-toast-icon">{icon}</div>
            <div className="xp-toast-body">
              <div className="xp-toast-pts">{pts}</div>
              <div className="xp-toast-msg">{t.message}</div>
            </div>
            <div className="xp-toast-bar" />
          </div>
        );
      })}
    </div>
  );
}
