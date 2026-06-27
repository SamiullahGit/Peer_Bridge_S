import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate }            from 'react-router-dom';

import { pb }            from '../api/client.js';
import { useAuth }       from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import { useTheme }      from '../context/ThemeContext.jsx';
import { initialsOf, avatarColors } from '../utils/avatar.js';
import { roleLabel }     from '../utils/role.js';
import { timeAgo }       from '../utils/time.js';
import { toast }         from '../components/Toast.jsx';

import BridgeLogo        from '../components/BridgeLogo.jsx';
import PostCard          from '../components/PostCard.jsx';
import { PostCardSkeleton, PanelRowSkeleton } from '../components/Skeleton.jsx';
import ComposerModal     from '../components/ComposerModal.jsx';
import ChatOverlay       from '../components/ChatOverlay.jsx';
import ReportModal       from '../components/ReportModal.jsx';
import RequestsModal     from '../components/RequestsModal.jsx';
import ToastHost         from '../components/Toast.jsx';

import '../styles/feed.css';

const FILTERS = [
  { key: 'For you',   label: 'For you' },
  { key: 'Following', label: 'Following' },
  { key: 'Academic',  label: 'Academic' },
  { key: 'Career',    label: 'Career' },
  { key: 'Resources', label: 'Resources' },
  { key: 'Events',    label: 'Events' },
];

const TRENDING = ['#FYP', '#Internships', '#GRE', '#MachineLearning', '#CampusPlacements', '#SEECS'];

// Deterministic mentor avatar gradients - same name always picks the same
// colour so the right-panel list reads consistently across renders.
const MENTOR_GRADIENTS = [
  'linear-gradient(135deg,#2563EB,#60A5FA)',  // blue
  'linear-gradient(135deg,#7C3AED,#A78BFA)',  // violet
  'linear-gradient(135deg,#0D1B2A,#334155)',  // navy
  'linear-gradient(135deg,#047857,#34D399)',  // emerald
  'linear-gradient(135deg,#DB2777,#F472B6)',  // pink
  'linear-gradient(135deg,#D97706,#FBBF24)',  // amber
];

function gradientFor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return MENTOR_GRADIENTS[Math.abs(h) % MENTOR_GRADIENTS.length];
}

// Home / feed page. Owns the bespoke 3-column layout (sidebar / main /
// right-rail) and orchestrates the Composer / Chat / Report sub-modals.

export default function Feed() {
  const { user: me, logout } = useAuth();
  const navigate             = useNavigate();
  const isMentor             = me?.role === 'mentor';
  const { convos, unreadMsgs, markMsgsRead } = useNotifications();
  const { theme, toggle: toggleTheme } = useTheme();

  // Layout state
  const [collapsed, setCollapsed] = useState(() => sessionStorage.getItem('pb_sidebar') === 'collapsed');
  const [panelHidden, setPanelHidden] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Data
  const [posts, setPosts]       = useState([]);
  const [events, setEvents]     = useState([]);
  const [mentors, setMentors]   = useState([]);
  const [filter, setFilter]     = useState('For you');
  const [sortBy, setSortBy]     = useState('recent');   // recent | liked | discussed
  const [sortOpen, setSortOpen] = useState(false);
  const [loading, setLoading]   = useState(true);   // initial feed load

  // Per-post UI state
  const [openReplies, setOpenReplies] = useState({});   // postId -> true
  const [replyDrafts, setReplyDrafts] = useState({});

  // Modals
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTag,  setComposerTag]  = useState('Academic Help');
  const [composerAnon, setComposerAnon] = useState(false);
  const [chatPeer,     setChatPeer]     = useState(null);
  const [reportTarget, setReportTarget] = useState(null);   // { type, id }
  const [requestsOpen, setRequestsOpen] = useState(false);

  // Mentor requests (for the sidebar badge)
  const [requests, setRequests] = useState([]);

  // People the viewer follows (for the "Following" feed filter)
  const [followingIds, setFollowingIds] = useState(new Set());

  // Search
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);   // {posts,mentors,resources}
  const [searchFocus, setSearchFocus]     = useState(false);
  const searchTimer         = useRef(null);
  const globalTimer         = useRef(null);

  // ── Effects ───────────────────────────────────────────────────────
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  // Load who I follow (once) so the "Following" filter can work.
  useEffect(() => {
    if (!me?.id) return;
    pb.get(`/users/${me.id}/following`)
      .then((list) => setFollowingIds(new Set((list || []).map((u) => u.id))))
      .catch(() => {});
  }, [me?.id]);

  useEffect(() => {
    if (!isMentor) return;
    pb.get('/users/incoming-requests').then(setRequests).catch(() => {});
  }, [isMentor]);

  // Auto-collapse on scroll (matches the original UX). The expandLock ref
  // suppresses this for ~400ms after the user manually toggles the
  // sidebar - otherwise the grid-template-columns transition itself fires
  // a layout reflow scroll event that would immediately re-collapse what
  // they just opened ("opens then snaps shut" bug).
  const expandLock = useRef(false);
  useEffect(() => {
    let scheduled = false;
    function onScroll(e) {
      if (window.innerWidth <= 960) return;
      if (expandLock.current || scheduled) return;
      if (e.target.closest && e.target.closest('.snav, .feed-topnav')) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        setCollapsed((c) => {
          if (!c) sessionStorage.setItem('pb_sidebar', 'collapsed');
          return true;
        });
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

  async function loadAll() {
    try {
      const [postsRes, eventsRes, mentorsRes] = await Promise.all([
        pb.get('/posts'),
        pb.get('/events?upcoming=true'),
        pb.get('/users/mentors'),
      ]);
      setPosts(postsRes); setEvents(eventsRes); setMentors(mentorsRes);
    } catch (e) {
      toast('Failed to load feed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Filtering + sorting ───────────────────────────────────────────
  const SORT_LABELS = { recent: 'Recent', liked: 'Most liked', discussed: 'Most discussed' };

  const base =
    filter === 'For you'   ? posts :
    filter === 'Following' ? posts.filter((p) => followingIds.has(p.author_id)) :
    posts.filter((p) => (p.tag || '').toLowerCase().includes(filter.toLowerCase()));

  const filteredPosts = base.slice().sort((a, b) => {
    if (sortBy === 'liked')     return (b.likes_count    || 0) - (a.likes_count    || 0);
    if (sortBy === 'discussed') return (b.comments_count || 0) - (a.comments_count || 0);
    return new Date(b.created_at) - new Date(a.created_at);   // recent
  });

  // ── Action handlers ───────────────────────────────────────────────
  function debounceSearch(val) {
    clearTimeout(searchTimer.current);
    clearTimeout(globalTimer.current);
    setSearch(val);
    // Searching across all tags — reset the active tab so matches aren't
    // hidden by a category filter.
    if (val.trim()) setFilter('For you');
    else setSearchResults(null);

    searchTimer.current = setTimeout(async () => {
      if (!val.trim()) return loadAll();
      try { setPosts(await pb.get('/posts?search=' + encodeURIComponent(val))); }
      catch { /* silent */ }
    }, 400);

    // Global dropdown (posts + mentors + resources).
    globalTimer.current = setTimeout(async () => {
      if (val.trim().length < 2) { setSearchResults(null); return; }
      try { setSearchResults(await pb.get('/search?q=' + encodeURIComponent(val))); }
      catch { /* silent */ }
    }, 350);
  }

  async function deletePost(id) {
    try {
      await pb.del(`/posts/${id}`);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      toast(e.message || 'Failed to delete post');
    }
  }

  async function updatePost(id, fields) {
    try {
      const updated = await pb.patch(`/posts/${id}`, fields);
      setPosts((prev) => prev.map((p) => p.id === id ? { ...p, ...updated } : p));
    } catch (e) {
      toast(e.message || 'Failed to update post');
      throw e;
    }
  }

  async function toggleLike(id) {
    setPosts((prev) => prev.map((p) => p.id === id
      ? { ...p, liked: !p.liked, likes_count: p.likes_count + (p.liked ? -1 : 1) }
      : p));
    try { await pb.post(`/posts/${id}/like`); }
    catch { setPosts((prev) => prev.map((p) => p.id === id
      ? { ...p, liked: !p.liked, likes_count: p.likes_count + (p.liked ? -1 : 1) } : p)); }
  }

  async function toggleBookmark(id) {
    setPosts((prev) => prev.map((p) => p.id === id
      ? { ...p, bookmarked: !p.bookmarked, bookmarks_count: (p.bookmarks_count || 0) + (p.bookmarked ? -1 : 1) }
      : p));
    try { await pb.post(`/posts/${id}/bookmark`); }
    catch { setPosts((prev) => prev.map((p) => p.id === id
      ? { ...p, bookmarked: !p.bookmarked, bookmarks_count: (p.bookmarks_count || 0) + (p.bookmarked ? -1 : 1) } : p)); }
  }

  async function toggleReplies(id) {
    const wasOpen = !!openReplies[id];
    setOpenReplies((prev) => ({ ...prev, [id]: !wasOpen }));

    // Lazy-load replies the first time the user expands a thread.
    if (!wasOpen) {
      const post = posts.find((p) => p.id === id);
      if (post && !post.replies) {
        try {
          const replies = await pb.get(`/posts/${id}/replies`);
          setPosts((prev) => prev.map((p) => p.id === id ? { ...p, replies } : p));
        } catch { /* silent */ }
      }
    }
  }

  function setReplyDraft(id, val) {
    setReplyDrafts((prev) => ({ ...prev, [id]: val }));
  }

  async function postReply(postId) {
    const text = (replyDrafts[postId] || '').trim();
    if (!text) return;
    try {
      const reply = await pb.post(`/posts/${postId}/replies`, { text });
      setPosts((prev) => prev.map((p) => p.id === postId
        ? { ...p, replies: [...(p.replies || []), reply], comments_count: (p.comments_count || 0) + 1 }
        : p));
      setReplyDraft(postId, '');
    } catch {
      toast('Failed to post reply');
    }
  }

  // Nested reply (reply-to-reply). Returns the created reply for optimistic UI.
  async function nestedReply(postId, text, parentId) {
    const t = (text || '').trim();
    if (!t) return;
    try {
      const reply = await pb.post(`/posts/${postId}/replies`, { text: t, parent_id: parentId });
      setPosts((prev) => prev.map((p) => p.id === postId
        ? { ...p, replies: [...(p.replies || []), reply], comments_count: (p.comments_count || 0) + 1 }
        : p));
    } catch {
      toast('Failed to post reply');
    }
  }

  function shareLink(id) {
    navigator.clipboard?.writeText(`${location.origin}/?p=${id}`)
      .then(() => toast('Link copied!'));
  }

  function openComposer(tag, anon = false) {
    setComposerTag(tag || 'Academic Help');
    setComposerAnon(anon);
    setComposerOpen(true);
  }

  function toggleSidebar() {
    if (window.innerWidth <= 960) {
      setMobileNavOpen((open) => !open);
      return;
    }
    expandLock.current = true;
    setCollapsed((c) => {
      const next = !c;
      sessionStorage.setItem('pb_sidebar', next ? 'collapsed' : 'expanded');
      return next;
    });
    setTimeout(() => { expandLock.current = false; }, 400);
  }

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  async function respondRequest(reqId, status) {
    try {
      await pb.patch(`/users/mentorship-requests/${reqId}`, { status });
      setRequests((prev) => prev.filter((r) => r.id !== reqId));
      toast(status === 'accepted' ? 'Request accepted!' : 'Request declined.');
    } catch (e) {
      toast(e.message || 'Failed to update request');
    }
  }

  const initials = initialsOf(me?.name || 'You');

  return (
    <div className="feed">
      <ToastHost />

      <div className={`feed-app${collapsed ? ' sidebar-collapsed' : ''}${panelHidden ? ' panel-hidden' : ''}`}>
        {/* ── Topnav ─────────────────────────────────────────── */}
        <header className="feed-topnav">
          <button
            type="button"
            className={`feed-mobile-toggle${mobileNavOpen ? ' is-open' : ''}`}
            aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <Link to="/feed" className="feed-topnav-logo">
            <BridgeLogo width={38} height={26} variant="nav" />
            <span>Peer Bridge</span>
          </Link>

          <div className="search-bar" style={{ position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
                 stroke="rgba(255,255,255,.5)" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="6.5" cy="6.5" r="5" /><path d="M11 11l3 3" />
            </svg>
            <input
              type="text" placeholder="Search posts, mentors, resources…"
              value={search} onChange={(e) => debounceSearch(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setTimeout(() => setSearchFocus(false), 180)}
            />
            {searchFocus && searchResults && search.trim().length >= 2 && (
              <GlobalSearchDropdown
                results={searchResults}
                onPost={() => { setSearchFocus(false); }}
                onMentor={(id) => { setSearchFocus(false); navigate(`/profile?id=${id}`); }}
                onResource={() => { setSearchFocus(false); navigate('/resources'); }}
              />
            )}
          </div>

          <div className="topnav-right">
            <NotificationBell convos={convos} unreadMsgs={unreadMsgs} onNavigate={navigate} onMarkRead={markMsgsRead} />

            {/* Theme toggle — icon only, lives in the topnav */}
            <button
              className="icon-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
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

            <button className="panel-mobile-btn" onClick={() => setPanelHidden((hidden) => !hidden)}>
              {panelHidden ? 'Show panel' : 'Hide panel'}
            </button>

            <div className="user-chip" onClick={() => navigate('/profile')}>
              {me?.profile_image
                ? <img src={me.profile_image} alt={me.name}
                       style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#2563EB,#60A5FA)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: 'white',
                  }}>{initials}</div>}
              <div className="user-chip-name">{me?.name || 'You'}</div>
            </div>
          </div>
        </header>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <div className={`feed-mobile-backdrop${mobileNavOpen ? ' is-open' : ''}`} onClick={closeMobileNav} />
        <FeedSidebar
          isMentor={isMentor}
          collapsed={collapsed}
          requestsCount={requests.length}
          unreadMsgs={unreadMsgs}
          onToggle={toggleSidebar}
          onLogout={logout}
          onOpenRequests={() => setRequestsOpen(true)}
          onMarkMsgsRead={markMsgsRead}
          me={me}
          initials={initials}
          mobileNavOpen={mobileNavOpen}
          onNavigate={closeMobileNav}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* ── Main feed ─────────────────────────────────────── */}
        <main className="feed-main">
          <div className="feed-tabs">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`tab${filter === f.key ? ' active' : ''}`}
                onClick={() => setFilter(f.key)}
              >{f.label}</button>
            ))}
            <div className="sort-wrap" style={{ marginLeft: 'auto', position: 'relative' }}>
              <button className="sort-btn" style={{ marginLeft: 0 }} onClick={() => setSortOpen((o) => !o)}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                     stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M1 3h11M3 6.5h7M5 10h3" />
                </svg>
                Sort: {SORT_LABELS[sortBy]}
              </button>
              {sortOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 300 }} onClick={() => setSortOpen(false)} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 301,
                    minWidth: 180, background: 'var(--card)', border: '1.5px solid var(--line)',
                    borderRadius: 10, boxShadow: 'var(--shadow-lg, 0 16px 40px rgba(0,0,0,.2))',
                    overflow: 'hidden', padding: 4,
                  }}>
                    {Object.entries(SORT_LABELS).map(([key, label]) => (
                      <button key={key}
                        onClick={() => { setSortBy(key); setSortOpen(false); }}
                        style={{
                          width: '100%', textAlign: 'left', padding: '8px 12px',
                          borderRadius: 7, border: 'none', cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: 13, fontWeight: sortBy === key ? 700 : 500,
                          background: sortBy === key ? 'var(--blue-soft)' : 'transparent',
                          color: sortBy === key ? 'var(--blue)' : 'var(--ink-2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        }}>
                        {label}
                        {sortBy === key && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="composer-card composer-card-v2 composer-clean" onClick={() => openComposer()}>
            {me?.profile_image
              ? <img src={me.profile_image} alt={me.name}
                     style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#2563EB,#60A5FA)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: 'white', flexShrink: 0,
                }}>{initials}</div>}
            <span className="composer-placeholder">
              Share a question, insight, or update…
            </span>
            <span className="composer-write-chip">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
              Write
            </span>
          </div>

          {loading ? (
            <>{[0, 1, 2, 3].map((i) => <PostCardSkeleton key={i} />)}</>
          ) : filteredPosts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none"
                     stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M4 24a3 3 0 013-3H24" />
                  <path d="M7 3H24v22H7A3 3 0 014 22V6a3 3 0 013-3z" />
                </svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
                Your feed is quiet right now
              </div>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', maxWidth: 280, lineHeight: 1.65 }}>
                Be the first to ask a question or share something useful with your NUST community.
              </p>
              <button onClick={() => openComposer()} style={{
                marginTop: 20, padding: '10px 24px', border: 'none', borderRadius: 9,
                background: 'var(--blue)', color: 'white',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              }}>Post something -&gt;</button>
            </div>
          ) : (
            filteredPosts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                me={me}
                replies={p.replies || []}
                replyDraft={replyDrafts[p.id] || ''}
                repliesOpen={!!openReplies[p.id]}
                onLike={toggleLike}
                onBookmark={toggleBookmark}
                onToggleReplies={toggleReplies}
                onReplyDraftChange={setReplyDraft}
                onPostReply={postReply}
                onNestedReply={nestedReply}
                onMessageAuthor={(id, name) => setChatPeer({ id, name })}
                onReport={(type, id) => setReportTarget({ type, id })}
                onShare={shareLink}
                onProfileClick={(id) => navigate(`/profile?id=${id}`)}
                onDelete={deletePost}
                onUpdate={updatePost}
              />
            ))
          )}
        </main>

        {/* ── Right panel ───────────────────────────────────── */}
        <aside className="right-panel">
          <button className="panel-toggle-btn" onClick={() => setPanelHidden(true)} title="Hide panel">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Hide panel
          </button>

          <div className="panel-card">
            <div className="panel-card-header">
              <div className="panel-card-title">Top mentors this week</div>
              <Link to="/mentors" className="see-all">See all</Link>
            </div>
            {loading
              ? [0, 1, 2, 3].map((i) => <PanelRowSkeleton key={i} />)
              : mentors.length === 0
              ? <div className="empty-panel">No mentors found</div>
              : mentors.slice(0, 4).map((m) => (
                  <div key={m.id} className="mentor-row" onClick={() => setChatPeer({ id: m.id, name: m.name })}>
                    <div className="mr-av" style={{ background: gradientFor(m.name) }}>
                      {initialsOf(m.name)}
                      {m.is_online && (
                        <span style={{
                          position: 'absolute', bottom: 0, right: 0,
                          width: 9, height: 9, borderRadius: '50%',
                          background: '#22C55E', border: '2px solid white',
                        }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mr-name">{m.name}</div>
                      <div className="mr-dept">
                        {[m.department, m.graduation_year ? `'${String(m.graduation_year).slice(-2)}` : '',
                          m.rating ? `* ${m.rating}` : ''].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <span className="mr-tag">Mentor</span>
                  </div>
                ))}
          </div>

          <div className="panel-card">
            <div className="panel-card-header">
              <div className="panel-card-title">Upcoming</div>
              <Link to="/events" className="see-all">See all</Link>
            </div>
            {loading
              ? [0, 1, 2].map((i) => <PanelRowSkeleton key={i} />)
              : events.length === 0
              ? <div className="empty-panel">No upcoming events</div>
              : events.slice(0, 3).map((e) => {
                  const d = new Date(e.event_date);
                  return (
                    <div key={e.id} className="event-row">
                      <div className="event-date">
                        <div className="ev-month">{d.toLocaleString('en', { month: 'short' }).toUpperCase()}</div>
                        <div className="ev-day">{d.getDate()}</div>
                      </div>
                      <div>
                        <div className="ev-title">{e.title}</div>
                        <div className="ev-sub">{e.venue || ''}</div>
                      </div>
                    </div>
                  );
                })}
          </div>

          <div className="panel-card">
            <div className="panel-card-header">
              <div className="panel-card-title">Trending topics</div>
            </div>
            <div>{TRENDING.map((t) => (
              <span key={t} className="topic-pill" style={{ cursor: 'pointer' }}
                    onClick={() => debounceSearch(t.replace(/^#/, ''))}>{t}</span>
            ))}</div>
          </div>
        </aside>
      </div>

      {panelHidden && (
        <button className="panel-peek-tab" onClick={() => setPanelHidden(false)} title="Show panel">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {composerOpen && (
        <ComposerModal
          initialTag={composerTag}
          initialAnon={composerAnon}
          onClose={() => setComposerOpen(false)}
          onCreated={(post) => setPosts((prev) => [post, ...prev])}
        />
      )}

      {chatPeer && (
        <ChatOverlay
          peerId={chatPeer.id} peerName={chatPeer.name}
          onClose={() => setChatPeer(null)}
        />
      )}

      {reportTarget && (
        <ReportModal
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          onClose={() => setReportTarget(null)}
        />
      )}

      {requestsOpen && (
        <RequestsModal
          requests={requests}
          onRespond={respondRequest}
          onClose={() => setRequestsOpen(false)}
        />
      )}
    </div>
  );
}

/* ── Inline sidebar (uses .snav classes from shared.css) ─────────── */

function FeedSidebar({ isMentor, collapsed, requestsCount, unreadMsgs, onToggle, onLogout, onOpenRequests, onMarkMsgsRead, me, initials, mobileNavOpen, onNavigate, theme, onToggleTheme }) {
  return (
    <nav className={`snav${mobileNavOpen ? ' mobile-open' : ''}`}>
      <button className="snav-pin-btn" onClick={onToggle}
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
      <FeedNavLink to="/feed"      active label="Home" onNavigate={onNavigate} icon={<><path d="M3 12 12 4l9 8" /><path d="M5 10v10h14V10" /></>} />
      <FeedNavLink to="/mentors"   label="Mentors" onNavigate={onNavigate} icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>} />
      <FeedNavLink to="/resources" label="Resources" onNavigate={onNavigate} icon={<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z" />} />
      <FeedNavLink to="/events"    label="Events" onNavigate={onNavigate} icon={<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>} />
      <FeedNavLink to="/messages"  label="Messages" badge={unreadMsgs} onNavigate={() => { onNavigate(); onMarkMsgsRead(); }} icon={<path d="M14.5 10a1 1 0 0 1-1 1H4L1 14V3a1 1 0 0 1 1-1h11.5a1 1 0 0 1 1 1v7z" />} />
      <FeedNavLink to="/groups"    label="Study Groups" onNavigate={onNavigate} icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>} />
      <FeedNavLink to="/leaderboard" label="Leaderboard" onNavigate={onNavigate} icon={<><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h2a2 2 0 0 1 0 4h-2M7 5H5a2 2 0 0 0 0 4h2"/></>} />
      <FeedNavLink to="/saved"     label="Saved" onNavigate={onNavigate} icon={<path d="M5 3h12v18l-6-4-6 4V3Z" />} />

      {isMentor && (
        <>
          <div className="snav-section" style={{ marginTop: 8 }}>Mentorship</div>
          <button className="snav-item" type="button" onClick={() => { onNavigate(); onOpenRequests(); }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="m11 17 2 2a1 1 0 1 0 3-3" />
              <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
              <path d="m21 3 1 11h-2" /><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" /><path d="M3 4h8" />
            </svg>
            <span>Requests</span>
            {requestsCount > 0 && (
              <span style={{
                marginLeft: 'auto', background: '#EF4444', color: 'white',
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
              }}>{requestsCount}</span>
            )}
          </button>
        </>
      )}

      <div className="snav-section" style={{ marginTop: 8 }}>Account</div>
      <FeedNavLink to="/profile" label="My Profile" onNavigate={onNavigate} icon={
        <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3" />
          <path d="M7 20.66V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.66" /></>
      } />
      {me?.role === 'admin' && (
        <FeedNavLink to="/admin" label="Admin" onNavigate={onNavigate} icon={
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        } />
      )}

      <div className="snav-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(135deg,#2563EB,#60A5FA)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: 'white', flexShrink: 0,
          }}>{initials}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{me?.name || 'You'}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)' }}>{roleLabel(me?.role || 'student')}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{
          width: '100%', padding: 8,
          border: '1.5px solid rgba(255,255,255,.2)', borderRadius: 8,
          background: 'rgba(255,255,255,.08)', fontFamily: 'inherit',
          fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,.75)', cursor: 'pointer',
        }}>Sign out</button>
      </div>

      <button className="snav-signout-icon" onClick={onLogout} title="Sign out">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </nav>
  );
}

/* ── Notification bell (topnav) ─────────────────────────────────── */

function NotificationBell({ convos, unreadMsgs, onNavigate, onMarkRead }) {
  const [open, setOpen]     = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);
  const wrapRef = useRef(null);

  const unreadConvos = convos.filter(c => c.unread > 0);
  const totalUnread  = unreadMsgs + notifUnread;

  // Poll the unread activity count every 30s.
  useEffect(() => {
    let alive = true;
    async function tick() {
      try { const r = await pb.get('/notifications/unread-count'); if (alive) setNotifUnread(r.unread || 0); }
      catch { /* silent */ }
    }
    tick();
    const t = setInterval(tick, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Close dropdown when clicking outside.
  useEffect(() => {
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  async function openDropdown() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        const r = await pb.get('/notifications');
        setNotifs(r.items || []);
        if ((r.unread || 0) > 0) { await pb.post('/notifications/read', {}); setNotifUnread(0); }
      } catch { /* silent */ }
    }
  }

  function goToConvo(c) {
    setOpen(false);
    onMarkRead();
    onNavigate(`/messages?to=${c.id}&name=${encodeURIComponent(c.name)}`);
  }

  function goToNotif(n) {
    setOpen(false);
    if (n.entity_type === 'post')  onNavigate('/feed');
    else if (n.entity_type === 'user')  onNavigate(`/profile?id=${n.entity_id}`);
    else if (n.entity_type === 'group') onNavigate('/groups');
    else if (n.entity_type === 'event') onNavigate('/events');
  }

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button className="notif-bell-btn" onClick={openDropdown} title="Notifications">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {totalUnread > 0 && (
          <span className="notif-bell-badge">{totalUnread > 9 ? '9+' : totalUnread}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-head">
            <span className="notif-dropdown-title">Notifications</span>
            {totalUnread > 0 && (
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{totalUnread} unread</span>
            )}
          </div>

          {unreadConvos.length === 0 && notifs.length === 0 ? (
            <div className="notif-dropdown-empty">You're all caught up!</div>
          ) : (
            <>
              {unreadConvos.map(c => {
                const [bg, fg] = avatarColors(c.name);
                return (
                  <div key={`m-${c.id}`} className="notif-row" onClick={() => goToConvo(c)}>
                    <div className="notif-row-av" style={{ background: `linear-gradient(135deg,${bg},${bg}cc)`, color: fg }}>
                      {initialsOf(c.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="notif-row-name">{c.name}</div>
                      <div className="notif-row-preview">{c.last_message || 'New message'}</div>
                    </div>
                    <span className="notif-count-badge">{c.unread}</span>
                  </div>
                );
              })}
              {notifs.map(n => {
                const [bg, fg] = avatarColors(n.actor_name || '?');
                return (
                  <div key={n.id} className="notif-row"
                       style={{ opacity: n.is_read ? 0.72 : 1 }}
                       onClick={() => goToNotif(n)}>
                    <div className="notif-row-av" style={{ background: `linear-gradient(135deg,${bg},${bg}cc)`, color: fg }}>
                      {initialsOf(n.actor_name || '?')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="notif-row-preview" style={{ whiteSpace: 'normal' }}>
                        <strong style={{ color: 'var(--ink)' }}>{n.actor_name || 'Someone'}</strong> {n.text}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{timeAgo(n.created_at)}</div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          <div className="notif-dropdown-footer">
            <button onClick={() => { setOpen(false); onMarkRead(); onNavigate('/messages'); }}>View all messages</button>
          </div>
        </div>
      )}
    </div>
  );
}

function GlobalSearchDropdown({ results, onPost, onMentor, onResource }) {
  const { posts = [], mentors = [], resources = [] } = results || {};
  const empty = !posts.length && !mentors.length && !resources.length;

  const wrap = {
    position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 80,
    background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 12,
    boxShadow: '0 16px 48px rgba(0,0,0,.22)', overflow: 'hidden', maxHeight: 420, overflowY: 'auto',
    minWidth: 320,
  };
  const head = { padding: '8px 14px 4px', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em',
                 textTransform: 'uppercase', color: 'var(--ink-3)' };
  const row  = { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                 cursor: 'pointer', fontSize: 13, color: 'var(--ink)' };

  return (
    <div style={wrap} onMouseDown={(e) => e.preventDefault()}>
      {empty ? (
        <div style={{ padding: 18, textAlign: 'center', fontSize: 13, color: 'var(--ink-3)' }}>No matches found</div>
      ) : (
        <>
          {mentors.length > 0 && <div style={head}>Mentors</div>}
          {mentors.map(m => {
            const [bg, fg] = avatarColors(m.name);
            return (
              <div key={`u-${m.id}`} style={row} className="gs-row" onClick={() => onMentor(m.id)}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                              background: `linear-gradient(135deg,${bg},${bg}cc)`, color: fg,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 700 }}>{initialsOf(m.name)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{m.department || 'Mentor'}</div>
                </div>
              </div>
            );
          })}
          {posts.length > 0 && <div style={head}>Posts</div>}
          {posts.map(p => (
            <div key={`p-${p.id}`} style={row} className="gs-row" onClick={onPost}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{p.tag} · {p.author_name}</div>
              </div>
            </div>
          ))}
          {resources.length > 0 && <div style={head}>Resources</div>}
          {resources.map(r => (
            <div key={`r-${r.id}`} style={row} className="gs-row" onClick={onResource}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
              </svg>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{r.category || 'Resource'}{r.course_code ? ` · ${r.course_code}` : ''}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function FeedNavLink({ to, label, icon, active = false, badge = 0, onNavigate }) {
  return (
    <Link to={to} className={`snav-item${active ? ' active' : ''}`} onClick={onNavigate}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
      <span>{label}</span>
      {badge > 0 && (
        <span style={{
          marginLeft: 'auto', background: '#EF4444', color: 'white',
          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
        }}>{badge > 99 ? '99+' : badge}</span>
      )}
    </Link>
  );
}
