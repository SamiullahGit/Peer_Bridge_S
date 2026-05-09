import { useEffect, useState } from 'react';

// Singleton toast queue + global helper. Pages import { toast } and
// call toast('Saved!') exactly like the vanilla showToast() helper.

let pushFn = null;
export function toast(msg, ms = 3000) { pushFn && pushFn(msg, ms); }

export default function ToastHost() {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    pushFn = (msg, ms) => {
      const id = Math.random().toString(36).slice(2);
      setQueue(q => [...q, { id, msg }]);
      setTimeout(() => setQueue(q => q.filter(t => t.id !== id)), ms);
    };
    return () => { pushFn = null; };
  }, []);

  return (
    <>
      {queue.map((t, i) => (
        <div key={t.id} className="toast" style={{ bottom: 24 + i * 56 }}>
          {t.msg}
        </div>
      ))}
    </>
  );
}
