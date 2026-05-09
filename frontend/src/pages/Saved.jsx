import { useEffect, useState } from 'react';
import { useNavigate }          from 'react-router-dom';

import Sidebar      from '../components/Sidebar.jsx';
import Avatar       from '../components/Avatar.jsx';
import ToastHost, { toast } from '../components/Toast.jsx';
import { pb }       from '../api/client.js';
import { timeAgo }  from '../utils/time.js';
import { tagPalette, linkifyHTML } from '../utils/format.js';

export default function Saved() {
  const navigate              = useNavigate();
  const [posts, setPosts]     = useState([]);

  useEffect(() => { loadSaved(); }, []);

  async function loadSaved() {
    try { setPosts(await pb.get('/posts/bookmarks')); }
    catch (e) {
      setPosts([]);
      toast('Could not load saved posts: ' + e.message);
    }
  }

  async function unsave(id) {
    try {
      await pb.post(`/posts/${id}/bookmark`);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      toast('Post removed from saved');
    } catch (e) {
      toast('Failed: ' + e.message);
    }
  }

  return (
    <Sidebar active="saved">
      <ToastHost />
      <div className="page-shell">
        <section className="page-hero" style={{ marginBottom: 22 }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="tag tag-lav" style={{ marginBottom: 12 }}>Bookmarked</div>
            <h1 className="section-title">Saved posts</h1>
            <p className="section-subtitle">{posts.length} post{posts.length === 1 ? '' : 's'} saved</p>
          </div>
        </section>

        <div style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {posts.length === 0 ? (
            <div className="empty-state">
              <p>Nothing saved yet. Tap <strong>Save</strong> on any post in the feed to see it here.</p>
            </div>
          ) : posts.map((p) => (
            <SavedCard
              key={p.id}
              p={p}
              onUnsave={() => unsave(p.id)}
              onProfile={() => navigate(`/profile?id=${p.author_id}`)}
            />
          ))}
        </div>
      </div>
    </Sidebar>
  );
}

function SavedCard({ p, onUnsave, onProfile }) {
  const isMentor = p.author_role === 'mentor';
  const [bg, fg] = tagPalette(p.tag);

  return (
    <div style={{
      background: 'var(--card)', border: '1.5px solid var(--line)',
      borderRadius: 'var(--radius)', padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <Avatar name={p.author_name} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }}
                  onClick={onProfile}>{p.author_name}</span>
            {isMentor && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px',
                             borderRadius: 100, background: 'var(--blue-soft)', color: 'var(--blue)' }}>MENTOR</span>
            )}
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>· {timeAgo(p.created_at)}</span>
          </div>
          <div style={{ marginTop: 5 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '3px 10px', borderRadius: 100,
              fontSize: 11.5, fontWeight: 600, background: bg, color: fg,
            }}>{p.tag}</span>
          </div>
        </div>
        <button
          onClick={onUnsave}
          title="Remove from saved"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            border: '1.5px solid var(--blue-mid)', background: 'var(--blue-soft)', color: 'var(--blue)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 3h12v18l-6-4-6 4V3Z" />
          </svg>
          Saved
        </button>
      </div>

      <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)',
                   margin: '0 0 6px', lineHeight: 1.35 }}>{p.title}</h3>
      {p.body && (
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}
           dangerouslySetInnerHTML={{ __html: linkifyHTML(p.body) }} />
      )}
      {p.image_path && (
        <div style={{ marginTop: 14 }}>
          <img src={p.image_path} alt=""
               style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'cover',
                        borderRadius: 12, border: '1.5px solid var(--line)' }} />
        </div>
      )}
    </div>
  );
}
