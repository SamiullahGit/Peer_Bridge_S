
export const API_BASE = import.meta.env.VITE_API_BASE || '/api';


// Subscribers to xp_earned events from any pb.* call. The XpToastHost
// component listens here so toasts fire automatically without each

const xpListeners = new Set();
export function onXpEarned(fn)  { xpListeners.add(fn);    return () => xpListeners.delete(fn); }
export function emitXpEarned(d) { xpListeners.forEach(fn => fn(d)); }

// 401 handler subscribers - AuthContext listens to clear stale auth.
const unauthListeners = new Set();
export function onUnauthorized(fn) { unauthListeners.add(fn); return () => unauthListeners.delete(fn); }

function readToken() { return sessionStorage.getItem('pb_token'); }

async function req(method, path, body = null, isFormData = false) {
  const headers = {};
  const token   = readToken();
  if (token)        headers.Authorization = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  const res  = await fetch(API_BASE + path, opts);
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && token) {
    unauthListeners.forEach(fn => fn());
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

  // Auto-broadcast XP toasts whenever an action returns xp_earned.
  if (data.xp_earned) emitXpEarned(data.xp_earned);

  return data;
}

export const pb = {
  get   : (path)        => req('GET',    path),
  post  : (path, body)  => req('POST',   path, body),
  put   : (path, body)  => req('PUT',    path, body),
  del   : (path)        => req('DELETE', path),
  upload: (path, form)  => req('POST',   path, form, true),
  patch : (path, body)  => req('PATCH',  path, body),
};
