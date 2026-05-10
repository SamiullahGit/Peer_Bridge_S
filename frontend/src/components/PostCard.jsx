import { useState } from 'react';

import Avatar              from './Avatar.jsx';
import { roleLabel }       from '../utils/role.js';
import { timeAgo }         from '../utils/time.js';
import { tagPalette, linkifyHTML } from '../utils/format.js';

// Single post card. Self-contained: owns its own "more menu" toggle so
// the parent feed only deals with arrays of posts and high-level
// callbacks (onLike, onBookmark, etc.).

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
  repliesOpen,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isMentor = post.author_role === 'mentor';
  const isOther  = post.author_id !== me?.id;

  if (post.is_hidden) {
    return (
      <div className="post-card" data-id={post.id} style={{ textAlign: 'center', padding: '28px 20px' }}>
        <p style={{ fontSize: 14, color: '#8899B0', fontStyle: 'italic' }}>
          This post has been flagged by the community.
        </p>
      </div>
    );
  }

  return (
    <div className="post-card" data-id={post.id}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Avatar name={post.author_name} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span
              style={{ fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#0D1B2A' }}
              onClick={() => onProfileClick(post.author_id)}
            >{post.author_name}</span>
            {isMentor && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px',
                             borderRadius: 100, background: '#EFF6FF', color: '#2563EB' }}>MENTOR</span>
            )}
            <span style={{ fontSize: 12, color: '#8899B0' }}>{metaStr(post)}</span>
            <span style={{ fontSize: 12, color: '#8899B0' }}>· {timeAgo(post.created_at)}</span>
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

          {isOther && (
            <div style={{ position: 'relative' }}>
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
                  background: 'white', border: '1.5px solid #E4EAF2', borderRadius: 10,
                  minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,.1)',
                  zIndex: 50, overflow: 'hidden',
                }}>
                  <button
                    onClick={() => { setMenuOpen(false); onReport('post', post.id); }}
                    style={{
                      width: '100%', padding: '10px 14px', textAlign: 'left',
                      border: 'none', background: 'transparent',
                      fontFamily: 'inherit', fontSize: 13, color: '#DC2626',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >Report post</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0D1B2A',
                   margin: '14px 0 6px', lineHeight: 1.35 }}>{post.title}</h3>
      {post.body && (
        <p style={{ fontSize: 14, lineHeight: 1.6, color: '#4B5C73', margin: 0 }}
           dangerouslySetInnerHTML={{ __html: linkifyHTML(post.body) }} />
      )}
      {post.image_path && (
        <div style={{ marginTop: 14 }}>
          <img src={post.image_path} alt="Post"
               style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'cover',
                        borderRadius: 14, border: '1.5px solid #E4EAF2', background: '#EEF0F5' }} />
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginTop: 14, paddingTop: 14, borderTop: '1.5px solid #E4EAF2', flexWrap: 'wrap',
      }}>
        <button className={`act-btn${post.liked ? ' liked' : ''}`} onClick={() => onLike(post.id)}>
          <svg width="13" height="13" viewBox="0 0 24 24"
               fill={post.liked ? 'currentColor' : 'none'}
               stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10Z" />
          </svg>
          {post.likes_count}
        </button>

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
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1.5px dashed #E4EAF2' }}>
          {replies.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <Avatar name={r.author_name} size={30} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, flexWrap: 'wrap' }}>
                  <strong style={{ color: '#0D1B2A' }}>{r.author_name}</strong>
                  <span style={{ color: '#8899B0' }}>· {roleLabel(r.author_role)} · {timeAgo(r.created_at)}</span>
                  {r.author_role === 'mentor' && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px',
                                   borderRadius: 100, background: '#EFF6FF', color: '#2563EB' }}>MENTOR</span>
                  )}
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 3, color: '#0D1B2A' }}>{r.text}</div>
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
