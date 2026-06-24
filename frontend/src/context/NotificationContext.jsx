import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { pb }       from '../api/client.js';
import { useAuth }  from './AuthContext.jsx';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { token }  = useAuth();
  const location   = useLocation();

  const [convos, setConvos]   = useState([]);
  const [popups, setPopups]   = useState([]);

  const firstFetchRef    = useRef(true);
  const prevConvosRef    = useRef([]);
  const isOnMsgsRef      = useRef(false);

  // Keep isOnMsgsRef in sync with the current route so the interval
  // callback (captured at effect-creation time) can still read it.
  useEffect(() => {
    isOnMsgsRef.current = location.pathname === '/messages';
  }, [location.pathname]);

  const unreadMsgs = convos.reduce((s, c) => s + (c.unread || 0), 0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function fetchConvos() {
      try {
        const list = await pb.get('/messages');
        if (cancelled) return;

        // Detect new messages only after the baseline fetch.
        if (!firstFetchRef.current && !isOnMsgsRef.current) {
          for (const c of list) {
            if (!c.unread) continue;
            const old = prevConvosRef.current.find(p => p.id === c.id);
            if (!old || c.unread > (old.unread || 0)) {
              setPopups(prev => [
                ...prev,
                { key: `${c.id}-${Date.now()}`, id: c.id, name: c.name, text: c.last_message },
              ]);
            }
          }
        }

        firstFetchRef.current  = false;
        prevConvosRef.current  = list;
        setConvos(list);
      } catch { /* silent */ }
    }

    fetchConvos();
    const timer = setInterval(fetchConvos, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [token]);

  // Reset on logout
  useEffect(() => {
    if (!token) {
      setConvos([]);
      setPopups([]);
      firstFetchRef.current = true;
      prevConvosRef.current = [];
    }
  }, [token]);

  function dismissPopup(key) {
    setPopups(prev => prev.filter(p => p.key !== key));
  }

  // Called when the user navigates to Messages so the badge resets.
  function markMsgsRead() {
    setConvos(prev => prev.map(c => ({ ...c, unread: 0 })));
  }

  return (
    <NotificationContext.Provider value={{ convos, unreadMsgs, popups, dismissPopup, markMsgsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be inside <NotificationProvider>');
  return ctx;
}
