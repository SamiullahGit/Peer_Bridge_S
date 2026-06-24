import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'light', toggle: () => {} });

function getUid() {
  try { return JSON.parse(sessionStorage.getItem('pb_user'))?.id || null; }
  catch { return null; }
}
function themeKey(uid) { return uid ? `pb_theme_${uid}` : 'pb_theme'; }
function loadTheme() {
  const uid = getUid();
  return (
    localStorage.getItem(themeKey(uid)) ||
    localStorage.getItem('pb_theme') ||
    'light'
  );
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(loadTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(themeKey(getUid()), theme);
  }, [theme]);

  // When a different user logs in, load their saved preference.
  useEffect(() => {
    function onUserChanged(e) {
      const uid = e.detail?.userId;
      const saved = localStorage.getItem(themeKey(uid)) || 'light';
      setThemeState(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
    window.addEventListener('pb-user-changed', onUserChanged);
    return () => window.removeEventListener('pb-user-changed', onUserChanged);
  }, []);

  const toggle = () => setThemeState(t => t === 'light' ? 'dark' : 'light');
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
