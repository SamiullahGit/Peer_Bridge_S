import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { onUnauthorized } from '../api/client.js';

// Auth lives in sessionStorage (mirrors the vanilla app: clears on
// browser close). The provider re-hydrates from sessionStorage on
// mount so a hard refresh keeps the user signed in.
const AuthContext = createContext(null);

function readUser() {
  try { return JSON.parse(sessionStorage.getItem('pb_user')) || null; }
  catch { return null; }
}

export function AuthProvider({ children }) {
  const navigate     = useNavigate();
  const [user, setUserState]  = useState(readUser);
  const [token, setTokenState] = useState(() => sessionStorage.getItem('pb_token'));

  function setAuth(newToken, newUser) {
    sessionStorage.setItem('pb_token', newToken);
    sessionStorage.setItem('pb_user',  JSON.stringify(newUser));
    setTokenState(newToken);
    setUserState(newUser);
    window.dispatchEvent(new CustomEvent('pb-user-changed', { detail: { userId: newUser.id } }));
  }

  function clearAuth() {
    sessionStorage.removeItem('pb_token');
    sessionStorage.removeItem('pb_user');
    setTokenState(null);
    setUserState(null);
  }

  function logout() {
    clearAuth();
    navigate('/');
  }

  // Whenever the API client returns 401, drop credentials and bounce
  // back to the landing page so the user gets a fresh OTP.
  useEffect(() => {
    return onUnauthorized(() => {
      clearAuth();
      if (window.location.pathname !== '/') navigate('/');
    });
  }, [navigate]);

  const value = { user, token, setAuth, clearAuth, logout, setUser: setUserState };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
