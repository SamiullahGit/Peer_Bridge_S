import { useEffect, useRef, useState } from 'react';

import Avatar              from './Avatar.jsx';
import { pb }              from '../api/client.js';
import { roleLabel }       from '../utils/role.js';
import { timeAgo }         from '../utils/time.js';
import { tagPalette, linkifyHTML } from '../utils/format.js';

const TAGS = ['Academic Help', 'Career', 'Resources', 'Events', 'General'];

// Reaction palette — keys must match backend REACTIONS array.
const REACTIONS = [
  { key: 'like',       emoji: '👍', label: 'Like' },
  { key: 'helpful',    emoji: '🔥', label: 'Helpful' },
  { key: 'love',       emoji: '❤️', label: 'Love' },
  { key: 'insightful', emoji: '💡', label: 'Insightful' },
  { key: 'celebrate',  emoji: '🎉', label: 'Celebrate' },
];
const reactionEmoji = (k) => (REACTIONS.find(r => r.key === k) || {}).emoji || '👍';

function TagPill({ tag }) {
  const [bg, fg] = tagPalette(tag);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 100,
      fontSize: 11.5, fontWeight: 600, background: bg, color: fg,
    }}>{tag}</span>
  );
}

function metaStr(p) {
  const role = p.author_role ? roleLabel(p.author_role) : '';
  const dept = p.department || '';
  const year = p.graduation_year ? `'${String(p.graduation_year).slice(-2)}` : '';
  return [role, dept + (year ? ' ' + year : '')].filter(Boolean).join(' · ');
}

export default function PostCard({
  post, me, replies = [], replyDraft = '',
  onLike, onBookmark, onToggleReplies, onReplyDraftChange, onPostReply,
  onMessageAuthor, onReport, onShare, onProfileClick,
  onDelete, onUpdate,
  repliesOpen,
}) {
  const [menuOpen, setMenuOpen]   = useState(false);
  const [editing,  setEditing]    = useState(false);
  const [editTag,  setEditTag]    = useState(post.tag);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody,  setEditBody]  = useState(post.body || '');
  const [saving,   setSaving]     = useState(false);
  const menuRef = useRef(null);

  // Reactions (local optimistic state, seeded from the feed payload).
  const [myReaction, setMyReaction]   = useState(post.my_reaction || null);
  const [reactCount, setReactCount]   = useState(post.reactions_count || 0);
  const [reactOpen,  setReactOpen]    = useState(false);
  const reactRef = useRef(null);

  // Reply likes (replyId -> liked bool, seeded false; counts tracked too).
  const [replyLikes, setReplyLikes]   = useState({});

  async function react(key) {
    setReactOpen(false);
    const prev = myReaction;
    // Optimistic: toggle off if same, else set/switch.
    if (prev === key) { setMyReaction(null); setReactCount(c => Math.max(0, c - 1)); }
    else { setMyReaction(key); if (!prev) setReactCount(c => c + 1); }
    try {
      const r = await pb.post(`/posts/${post.id}/react`, { emoji: key });
      setMyReaction(r.my_reaction);
    } catch {
      setMyReaction(prev);   // revert
    }
  }

  async function likeReply(r) {
    const cur = replyLikes[r.id];
    const liked = cur ? cur.liked : false;
    const base  = cur ? cur.count : (r.likes_count || 0);
    setReplyLikes(prev => ({ ...prev, [r.id]: { liked: !liked, count: base + (liked ? -1 : 1) } }));
    try { await pb.post(`/posts/replies/${r.id}/like`, {}); }
    catch { setReplyLikes(prev => ({ ...prev, [r.id]: { liked, count: base } })); }
  }

  useEffect(() => {
    if (!reactOpen) return;
    function onDown(e) { if (reactRef.current && !reactRef.current.contains(e.target)) setReactOpen(false); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [reactOpen]);

  const isAnon   = post.is_anonymous && post.author_id !== me?.id;
  const isMentor = !isAnon && post.author_role === 'mentor';
  const isOwn    = post.author_id === me?.id;
  const isOther  = !isOwn;

  // Close menu when clicking outside.
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  async function handleSave() {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      await onUpdate(post.id, { tag: editTag, title: editTitle.trim(), body: editBody });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    setMenuOpen(false);
    if (window.confirm('Delete this post? This cannot be undone.')) onDelete(post.id);
  }

  if (post.is_hidden) {
    return (
      <div className="post-card" data-id={post.id} style={{ textAlign: 'center', padding: '28px 20px' }}>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          This post has been flagged by the community.
        </p>
      </div>
    );
  }

  return (
    <div className="post-card" data-id={post.id}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {isAnon
          ? <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
          : <Avatar name={post.author_name} size={40} />
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            {isAnon ? (
              <span style={{ fontSize: 14, fontWeight: 700, color: '#7C3AED' }}>Anonymous</span>
            ) : (
              <span
                style={{ fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--ink)' }}
                onClick={() => onProfileClick(post.author_id)}
              >{post.author_name}</span>
            )}
            {isMentor && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px',
                             borderRadius: 100, background: 'var(--blue-soft,#EFF6FF)', color: 'var(--blue,#2563EB)' }}>MENTOR</span>
            )}
            {isAnon && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px',
                             borderRadius: 100, background: 'rgba(124,58,237,.1)', color: '#7C3AED' }}>ANON</span>
            )}
            {!isAnon && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{metaStr(post)}</span>}
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>· {timeAgo(post.created_at)}</span>
          </div>
          <div style={{ marginTop: 5 }}><TagPill tag={post.tag} /></div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          <button className={`act-btn${post.bookmarked ? ' saved' : ''}`}
                  onClick={() => onBookmark(post.id)}>
            <svg width="13" height="13" viewBox="0 0 24 24"
                 fill={post.bookmarked ? 'currentColor' : 'none'}
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 3h12v18l-6-4-6 4V3Z" />
            </svg>
            {post.bookmarked ? 'Saved' : 'Save'}
          </button>

          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              className="act-btn"
              style={{ padding: '6px 10px' }}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              title="More options"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5"  cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 36,
                background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 10,
                minWidth: 150, boxShadow: '0 8px 24px rgba(0,0,0,.15)',
                zIndex: 50, overflow: 'hidden',
              }}>
                {isOwn ? (
                  <>
                    <button
                      onClick={() => { setMenuOpen(false); setEditing(true); setEditTag(post.tag); setEditTitle(post.title); setEditBody(post.body || ''); }}
                      style={{ width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit post
                    </button>
                    <button
                      onClick={handleDelete}
                      style={{ width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      Delete post
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setMenuOpen(false); onReport('post', post.id); }}
                    style={{ width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  >Report post</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {editing ? (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select
            value={editTag} onChange={(e) => setEditTag(e.target.value)}
            style={{ padding: '8px 12px', border: '1.5px solid var(--line)', borderRadius: 9, fontFamily: 'inherit', fontSize: 13, background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer' }}
          >
            {TAGS.map(t => <option key={t}>{t}</option>)}
          </select>
          <input
            value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Title"
            style={{ padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 9, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--ink)', background: 'var(--card)' }}
          />
          <textarea
            value={editBody} onChange={(e) => setEditBody(e.target.value)}
            placeholder="Body (optional)"
            rows={4}
            style={{ padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 9, fontFamily: 'inherit', fontSize: 13.5, color: 'var(--ink)', background: 'var(--card)', resize: 'vertical', lineHeight: 1.55 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave} disabled={saving || !editTitle.trim()}
              style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#2563EB', color: 'white', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >{saving ? 'Saving…' : 'Save'}</button>
            <button
              onClick={() => setEditing(false)}
              style={{ padding: '8px 18px', borderRadius: 9, border: '1.5px solid var(--line)', background: 'var(--card)', color: 'var(--ink-2)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)',
                       margin: '14px 0 6px', lineHeight: 1.35 }}>{post.title}</h3>
          {post.body && (
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}
               dangerouslySetInnerHTML={{ __html: linkifyHTML(post.body) }} />
          )}
        </>
      )}
      {post.image_path && (
        <div style={{ marginTop: 14 }}>
          <img src={post.image_path} alt="Post"
               style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'cover',
                        borderRadius: 14, border: '1.5px solid var(--line)', background: 'var(--bg)' }} />
        </div>
      )}

      {post.has_poll && <PollBlock postId={post.id} />}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginTop: 14, paddingTop: 14, borderTop: '1.5px solid var(--line)', flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative' }} ref={reactRef}>
          <button
            className={`act-btn${myReaction ? ' liked' : ''}`}
            onClick={() => myReaction ? react(myReaction) : setReactOpen(o => !o)}
            onMouseEnter={() => setReactOpen(true)}
            title="React"
          >
            {myReaction ? (
              <span style={{ fontSize: 15, lineHeight: 1 }}>{reactionEmoji(myReaction)}</span>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10Z" />
              </svg>
            )}
            {reactCount > 0 ? reactCount : 'React'}
          </button>
          {reactOpen && (
            <div
              onMouseLeave={() => setReactOpen(false)}
              style={{
                position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 60,
                display: 'flex', gap: 2, padding: '6px 8px',
                background: 'var(--card)', border: '1.5px solid var(--line)',
                borderRadius: 999, boxShadow: '0 8px 24px rgba(0,0,0,.18)',
              }}>
              {REACTIONS.map(r => (
                <button key={r.key} title={r.label} onClick={() => react(r.key)}
                  style={{
                    border: 'none', background: myReaction === r.key ? 'var(--blue-soft)' : 'transparent',
                    cursor: 'pointer', fontSize: 19, lineHeight: 1, padding: '4px 5px', borderRadius: 999,
                    transition: 'transform .12s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.25)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >{r.emoji}</button>
              ))}
            </div>
          )}
        </div>

        <button className="act-btn" onClick={() => onToggleReplies(post.id)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12a8 8 0 01-8 8 8 8 0 01-3.5-.8L4 21l1.3-4.5A8 8 0 015 12a8 8 0 018-8 8 8 0 018 8Z" />
          </svg>
          {post.comments_count} {post.comments_count === 1 ? 'reply' : 'replies'}
        </button>

        {isOther && (
          <button className="act-btn" onClick={() => onMessageAuthor(post.author_id, post.author_name)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 12a8 8 0 01-8 8 8 8 0 01-3.5-.8L4 21l1.3-4.5A8 8 0 015 12a8 8 0 018-8 8 8 0 018 8Z" />
            </svg>
            Message
          </button>
        )}

        <div style={{ flex: 1 }} />

        <button className="act-btn" onClick={() => onShare(post.id)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
            <path d="M16 6l-4-4-4 4" />
            <path d="M12 2v14" />
          </svg>
          Share
        </button>
      </div>

      {repliesOpen && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1.5px dashed var(--line)' }}>
          {replies.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <Avatar name={r.author_name} size={30} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, flexWrap: 'wrap' }}>
                  <strong style={{ color: 'var(--ink)' }}>{r.author_name}</strong>
                  <span style={{ color: 'var(--ink-3)' }}>· {roleLabel(r.author_role)} · {timeAgo(r.created_at)}</span>
                  {r.author_role === 'mentor' && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px',
                                   borderRadius: 100, background: '#EFF6FF', color: '#2563EB' }}>MENTOR</span>
                  )}
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 3, color: 'var(--ink)' }}>{r.text}</div>
                <button
                  onClick={() => likeReply(r)}
                  style={{
                    marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 5,
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                    color: (replyLikes[r.id]?.liked) ? '#DC2626' : 'var(--ink-3)', padding: 0,
                  }}>
                  <svg width="12" height="12" viewBox="0 0 24 24"
                       fill={(replyLikes[r.id]?.liked) ? 'currentColor' : 'none'}
                       stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10Z" />
                  </svg>
                  {(replyLikes[r.id]?.count ?? r.likes_count ?? 0) || ''} Like
                </button>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <Avatar name={me?.name || '?'} size={30} />
            <input
              className="reply-input" value={replyDraft}
              placeholder="Write a helpful reply…"
              onChange={(e) => onReplyDraftChange(post.id, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onPostReply(post.id)}
            />
            <button className="send-btn" onClick={() => onPostReply(post.id)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22l-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Poll block — lazy-loads poll data, lets the viewer vote once ─────── */
function PollBlock({ postId }) {
  const [poll, setPoll]   = useState(null);
  const [busy, setBusy]   = useState(false);

  useEffect(() => {
    let alive = true;
    pb.get(`/posts/${postId}/poll`).then(p => { if (alive) setPoll(p); }).catch(() => {});
    return () => { alive = false; };
  }, [postId]);

  if (!poll) return null;
  const voted = poll.my_vote !== null && poll.my_vote !== undefined;
  const total = poll.total || 0;

  async function vote(i) {
    if (busy) return;
    setBusy(true);
    // Optimistic update.
    setPoll(prev => {
      const counts = prev.counts.slice();
      if (prev.my_vote !== null && prev.my_vote !== undefined) counts[prev.my_vote] = Math.max(0, counts[prev.my_vote] - 1);
      counts[i] += 1;
      const newTotal = (prev.my_vote === null || prev.my_vote === undefined) ? prev.total + 1 : prev.total;
      return { ...prev, counts, total: newTotal, my_vote: i };
    });
    try { await pb.post(`/posts/${postId}/poll/vote`, { option_index: i }); }
    catch { /* keep optimistic */ }
    finally { setBusy(false); }
  }

  return (
    <div style={{
      marginTop: 14, padding: 14, borderRadius: 12,
      border: '1.5px solid var(--line)', background: 'var(--bg)',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 10,
                    display: 'flex', alignItems: 'center', gap: 7 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round">
          <path d="M18 20V10M12 20V4M6 20v-6" />
        </svg>
        {poll.question}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {poll.options.map((opt, i) => {
          const count = poll.counts[i] || 0;
          const pct   = total ? Math.round((count / total) * 100) : 0;
          const mine  = poll.my_vote === i;
          return (
            <button key={i} onClick={() => vote(i)} disabled={busy}
              style={{
                position: 'relative', overflow: 'hidden',
                textAlign: 'left', padding: '9px 12px', borderRadius: 9,
                border: `1.5px solid ${mine ? 'var(--blue)' : 'var(--line)'}`,
                background: 'var(--card)', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)',
              }}>
              {voted && (
                <div style={{
                  position: 'absolute', inset: 0, width: `${pct}%`,
                  background: mine ? 'var(--blue-soft)' : 'var(--bg-2, #f1f5f9)',
                  transition: 'width .4s ease', zIndex: 0,
                }} />
              )}
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{mine ? '✓ ' : ''}{opt}</span>
                {voted && <span style={{ color: 'var(--ink-3)', fontWeight: 700 }}>{pct}%</span>}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8 }}>
        {total} {total === 1 ? 'vote' : 'votes'}{voted ? '' : ' · tap an option to vote'}
      </div>
    </div>
  );
}
