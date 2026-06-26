import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate }           from 'react-router-dom';

import { pb }                from '../api/client.js';
import { useAuth }           from '../context/AuthContext.jsx';
import { useNotifications }  from '../context/NotificationContext.jsx';
import { useTheme }          from '../context/ThemeContext.jsx';
import { initialsOf, avatarColors } from '../utils/avatar.js';
import { roleLabel }         from '../utils/role.js';
import { timeAgo }           from '../utils/time.js';
import { toast }             from '../components/Toast.jsx';
import ToastHost             from '../components/Toast.jsx';
import BridgeLogo            from '../components/BridgeLogo.jsx';

import '../styles/feed.css';

/* ── Topic colours ─────────────────────────────────────────────────── */
const TOPIC_COLORS = {
  'SEECS':           ['#2563EB','#EFF6FF'],
  'NUST Campus':     ['#7C3AED','#F5F3FF'],
  'Machine Learning':['#0891B2','#E0F2FE'],
  'GRE Prep':        ['#D97706','#FEF3C7'],
  'Internships':     ['#059669','#D1FAE5'],
  'FAST':            ['#DC2626','#FEE2E2'],
  'Project Teams':   ['#7C3AED','#F5F3FF'],
  'General':         ['#64748B','#F1F5F9'],
};
const TOPICS = Object.keys(TOPIC_COLORS);
function topicColor(topic) { return TOPIC_COLORS[topic] || ['#2563EB','#EFF6FF']; }

/* ── Small Avatar ──────────────────────────────────────────────────── */
function MiniAvatar({ name, image, size = 34 }) {
  const [bg] = avatarColors(name || '?');
  if (image) return (
    <img src={image} alt={name} style={{
      width: size, height: size, borderRadius: '50%',
      objectFit: 'cover', flexShrink: 0,
    }} />
  );
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg,${bg},${bg}cc)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: 'white',
    }}>{initialsOf(name || '?')}</div>
  );
}

/* ── Crown icon ────────────────────────────────────────────────────── */
function CrownIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#F59E0B"
         stroke="#D97706" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 20h20M4 20l2-9 6 4 6-4 2 9"/>
      <circle cx="4" cy="9" r="1.5" fill="#F59E0B"/>
      <circle cx="12" cy="5" r="1.5" fill="#F59E0B"/>
      <circle cx="20" cy="9" r="1.5" fill="#F59E0B"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Main page
   ═══════════════════════════════════════════════════════════════════════ */
export default function Groups() {
  const { user: me, logout }         = useAuth();
  const { unreadMsgs }               = useNotifications();
  const { theme }                    = useTheme();
  const navigate                     = useNavigate();
  const dark                         = theme === 'dark';

  /* Palette for groups-specific content (sidebar+topnav handled by feed.css) */
  const C = dark ? {
    panelBg:'#13161e', card:'#1a1e28', line:'#252a38',
    ink:'#e2e5f0', ink2:'#8892aa', ink3:'#555e78',
    inputBg:'#111318', chatBg:'#0e1017',
    blue:'#4f8ef7', blueSoft:'#1a233a',
    hover:'rgba(255,255,255,.04)',
    bubble:'#1d2235', bubbleBorder:'#2a2f42',
    red:'#f87171', redSoft:'#2a0f0f', redBorder:'#5c1a1a',
  } : {
    panelBg:'#f4f6fb', card:'#ffffff', line:'#e4eaf2',
    ink:'#0d1b2a', ink2:'#4b5c73', ink3:'#8899b0',
    inputBg:'#f4f7ff', chatBg:'#f8faff',
    blue:'#2563eb', blueSoft:'#eff6ff',
    hover:'rgba(0,0,0,.03)',
    bubble:'#ffffff', bubbleBorder:'#e4eaf2',
    red:'#dc2626', redSoft:'#fee2e2', redBorder:'#fecaca',
  };

  const [groups,        setGroups]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [activeGroup,   setActiveGroup]   = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [msgLoading,    setMsgLoading]    = useState(false);
  const [draft,         setDraft]         = useState('');
  const [sending,       setSending]       = useState(false);

  const [createOpen,    setCreateOpen]    = useState(false);
  const [infoOpen,      setInfoOpen]      = useState(false);
  const [joinBarOpen,   setJoinBarOpen]   = useState(false);
  const [joinCode,      setJoinCode]      = useState('');
  const [joining,       setJoining]       = useState(false);
  const [tab,           setTab]           = useState('mine');

  const [members,       setMembers]       = useState([]);
  const [membersLoading,setMembersLoading]= useState(false);

  const messagesEndRef = useRef(null);
  const pollRef        = useRef(null);
  const inputRef       = useRef(null);
  const initials       = initialsOf(me?.name || 'You');

  /* ── Data ─────────────────────────────────────────────────────────── */
  useEffect(() => { loadGroups(); }, []);

  useEffect(() => {
    if (!activeGroup) { setMessages([]); clearInterval(pollRef.current); return; }
    loadMessages(activeGroup.id);
    pollRef.current = setInterval(() => loadMessages(activeGroup.id, true), 5000);
    return () => clearInterval(pollRef.current);
  }, [activeGroup?.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (infoOpen && activeGroup) loadMembers(activeGroup.id);
  }, [infoOpen, activeGroup?.id]);

  async function loadGroups() {
    try { setGroups(await pb.get('/groups')); }
    catch { toast('Failed to load groups'); }
    finally { setLoading(false); }
  }

  async function loadMessages(groupId, silent = false) {
    if (!silent) setMsgLoading(true);
    try { setMessages(await pb.get(`/groups/${groupId}/messages`)); }
    catch { if (!silent) toast('Failed to load messages'); }
    finally { if (!silent) setMsgLoading(false); }
  }

  async function loadMembers(groupId) {
    setMembersLoading(true);
    try { setMembers(await pb.get(`/groups/${groupId}/members`)); }
    catch { toast('Failed to load members'); }
    finally { setMembersLoading(false); }
  }

  /* ── Actions ──────────────────────────────────────────────────────── */
  async function joinGroup(groupId, e) {
    e?.stopPropagation();
    try {
      const r = await pb.post(`/groups/${groupId}/join`, {});
      setGroups(prev => prev.map(g => g.id === groupId
        ? { ...g, is_member: true, my_role: 'member', member_count: r.member_count ?? g.member_count + 1 } : g));
      toast('Joined!');
    } catch (err) { toast(err.message || 'Failed to join'); }
  }

  async function leaveGroup(groupId, e) {
    e?.stopPropagation();
    if (!window.confirm('Leave this group?')) return;
    try {
      await pb.del(`/groups/${groupId}/join`);
      setGroups(prev => prev.map(g => g.id === groupId
        ? { ...g, is_member: false, my_role: null, member_count: Math.max(0, g.member_count - 1) } : g));
      if (activeGroup?.id === groupId) { setActiveGroup(null); setInfoOpen(false); }
      toast('Left group.');
    } catch (err) { toast(err.message || 'Failed to leave'); }
  }

  async function joinByCode() {
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const g = await pb.post('/groups/join-by-code', { code: joinCode.trim() });
      setGroups(prev => {
        const exists = prev.find(x => x.id === g.id);
        return exists ? prev.map(x => x.id === g.id ? g : x) : [g, ...prev];
      });
      setJoinBarOpen(false); setJoinCode('');
      setActiveGroup(g);
      toast('Joined via code!');
    } catch (err) { toast(err.message || 'Invalid code'); }
    finally { setJoining(false); }
  }

  async function sendMessage(e) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || !activeGroup) return;
    setSending(true); setDraft('');
    try {
      const msg = await pb.post(`/groups/${activeGroup.id}/messages`, { text });
      setMessages(prev => [...prev, msg]);
    } catch (err) { toast(err.message || 'Failed to send'); setDraft(text); }
    finally { setSending(false); inputRef.current?.focus(); }
  }

  async function kickMember(userId) {
    if (!window.confirm('Remove this member?')) return;
    try {
      await pb.del(`/groups/${activeGroup.id}/members/${userId}`);
      setMembers(prev => prev.filter(m => m.id !== userId));
      setGroups(prev => prev.map(g => g.id === activeGroup.id
        ? { ...g, member_count: Math.max(0, g.member_count - 1) } : g));
      toast('Member removed.');
    } catch (err) { toast(err.message || 'Failed'); }
  }

  async function changeRole(userId, newRole) {
    try {
      await pb.patch(`/groups/${activeGroup.id}/members/${userId}/role`, { role: newRole });
      setMembers(prev => prev.map(m => m.id === userId ? { ...m, group_role: newRole } : m));
      toast(newRole === 'admin' ? 'Promoted to admin' : 'Demoted to member');
    } catch (err) { toast(err.message || 'Failed'); }
  }

  async function deleteGroup() {
    if (!window.confirm(`Delete "${activeGroup?.name}"? This cannot be undone.`)) return;
    try {
      await pb.del(`/groups/${activeGroup.id}`);
      setGroups(prev => prev.filter(g => g.id !== activeGroup.id));
      setActiveGroup(null); setInfoOpen(false);
      toast('Group deleted.');
    } catch (err) { toast(err.message || 'Failed'); }
  }

  function copyCode(code) {
    navigator.clipboard?.writeText(code).then(() => toast('Invite code copied!'));
  }

  const displayedGroups = groups.filter(g => g.is_member);
  const amAdmin         = activeGroup?.my_role === 'admin';

  /* ════════════════════════════════════════════════════════════════════
     RENDER — uses same feed-app grid as Feed page → sidebar appears
     ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="feed">
      <ToastHost />

      {/* panel-hidden removes right rail → 220px sidebar + 1fr content */}
      <div className="feed-app panel-hidden">

        {/* ── Topnav — NO theme toggle (Feed page only) ────────── */}
        <header className="feed-topnav">
          <Link to="/feed" className="feed-topnav-logo">
            <BridgeLogo width={38} height={26} variant="nav" />
            <span>Peer Bridge</span>
          </Link>
          <div style={{ flex: 1, padding: '0 20px' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,.7)' }}>
              Study Groups
            </span>
          </div>
          <div className="topnav-right">
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

        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <GroupsNav me={me} initials={initials} unreadMsgs={unreadMsgs} onLogout={logout} />

        {/* ── Groups content (left list + chat + optional info panel) ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: infoOpen && activeGroup ? '280px 1fr 296px' : '280px 1fr',
          overflow: 'hidden',
        }}>

          {/* ══ LEFT: Group list panel ══════════════════════════════ */}
          <div style={{
            background: C.card,
            borderRight: `1px solid ${C.line}`,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{ padding: '13px 13px 9px', borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: C.ink }}>Study Groups</span>
                <button onClick={() => setCreateOpen(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 8, border: 'none',
                  background: C.blue, color: 'white',
                  fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                }}>
                  <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M7 2v10M2 7h10"/>
                  </svg>
                  New
                </button>
              </div>

              {/* Join-by-code toggle */}
              <button onClick={() => setJoinBarOpen(v => !v)} style={{
                width: '100%', padding: '6px 11px', borderRadius: 8,
                marginBottom: joinBarOpen ? 6 : 0,
                border: `1.5px solid ${joinBarOpen ? C.blue : C.line}`,
                background: joinBarOpen ? C.blueSoft : 'transparent',
                color: joinBarOpen ? C.blue : C.ink2,
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7, transition: 'all .15s',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M15 7h3a5 5 0 0 1 0 10h-3m-6 0H6a5 5 0 0 1 0-10h3"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
                Join with invite code
              </button>
              {joinBarOpen && (
                <div style={{ display: 'flex', gap: 5, marginBottom: 7 }}>
                  <input
                    autoFocus value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && joinByCode()}
                    placeholder="8-char code…"
                    maxLength={8}
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: 8,
                      border: `1.5px solid ${C.line}`,
                      background: C.inputBg, color: C.ink,
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 13, fontWeight: 700, letterSpacing: 3,
                      outline: 'none', textTransform: 'uppercase',
                    }}
                  />
                  <button onClick={joinByCode} disabled={joinCode.length < 4 || joining} style={{
                    padding: '7px 12px', borderRadius: 8, border: 'none',
                    background: joinCode.length >= 4 ? C.blue : C.line,
                    color: joinCode.length >= 4 ? 'white' : C.ink3,
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                    cursor: joinCode.length >= 4 ? 'pointer' : 'default',
                  }}>{joining ? '…' : 'Join'}</button>
                </div>
              )}

              {/* My groups label */}
              <div style={{
                fontSize: 10.5, fontWeight: 700, color: C.ink3,
                textTransform: 'uppercase', letterSpacing: '.06em', padding: '3px 2px',
              }}>My groups</div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ padding: '11px 13px', display: 'flex', gap: 9 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 9, background: C.line, flexShrink: 0 }}/>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ height: 11, width: '60%', background: C.line, borderRadius: 5 }}/>
                        <div style={{ height: 9, width: '40%', background: C.line, borderRadius: 5 }}/>
                      </div>
                    </div>
                  ))
                : displayedGroups.length === 0
                ? (
                  <div style={{ padding: 26, textAlign: 'center', color: C.ink3, fontSize: 13 }}>
                    Join a group via invite code or create your own.
                  </div>
                )
                : displayedGroups.map(g => {
                    const [tc] = topicColor(g.topic);
                    const isActive = activeGroup?.id === g.id;
                    return (
                      <div
                        key={g.id}
                        onClick={() => g.is_member && setActiveGroup(g)}
                        style={{
                          padding: '9px 13px',
                          cursor: g.is_member ? 'pointer' : 'default',
                          background: isActive
                            ? (dark ? '#1b2236' : '#eff6ff')
                            : 'transparent',
                          borderLeft: `3px solid ${isActive ? C.blue : 'transparent'}`,
                          borderBottom: `1px solid ${C.line}`,
                          transition: 'background .12s',
                          display: 'flex', gap: 9, alignItems: 'center',
                        }}
                      >
                        <div style={{
                          width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                          background: `${tc}18`, border: `1.5px solid ${tc}35`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tc} strokeWidth="1.8" strokeLinecap="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                          </svg>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            <span style={{
                              fontSize: 13, fontWeight: 700, color: C.ink,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{g.name}</span>
                            {g.my_role === 'admin' && <CrownIcon size={11}/>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {g.topic && (
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: '1px 5px',
                                borderRadius: 100, background: `${tc}18`, color: tc, flexShrink: 0,
                              }}>{g.topic}</span>
                            )}
                            <span style={{ fontSize: 11, color: C.ink3 }}>{g.member_count || 0} members</span>
                          </div>
                        </div>

                        <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
                          {!g.is_member ? (
                            <button onClick={e => joinGroup(g.id, e)} style={{
                              padding: '4px 10px', borderRadius: 7, border: 'none',
                              background: C.blue, color: 'white',
                              fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            }}>Join</button>
                          ) : (
                            <button onClick={e => leaveGroup(g.id, e)} style={{
                              padding: '4px 10px', borderRadius: 7,
                              background: 'transparent',
                              border: `1.5px solid ${C.line}`,
                              color: C.ink2,
                              fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            }}>Leave</button>
                          )}
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          </div>

          {/* ══ CENTRE: Chat ════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.chatBg }}>
            {!activeGroup ? (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 14, padding: 40,
              }}>
                <div style={{
                  width: 66, height: 66, borderRadius: 20,
                  background: dark ? '#1a233a' : '#eff6ff',
                  border: `1.5px solid ${dark ? '#1e2d4a' : '#dbeafe'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="1.6" strokeLinecap="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 6 }}>
                    Select a group to start chatting
                  </div>
                  <p style={{ fontSize: 13, color: C.ink3, maxWidth: 250, lineHeight: 1.6, margin: 0 }}>
                    Join or create a study group to collaborate in real time.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setJoinBarOpen(true)} style={{
                    padding: '8px 16px', borderRadius: 9,
                    border: `1.5px solid ${C.blue}`,
                    background: 'transparent', color: C.blue,
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>Join with code</button>
                  <button onClick={() => setCreateOpen(true)} style={{
                    padding: '8px 16px', borderRadius: 9, border: 'none',
                    background: C.blue, color: 'white',
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>Create a group</button>
                </div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div style={{
                  padding: '10px 15px',
                  borderBottom: `1px solid ${C.line}`,
                  background: C.card,
                  display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
                }}>
                  <div style={{
                    width: 37, height: 37, borderRadius: 9, flexShrink: 0,
                    background: `${topicColor(activeGroup.topic)[0]}18`,
                    border: `1.5px solid ${topicColor(activeGroup.topic)[0]}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={topicColor(activeGroup.topic)[0]} strokeWidth="1.8" strokeLinecap="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{activeGroup.name}</span>
                      {amAdmin && <CrownIcon size={12}/>}
                    </div>
                    <div style={{ fontSize: 11, color: C.ink3 }}>
                      {activeGroup.member_count || 0} members
                      {activeGroup.topic ? ` · ${activeGroup.topic}` : ''}
                    </div>
                  </div>
                  <button onClick={() => setInfoOpen(v => !v)} title="Group info" style={{
                    width: 33, height: 33, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1.5px solid ${infoOpen ? C.blue : C.line}`,
                    background: infoOpen ? C.blueSoft : 'transparent',
                    color: infoOpen ? C.blue : C.ink2, cursor: 'pointer',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </button>
                </div>

                {/* Messages */}
                <div style={{
                  flex: 1, overflowY: 'auto', padding: '13px 15px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  {msgLoading ? (
                    <div style={{ textAlign: 'center', color: C.ink3, paddingTop: 40, fontSize: 13 }}>Loading…</div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', paddingTop: 60 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, marginBottom: 5 }}>No messages yet</div>
                      <div style={{ fontSize: 12.5, color: C.ink3 }}>Say hello to start the conversation!</div>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isMe     = msg.sender_id === me?.id;
                      const prevSame = idx > 0 && messages[idx - 1].sender_id === msg.sender_id;
                      return (
                        <div key={msg.id} style={{
                          display: 'flex', gap: 7,
                          flexDirection: isMe ? 'row-reverse' : 'row',
                          alignItems: 'flex-end',
                          marginTop: prevSame ? 1 : 6,
                        }}>
                          {!isMe && (
                            prevSame
                              ? <div style={{ width: 24, flexShrink: 0 }}/>
                              : <MiniAvatar name={msg.sender_name} image={msg.sender_image} size={24}/>
                          )}
                          <div style={{ maxWidth: '66%' }}>
                            {!isMe && !prevSame && (
                              <div style={{ fontSize: 10.5, fontWeight: 600, color: C.ink2, marginBottom: 2, paddingLeft: 2 }}>
                                {msg.sender_name}
                              </div>
                            )}
                            <div style={{
                              padding: '7px 11px',
                              borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                              background: isMe ? C.blue : C.bubble,
                              color: isMe ? 'white' : C.ink,
                              fontSize: 13.5, lineHeight: 1.5,
                              border: isMe ? 'none' : `1px solid ${C.bubbleBorder}`,
                              wordBreak: 'break-word',
                            }}>{msg.text}</div>
                            <div style={{
                              fontSize: 9.5, color: C.ink3, marginTop: 2,
                              textAlign: isMe ? 'right' : 'left', paddingInline: 3,
                            }}>{timeAgo(msg.created_at)}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef}/>
                </div>

                {/* Input */}
                <div style={{
                  padding: '9px 13px',
                  borderTop: `1px solid ${C.line}`,
                  background: C.card, flexShrink: 0,
                }}>
                  <form onSubmit={sendMessage} style={{ display: 'flex', gap: 7 }}>
                    <input
                      ref={inputRef}
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder={`Message ${activeGroup.name}…`}
                      style={{
                        flex: 1, padding: '9px 12px', borderRadius: 9,
                        border: `1.5px solid ${C.line}`,
                        background: C.inputBg, color: C.ink,
                        fontFamily: 'inherit', fontSize: 13.5, outline: 'none',
                      }}
                    />
                    <button type="submit" disabled={!draft.trim() || sending} style={{
                      padding: '9px 15px', borderRadius: 9, border: 'none', flexShrink: 0,
                      background: draft.trim() ? C.blue : C.line,
                      color: draft.trim() ? 'white' : C.ink3,
                      fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                      cursor: draft.trim() ? 'pointer' : 'default',
                      transition: 'background .15s',
                    }}>{sending ? '…' : 'Send'}</button>
                  </form>
                </div>
              </>
            )}
          </div>

          {/* ══ RIGHT: Info panel (WhatsApp-style) ══════════════════ */}
          {infoOpen && activeGroup && (
            <div style={{
              borderLeft: `1px solid ${C.line}`,
              background: C.card,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
              <div style={{
                padding: '11px 13px',
                borderBottom: `1px solid ${C.line}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: C.ink }}>Group Info</span>
                <button onClick={() => setInfoOpen(false)} style={{
                  width: 27, height: 27, borderRadius: 7,
                  border: `1.5px solid ${C.line}`, background: 'transparent',
                  color: C.ink2, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M2 2l10 10M12 2 2 12"/>
                  </svg>
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {/* Identity */}
                <div style={{ padding: '16px 13px 11px', borderBottom: `1px solid ${C.line}`, textAlign: 'center' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 15, margin: '0 auto 9px',
                    background: `${topicColor(activeGroup.topic)[0]}18`,
                    border: `2px solid ${topicColor(activeGroup.topic)[0]}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={topicColor(activeGroup.topic)[0]} strokeWidth="1.7" strokeLinecap="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: C.ink, marginBottom: 4 }}>{activeGroup.name}</div>
                  {activeGroup.topic && (
                    <span style={{
                      fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
                      background: `${topicColor(activeGroup.topic)[0]}18`,
                      color: topicColor(activeGroup.topic)[0],
                    }}>{activeGroup.topic}</span>
                  )}
                  {activeGroup.description && (
                    <p style={{ fontSize: 11.5, color: C.ink2, marginTop: 7, lineHeight: 1.55 }}>
                      {activeGroup.description}
                    </p>
                  )}
                  <div style={{ fontSize: 11, color: C.ink3, marginTop: 5 }}>
                    {activeGroup.member_count || 0} members
                  </div>
                </div>

                {/* Invite code */}
                <div style={{ padding: '11px 13px', borderBottom: `1px solid ${C.line}` }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: C.ink3,
                    textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 7,
                  }}>Invite Code</div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 11px', borderRadius: 9,
                    background: C.inputBg, border: `1.5px solid ${C.line}`,
                  }}>
                    <span style={{
                      flex: 1,
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 16, fontWeight: 800, color: C.blue, letterSpacing: 4,
                    }}>{activeGroup.invite_code || '——'}</span>
                    <button onClick={() => copyCode(activeGroup.invite_code)} style={{
                      padding: '4px 9px', borderRadius: 6,
                      background: C.blue, color: 'white', border: 'none',
                      fontFamily: 'inherit', fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                    }}>Copy</button>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.ink3, marginTop: 5 }}>
                    Share this code so others can join directly.
                  </div>
                </div>

                {/* Members */}
                <div style={{ padding: '11px 13px' }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: C.ink3,
                    textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 9,
                  }}>
                    Members ({members.length || '…'})
                  </div>
                  {membersLoading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.line, flexShrink: 0 }}/>
                          <div style={{ flex: 1, height: 10, background: C.line, borderRadius: 5 }}/>
                        </div>
                      ))
                    : members.map(m => {
                        const isAdmin = m.group_role === 'admin';
                        const isSelf  = m.id === me?.id;
                        return (
                          <div key={m.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                            borderBottom: `1px solid ${C.line}`,
                          }}>
                            <MiniAvatar name={m.name} image={m.profile_image} size={30}/>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{
                                  fontSize: 12, fontWeight: 600, color: C.ink,
                                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>{m.name}{isSelf ? ' (you)' : ''}</span>
                                {isAdmin && <CrownIcon size={11}/>}
                              </div>
                              <div style={{ fontSize: 10, color: C.ink3 }}>
                                {isAdmin ? 'Admin' : 'Member'}
                                {m.department ? ` · ${m.department}` : ''}
                              </div>
                            </div>
                            {amAdmin && !isSelf && (
                              <MemberMenu
                                C={C} isAdmin={isAdmin}
                                onKick={() => kickMember(m.id)}
                                onPromote={() => changeRole(m.id, isAdmin ? 'member' : 'admin')}
                              />
                            )}
                          </div>
                        );
                      })
                  }
                </div>
              </div>

              {/* Footer — delete (admin) or leave (member) */}
              <div style={{ padding: '9px 13px', borderTop: `1px solid ${C.line}`, flexShrink: 0 }}>
                <button
                  onClick={amAdmin ? deleteGroup : e => leaveGroup(activeGroup.id, e)}
                  style={{
                    width: '100%', padding: '9px', borderRadius: 9,
                    background: C.redSoft,
                    border: `1.5px solid ${C.redBorder}`,
                    color: C.red,
                    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {amAdmin ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                      </svg>
                      Delete group
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Leave group
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create group modal */}
      {createOpen && (
        <CreateGroupModal
          C={C} dark={dark}
          onClose={() => setCreateOpen(false)}
          onCreate={g => {
            setGroups(prev => [g, ...prev]);
            setCreateOpen(false);
            setActiveGroup(g);
            toast('Group created!');
          }}
        />
      )}
    </div>
  );
}

/* ── Sidebar — identical nav to Feed, Study Groups active ─────────── */
function GroupsNav({ me, initials, unreadMsgs, onLogout }) {
  return (
    <nav className="snav">
      <div className="snav-section">Main</div>

      <Link to="/feed"      className="snav-item">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12 12 4l9 8"/><path d="M5 10v10h14V10"/>
        </svg>
        <span>Home</span>
      </Link>
      <Link to="/mentors"   className="snav-item">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span>Mentors</span>
      </Link>
      <Link to="/resources" className="snav-item">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"/>
        </svg>
        <span>Resources</span>
      </Link>
      <Link to="/events"    className="snav-item">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>
        </svg>
        <span>Events</span>
      </Link>
      <Link to="/groups" className="snav-item active">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span>Study Groups</span>
      </Link>
      <Link to="/messages"  className="snav-item">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 10a1 1 0 0 1-1 1H4L1 14V3a1 1 0 0 1 1-1h11.5a1 1 0 0 1 1 1v7z"/>
        </svg>
        <span>Messages</span>
        {unreadMsgs > 0 && (
          <span style={{
            marginLeft: 'auto', background: '#EF4444', color: 'white',
            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
          }}>{unreadMsgs > 99 ? '99+' : unreadMsgs}</span>
        )}
      </Link>
      <Link to="/saved"     className="snav-item">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 3h12v18l-6-4-6 4V3Z"/>
        </svg>
        <span>Saved</span>
      </Link>

      <div className="snav-section" style={{ marginTop: 8 }}>Account</div>
      <Link to="/profile" className="snav-item">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/>
          <path d="M7 20.66V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.66"/>
        </svg>
        <span>My Profile</span>
      </Link>

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
    </nav>
  );
}

/* ── Admin member context menu ─────────────────────────────────────── */
function MemberMenu({ C, isAdmin, onKick, onPromote }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: 24, height: 24, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${C.line}`, background: 'transparent',
        color: C.ink3, cursor: 'pointer',
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 28, zIndex: 60,
          background: C.card, border: `1.5px solid ${C.line}`,
          borderRadius: 10, minWidth: 152,
          boxShadow: '0 8px 24px rgba(0,0,0,.2)', overflow: 'hidden',
        }}>
          <button onClick={() => { setOpen(false); onPromote(); }} style={{
            width: '100%', padding: '8px 12px', textAlign: 'left', border: 'none',
            background: 'transparent', color: C.ink,
            fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <CrownIcon size={11}/>{isAdmin ? 'Remove admin' : 'Make admin'}
          </button>
          <button onClick={() => { setOpen(false); onKick(); }} style={{
            width: '100%', padding: '8px 12px', textAlign: 'left', border: 'none',
            background: 'transparent', color: C.red,
            fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            borderTop: `1px solid ${C.line}`,
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <line x1="17" y1="8" x2="23" y2="14"/><line x1="23" y1="8" x2="17" y2="14"/>
            </svg>
            Remove from group
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Create group modal ────────────────────────────────────────────── */
function CreateGroupModal({ C, dark, onClose, onCreate }) {
  const [name,   setName]   = useState('');
  const [desc,   setDesc]   = useState('');
  const [topic,  setTopic]  = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const g = await pb.post('/groups', {
        name: name.trim(), description: desc.trim() || null, topic: topic || null,
      });
      onCreate(g);
    } catch (err) { toast(err.message || 'Failed to create group'); }
    finally { setSaving(false); }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: dark ? 'rgba(0,0,0,.75)' : 'rgba(13,27,42,.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: C.card, borderRadius: 18, width: '100%', maxWidth: 454,
        boxShadow: '0 24px 80px rgba(0,0,0,.25)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 17px', borderBottom: `1.5px solid ${C.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>Create a study group</span>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7, border: `1.5px solid ${C.line}`,
            background: 'transparent', color: C.ink2, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M2 2l10 10M12 2 2 12"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleCreate} style={{ padding: 17 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.ink3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
            Group name *
          </label>
          <input
            value={name} onChange={e => setName(e.target.value)} required autoFocus
            placeholder="e.g. ML Study Circle"
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 9,
              border: `1.5px solid ${C.line}`, background: C.inputBg, color: C.ink,
              fontFamily: 'inherit', fontSize: 13.5, outline: 'none',
              boxSizing: 'border-box', marginBottom: 11,
            }}
          />
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.ink3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
            Description
          </label>
          <textarea
            value={desc} onChange={e => setDesc(e.target.value)} rows={3}
            placeholder="What will this group study or discuss?"
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 9,
              border: `1.5px solid ${C.line}`, background: C.inputBg, color: C.ink,
              fontFamily: 'inherit', fontSize: 13, resize: 'vertical', outline: 'none',
              boxSizing: 'border-box', marginBottom: 11,
            }}
          />
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.ink3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 7 }}>
            Topic
          </label>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 17 }}>
            {TOPICS.map(t => (
              <button key={t} type="button" onClick={() => setTopic(t === topic ? '' : t)} style={{
                padding: '4px 10px', borderRadius: 100, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
                border: `1.5px solid ${topic === t ? C.blue : C.line}`,
                background: topic === t ? C.blueSoft : 'transparent',
                color: topic === t ? C.blue : C.ink2,
              }}>{t}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 16px', borderRadius: 9,
              border: `1.5px solid ${C.line}`, background: 'transparent',
              color: C.ink2, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Cancel</button>
            <button type="submit" disabled={!name.trim() || saving} style={{
              padding: '8px 18px', borderRadius: 9, border: 'none',
              background: name.trim() ? C.blue : C.line,
              color: name.trim() ? 'white' : C.ink3,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              cursor: name.trim() ? 'pointer' : 'default', opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Creating…' : 'Create group'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
