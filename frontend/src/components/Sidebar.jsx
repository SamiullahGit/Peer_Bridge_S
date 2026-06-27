import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate }            from 'react-router-dom';

import { useAuth }            from '../context/AuthContext.jsx';
import { useNotifications }  from '../context/NotificationContext.jsx';
import { useTheme }          from '../context/ThemeContext.jsx';
import { pb }                from '../api/client.js';
import { roleLabel }  from '../utils/role.js';
import { initialsOf } from '../utils/avatar.js';
import { toast }      from './Toast.jsx';

import BridgeLogo     from './BridgeLogo.jsx';
import RequestsModal  from './RequestsModal.jsx';

/*
  Combined topnav + collapsible side-nav, used as the layout shell on
  every authenticated page.

  Usage:
    <Sidebar active="home">
      <PageBody />
    </Sidebar>

  optional `topnavMid` prop renders custom controls in the topnav
  centre slot (used by the events / resources pages for "Add" buttons).
*/

const NAV_ITEMS = [
  { key: 'home',      to: '/feed',      label: 'Home',
    icon: <><path d="M3 12 12 4l9 8" /><path d="M5 10v10h14V10" /></> },
  { key: 'mentors',   to: '/mentors',   label: 'Mentors',
    icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></> },
  { key: 'resources', to: '/resources', label: 'Resources',
    icon: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z" /> },
  { key: 'events',    to: '/events',    label: 'Events',
    icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></> },
  { key: 'messages',  to: '/messages',  label: 'Messages',
    icon: <path d="M14.5 10a1 1 0 0 1-1 1H4L1 14V3a1 1 0 0 1 1-1h11.5a1 1 0 0 1 1 1v7z" /> },
  { key: 'groups',    to: '/groups',    label: 'Study Groups',
    icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></> },
  { key: 'leaderboard', to: '/leaderboard', label: 'Leaderboard',
    icon: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h2a2 2 0 0 1 0 4h-2M7 5H5a2 2 0 0 0 0 4h2"/></> },
  { key: 'saved',     to: '/saved',     label: 'Saved',
    icon: <path d="M5 3h12v18l-6-4-6 4V3Z" /> },
];

function NavIcon({ children }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export default function Sidebar({ active, children, topnavMid = null, extraClass = '' }) {
  const { user, logout }                   = useAuth();
  const { unreadMsgs, markMsgsRead }       = useNotifications();
  const { theme, toggle: toggleTheme }     = useTheme();
  const navigate         = useNavigate();
  const [collapsed, setCollapsed] = useState(() => sessionStorage.getItem('pb_sidebar') === 'collapsed');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Mentorship requests for the badge / modal.
  const [requests, setRequests]   = useState([]);
  const [showRequests, setShowRequests] = useState(false);


  const isMentor = user?.role === 'mentor';
  const name     = user?.name || 'You';
  const imgUrl   = user?.profile_image || '';
  const initials = initialsOf(name);

  // Short-lived lock that suppresses the auto-collapse-on-scroll handler
  // for ~400ms after the user manually toggles the sidebar - otherwise
  // the grid-template-columns transition fires its own scroll event and
  // immediately re-collapses what the user just opened.
  const expandLock = useRef(false);

  // Publish the topnav's live height as --snav-topnav-h so the mobile drawer
  // and backdrop can start exactly below it (the topnav grows to two rows when
  // a page injects a search bar via topnavMid). Keeps the hamburger uncovered.
  const topnavRef = useRef(null);
  useEffect(() => {
    const el = topnavRef.current;
    if (!el) return;
    const setH = () => document.documentElement.style.setProperty('--snav-topnav-h', `${el.offsetHeight}px`);
    setH();
    const ro = new ResizeObserver(setH);
    ro.observe(el);
    window.addEventListener('resize', setH);
    return () => { ro.disconnect(); window.removeEventListener('resize', setH); };
  }, []);

  function toggleCollapsed() {
    expandLock.current = true;
    const next = !collapsed;
    setCollapsed(next);
    sessionStorage.setItem('pb_sidebar', next ? 'collapsed' : 'expanded');
    setTimeout(() => { expandLock.current = false; }, 400);
  }

  // Auto-collapse the sidebar while the user is scrolling the page body.
  useEffect(() => {
    let scheduled = false;
    function onScroll(e) {
      if (window.innerWidth <= 960) return;
      if (expandLock.current || scheduled) return;
      if (e.target.closest && e.target.closest('.snav')) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        if (sessionStorage.getItem('pb_sidebar') !== 'collapsed') {
          setCollapsed(true);
          sessionStorage.setItem('pb_sidebar', 'collapsed');
        }
      });
    }
    document.addEventListener('scroll', onScroll, true);
    return () => document.removeEventListener('scroll', onScroll, true);
  }, []);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 960) setMobileNavOpen(false);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load incoming mentorship requests for the badge (mentors only).
  useEffect(() => {
    if (!isMentor) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await pb.get('/users/incoming-requests');
        if (!cancelled) setRequests(Array.isArray(rows) ? rows : []);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [isMentor]);


  async function respondRequest(reqId, status) {
    try {
      await pb.patch(`/users/mentorship-requests/${reqId}`, { status });
      setRequests(prev => prev.filter(r => r.id !== reqId));
      toast(status === 'accepted' ? 'Request accepted!' : 'Request declined.');
    } catch (e) {
      toast(e.message || 'Failed to update request');
    }
  }

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  return (
    <div className={`with-sidebar${collapsed ? ' sidebar-collapsed' : ''}${extraClass ? ` ${extraClass}` : ''}`}>
      {/* ── Topnav ─────────────────────────────────────────── */}
      <header className="snav-topnav" ref={topnavRef}>
        <button
          type="button"
          className={`snav-mobile-toggle${mobileNavOpen ? ' is-open' : ''}`}
          aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <Link to="/feed" className="snav-topnav-logo">
          <BridgeLogo width={32} height={22} variant="nav" />
          <span>Peer Bridge</span>
        </Link>
        <div className="snav-topnav-mid">{topnavMid}</div>
        <button
          type="button"
          className="snav-icon-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
        <div className="snav-topnav-user" onClick={() => navigate('/profile')}>
          {imgUrl
            ? <img src={imgUrl} alt={name}
                   style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover',
                            border: '2px solid rgba(255,255,255,.3)', flexShrink: 0 }} />
            : <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'linear-gradient(135deg,#2563EB,#60A5FA)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: 'white', flexShrink: 0,
              }}>{initials}</div>}
          <span>{name}</span>
        </div>
      </header>

      {/* ── Side-nav ──────────────────────────────────────── */}
      <div className={`snav-mobile-backdrop${mobileNavOpen ? ' is-open' : ''}`} onClick={closeMobileNav} />
      <nav className={`snav${mobileNavOpen ? ' mobile-open' : ''}`}>
        <button className="snav-pin-btn" onClick={toggleCollapsed}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {/* Hamburger when collapsed; morphs into a ← arrow when expanded. */}
          <span className={`nav-burger${collapsed ? '' : ' is-arrow'}`} aria-hidden="true">
            <span className="nav-burger-line nb-top" />
            <span className="nav-burger-line nb-mid" />
            <span className="nav-burger-line nb-bot" />
          </span>
        </button>

        <div className="snav-section">Main</div>
        {NAV_ITEMS.map(item => (
          <Link key={item.key} to={item.to}
                className={`snav-item${active === item.key ? ' active' : ''}`}
                onClick={() => { closeMobileNav(); if (item.key === 'messages') markMsgsRead(); }}>
            <NavIcon>{item.icon}</NavIcon>
            <span>{item.label}</span>
            {item.key === 'messages' && unreadMsgs > 0 && (
              <span style={{
                marginLeft: 'auto', background: '#EF4444', color: 'white',
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
              }}>{unreadMsgs > 99 ? '99+' : unreadMsgs}</span>
            )}
          </Link>
        ))}

        {isMentor && (
          <>
            <div className="snav-section" style={{ marginTop: 8 }}>Mentorship</div>
            <button className="snav-item" type="button" onClick={() => { closeMobileNav(); setShowRequests(true); }}>
              <NavIcon>
                <path d="m11 17 2 2a1 1 0 1 0 3-3" />
                <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
                <path d="m21 3 1 11h-2" />
                <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
                <path d="M3 4h8" />
              </NavIcon>
              <span>Requests</span>
              {requests.length > 0 && (
                <span style={{
                  marginLeft: 'auto', background: '#EF4444', color: 'white',
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                }}>{requests.length}</span>
              )}
            </button>
          </>
        )}

        <div className="snav-section" style={{ marginTop: 8 }}>Account</div>
        <Link to="/profile" className={`snav-item${active === 'profile' ? ' active' : ''}`} onClick={closeMobileNav}>
          <NavIcon>
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="10" r="3" />
            <path d="M7 20.66V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.66" />
          </NavIcon>
          <span>My Profile</span>
        </Link>
        {user?.role === 'admin' && (
          <Link to="/admin" className={`snav-item${active === 'admin' ? ' active' : ''}`} onClick={closeMobileNav}>
            <NavIcon>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </NavIcon>
            <span>Admin</span>
          </Link>
        )}

        <div className="snav-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {imgUrl
              ? <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden',
                              flexShrink: 0, border: '2px solid rgba(255,255,255,.3)' }}>
                  <img src={imgUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              : <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#2563EB,#60A5FA)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: 'white', flexShrink: 0,
                }}>{initials}</div>}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)' }}>{roleLabel(user?.role || 'student')}</div>
            </div>
          </div>
          <button onClick={logout} style={{
            width: '100%', padding: 8,
            border: '1.5px solid rgba(255,255,255,.2)', borderRadius: 8,
            background: 'rgba(255,255,255,.08)',
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
            color: 'rgba(255,255,255,.75)', cursor: 'pointer',
          }}>Sign out</button>
        </div>

        <button className="snav-signout-icon" onClick={logout} title="Sign out">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </nav>

      {/* ── Page content slot ─────────────────────────────── */}
      <div className="snav-content">{children}</div>

      {showRequests && (
        <RequestsModal
          requests={requests}
          onRespond={respondRequest}
          onClose={() => setShowRequests(false)}
        />
      )}
    </div>
  );
}
