import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate }            from 'react-router-dom';

import { pb }            from '../api/client.js';
import { useAuth }       from '../context/AuthContext.jsx';
import { initialsOf }    from '../utils/avatar.js';
import { roleLabel }     from '../utils/role.js';
import { toast }         from '../components/Toast.jsx';

import BridgeLogo        from '../components/BridgeLogo.jsx';
import PostCard          from '../components/PostCard.jsx';
import ComposerModal     from '../components/ComposerModal.jsx';
import ChatOverlay       from '../components/ChatOverlay.jsx';
import ReportModal       from '../components/ReportModal.jsx';
import RequestsModal     from '../components/RequestsModal.jsx';
import ToastHost         from '../components/Toast.jsx';

import '../styles/feed.css';

const FILTERS = [
  { key: 'For you',   label: 'For you' },
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

  // Layout state
  const [collapsed, setCollapsed] = useState(() => sessionStorage.getItem('pb_sidebar') === 'collapsed');
  const [panelHidden, setPanelHidden] = useState(false);

  // Data
  const [posts, setPosts]       = useState([]);
  const [events, setEvents]     = useState([]);
  const [mentors, setMentors]   = useState([]);
  const [filter, setFilter]     = useState('For you');

  // Per-post UI state
  const [openReplies, setOpenReplies] = useState({});   // postId -> true
  const [replyDrafts, setReplyDrafts] = useState({});

  // Modals
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTag,  setComposerTag]  = useState('Academic Help');
  const [chatPeer,     setChatPeer]     = useState(null);
  const [reportTarget, setReportTarget] = useState(null);   // { type, id }
  const [requestsOpen, setRequestsOpen] = useState(false);

  // Mentor requests (for the sidebar badge)
  const [requests, setRequests] = useState([]);

  // Search
  const [search, setSearch] = useState('');
  const searchTimer         = useRef(null);

  // ── Effects ───────────────────────────────────────────────────────
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

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
    }
  }

  // ── Filtering ─────────────────────────────────────────────────────
  const filteredPosts = filter === 'For you'
    ? posts
    : posts.filter((p) => p.tag.toLowerCase().includes(filter.toLowerCase()));

  // ── Action handlers ───────────────────────────────────────────────
  function debounceSearch(val) {
    clearTimeout(searchTimer.current);
    setSearch(val);
    searchTimer.current = setTimeout(async () => {
      if (!val.trim()) return loadAll();
      try { setPosts(await pb.get('/posts?search=' + encodeURIComponent(val))); }
      catch { /* silent */ }
    }, 400);
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

  function shareLink(id) {
    navigator.clipboard?.writeText(`${location.origin}/?p=${id}`)
      .then(() => toast('Link copied!'));
  }

  function openComposer(tag) {
    setComposerTag(tag || 'Academic Help');
    setComposerOpen(true);
  }

  function toggleSidebar() {
    expandLock.current = true;
    setCollapsed((c) => {
      const next = !c;
      sessionStorage.setItem('pb_sidebar', next ? 'collapsed' : 'expanded');
      return next;
    });
    setTimeout(() => { expandLock.current = false; }, 400);
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
          <Link to="/feed" className="feed-topnav-logo">
            <BridgeLogo width={38} height={26} variant="nav" />
            <span>Peer Bridge</span>
          </Link>

          <div className="search-bar">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
                 stroke="rgba(255,255,255,.5)" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="6.5" cy="6.5" r="5" /><path d="M11 11l3 3" />
            </svg>
            <input
              type="text" placeholder="Search posts, mentors, resources…"
              value={search} onChange={(e) => debounceSearch(e.target.value)}
            />
          </div>

          <div className="topnav-right">
            <Link to="/messages" className="icon-btn">
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none"
                   stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M14.5 10.5a1 1 0 01-1 1H4L1 14.5V3a1 1 0 011-1h11.5a1 1 0 011 1v7.5z" />
              </svg>
            </Link>

            <button className="new-post-btn" onClick={() => openComposer()}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                   stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M7 2v10M2 7h10" />
              </svg>
              New post
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
        <FeedSidebar
          isMentor={isMentor}
          requestsCount={requests.length}
          onToggle={toggleSidebar}
          onLogout={logout}
          onOpenRequests={() => setRequestsOpen(true)}
          me={me}
          initials={initials}
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
            <button className="sort-btn">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
                   stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M1 3h11M3 6.5h7M5 10h3" />
              </svg>
              Sort: Recent
            </button>
          </div>

          <div className="composer" onClick={() => openComposer()}>
            {me?.profile_image
              ? <img src={me.profile_image} alt={me.name}
                     style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#2563EB,#60A5FA)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0,
                }}>{initials}</div>}
            <input type="text" placeholder="Ask a question, share a resource, or post an update…" readOnly />
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
              <button className="comp-btn" onClick={() => openComposer('Academic Help')}>Ask</button>
              <button className="comp-btn" onClick={() => openComposer('Resources')}>Share</button>
            </div>
          </div>

          {filteredPosts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none"
                     stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M4 24a3 3 0 013-3H24" />
                  <path d="M7 3H24v22H7A3 3 0 014 22V6a3 3 0 013-3z" />
                </svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1B2A', marginBottom: 8 }}>
                Your feed is quiet right now
              </div>
              <p style={{ fontSize: 14, color: '#4B5C73', maxWidth: 280, lineHeight: 1.65 }}>
                Be the first to ask a question or share something useful with your NUST community.
              </p>
              <button onClick={() => openComposer()} style={{
                marginTop: 20, padding: '10px 24px', border: 'none', borderRadius: 9,
                background: '#2563EB', color: 'white',
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
                onMessageAuthor={(id, name) => setChatPeer({ id, name })}
                onReport={(type, id) => setReportTarget({ type, id })}
                onShare={shareLink}
                onProfileClick={(id) => navigate(`/profile?id=${id}`)}
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
            {mentors.length === 0
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
            {events.length === 0
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
            <div>{TRENDING.map((t) => <span key={t} className="topic-pill">{t}</span>)}</div>
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

function FeedSidebar({ isMentor, requestsCount, onToggle, onLogout, onOpenRequests, me, initials }) {
  return (
    <nav className="snav">
      <button className="snav-pin-btn" onClick={onToggle} title="Toggle sidebar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <div className="snav-section">Main</div>
      <FeedNavLink to="/feed"      active label="Home" icon={<><path d="M3 12 12 4l9 8" /><path d="M5 10v10h14V10" /></>} />
      <FeedNavLink to="/mentors"   label="Mentors" icon={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>} />
      <FeedNavLink to="/resources" label="Resources" icon={<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z" />} />
      <FeedNavLink to="/events"    label="Events" icon={<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>} />
      <FeedNavLink to="/messages"  label="Messages" icon={<path d="M14.5 10a1 1 0 0 1-1 1H4L1 14V3a1 1 0 0 1 1-1h11.5a1 1 0 0 1 1 1v7z" />} />
      <FeedNavLink to="/saved"     label="Saved" icon={<path d="M5 3h12v18l-6-4-6 4V3Z" />} />

      {isMentor && (
        <>
          <div className="snav-section" style={{ marginTop: 8 }}>Mentorship</div>
          <button className="snav-item" type="button" onClick={onOpenRequests}>
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
      <FeedNavLink to="/profile" label="My Profile" icon={
        <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3" />
          <path d="M7 20.66V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.66" /></>
      } />

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

function FeedNavLink({ to, label, icon, active = false }) {
  return (
    <Link to={to} className={`snav-item${active ? ' active' : ''}`}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
      <span>{label}</span>
    </Link>
  );
}
