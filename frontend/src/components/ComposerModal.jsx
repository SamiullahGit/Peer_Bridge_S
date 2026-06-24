import { useState } from 'react';

import { pb }              from '../api/client.js';
import { toast }           from './Toast.jsx';
import { formatFileSize }  from '../utils/format.js';

const TAGS = ['Academic Help', 'Career & Internships', 'Resources', 'Events & Societies'];

// "New post" modal. Receives the initial selected tag, returns the
// created post (with `liked: false, bookmarked: false`) via `onCreated`.

export default function ComposerModal({ initialTag = 'Academic Help', initialAnon = false, onClose, onCreated }) {
  const [tag, setTag]               = useState(initialTag);
  const [title, setTitle]           = useState('');
  const [body, setBody]             = useState('');
  const [file, setFile]             = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(initialAnon);

  function onFileChange(e) {
    setFile(e.target.files?.[0] || null);
  }

  async function submit() {
    if (!title.trim()) { toast('Please enter a title'); return; }
    try {
      const fd = new FormData();
      fd.append('tag', tag);
      fd.append('title', title.trim());
      fd.append('body', body.trim());
      fd.append('is_anonymous', isAnonymous ? 'true' : 'false');
      if (file) fd.append('image', file);

      const post = await pb.upload('/posts', fd);
      onCreated({ ...post, replies: [] });
      onClose();
      toast(isAnonymous ? 'Posted anonymously!' : file ? 'Post with image shared!' : 'Post shared!');
    } catch (err) {
      toast('Failed to post: ' + err.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <div style={{
          padding: '18px 22px', borderBottom: '1.5px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>New post</div>
          <button className="modal-close-btn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l10 10M12 2 2 12" />
            </svg>
          </button>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {TAGS.map((t) => {
              const active = t === tag;
              return (
                <button
                  key={t}
                  onClick={() => setTag(t)}
                  style={{
                    padding: '6px 14px', borderRadius: 8,
                    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                    background: active ? 'var(--ink)' : 'transparent',
                    color    : active ? 'white' : 'var(--ink-2)',
                  }}
                >{t}</button>
              );
            })}
          </div>

          <input
            className="comp-modal-input"
            placeholder="What's your question or update?"
            value={title} onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="comp-modal-textarea" rows={5}
            placeholder="Add context, details, links, or any relevant information about your post…"
            value={body} onChange={(e) => setBody(e.target.value)}
          />

          <div style={{
            marginTop: 12, padding: 14, border: '1.5px dashed var(--line-2)',
            borderRadius: 12, background: 'var(--bg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Optional image</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>
                  Add a JPG, PNG, GIF, or WebP image to make your post feel more authentic.
                </div>
              </div>
              <label htmlFor="comp-img" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', borderRadius: 9,
                border: '1.5px solid var(--line)', background: 'var(--card)',
                color: 'var(--ink-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Choose image</label>
              <input id="comp-img" type="file" accept="image/png,image/jpeg,image/webp,image/gif"
                     style={{ display: 'none' }} onChange={onFileChange} />
            </div>
            {file && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                marginTop: 12, padding: '10px 12px', borderRadius: 10,
                background: 'var(--card)', border: '1px solid var(--line)',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{formatFileSize(file.size)}</div>
                </div>
                <button onClick={() => setFile(null)} style={{
                  padding: '7px 12px', borderRadius: 8,
                  border: '1px solid var(--line)', background: 'transparent',
                  color: 'var(--ink-2)', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>Remove</button>
              </div>
            )}
          </div>

          {/* Anonymous toggle */}
          <div
            onClick={() => setIsAnonymous(v => !v)}
            style={{
              marginTop: 14, padding: '10px 14px',
              borderRadius: 10, cursor: 'pointer',
              border: `1.5px solid ${isAnonymous ? '#7C3AED' : 'var(--line)'}`,
              background: isAnonymous ? 'rgba(124,58,237,.06)' : 'transparent',
              display: 'flex', alignItems: 'center', gap: 10,
              transition: 'border-color .15s, background .15s',
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: isAnonymous ? '#7C3AED' : 'var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background .15s',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                   stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: isAnonymous ? '#7C3AED' : 'var(--ink)' }}>
                Post anonymously
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>
                {isAnonymous ? 'Your name will be hidden from other users' : 'Your profile will be visible on this post'}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginTop: 16, paddingTop: 16, borderTop: '1.5px solid var(--line)',
          }}>
            <div style={{ flex: 1 }} />
            <button onClick={onClose} style={{
              padding: '9px 18px', borderRadius: 9,
              border: '1.5px solid var(--line)', background: 'transparent',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={submit} style={{
              padding: '9px 22px', borderRadius: 9,
              background: isAnonymous ? '#7C3AED' : '#2563EB', color: 'white', border: 'none',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'background .15s',
            }}>
              {isAnonymous ? 'Post anonymously' : 'Post'}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                   stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M2 7h10M7 2l5 5-5 5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
