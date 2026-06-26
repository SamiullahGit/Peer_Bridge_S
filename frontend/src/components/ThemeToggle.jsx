import { useState } from 'react';
import { getTheme, toggleTheme } from '../theme.js';

// Sun/moon toggle that flips the global theme. Styled to sit inside the
// side-nav (.snav-theme-toggle in dark.css), collapsing with the rail.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme());
  const dark = theme === 'dark';

  return (
    <button className="snav-theme-toggle" onClick={() => setTheme(toggleTheme())}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {dark ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
      <span>{dark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
