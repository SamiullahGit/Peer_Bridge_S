import { useEffect, useRef, useState } from 'react';
import { useNavigate }          from 'react-router-dom';

import Sidebar      from '../components/Sidebar.jsx';
import Avatar       from '../components/Avatar.jsx';
import ToastHost, { toast } from '../components/Toast.jsx';
import { pb }       from '../api/client.js';
import { timeAgo }  from '../utils/time.js';
import { tagPalette, linkifyHTML } from '../utils/format.js';

export default function Saved() {
  const navigate                  = useNavigate();
  const [posts, setPosts]         = useState([]);     // all bookmarks
  const [collections, setCollections] = useState([]);
  const [active, setActive]       = useState('all');  // 'all' | collectionId
  const [colPosts, setColPosts]   = useState([]);     // posts in active collection
  const [creating, setCreating]   = useState(false);

  useEffect(() => { loadSaved(); loadCollections(); }, []);
  useEffect(() => {
    if (active === 'all') return;
    pb.get(`/collections/${active}`).then(d => setColPosts(d.posts || [])).catch(() => setColPosts([]));
  }, [active]);

  async function loadSaved() {
    try { setPosts(await pb.get('/posts/bookmarks')); }
    catch (e) { setPosts([]); toast('Could not load saved posts: ' + e.message); }
  }
  async function loadCollections() {
    try { setCollections(await pb.get('/collections')); } catch { /* silent */ }
  }

  async function unsave(id) {
    try {
      await pb.post(`/posts/${id}/bookmark`);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      toast('Post removed from saved');
    } catch (e) { toast('Failed: ' + e.message); }
  }

  async function createCollection() {
    const name = window.prompt('Name your collection (e.g. "GRE prep", "FYP ideas")');
    if (!name || !name.trim()) return;
    setCreating(true);
    try {
      const c = await pb.post('/collections', { name: name.trim() });
      setCollections((prev) => [c, ...prev]);
    } catch (e) { toast(e.message || 'Failed to create'); }
    finally { setCreating(false); }
  }

  async function deleteCollection(id) {
    if (!window.confirm('Delete this collection? The saved posts themselves stay saved.')) return;
    try {
      await pb.del(`/collections/${id}`);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (active === id) setActive('all');
      toast('Collection deleted');
    } catch (e) { toast(e.message || 'Failed'); }
  }

  async function addToCollection(postId, collectionId) {
    try {
      await pb.post(`/collections/${collectionId}/items`, { post_id: postId });
      setCollections((prev) => prev.map(c => c.id === collectionId ? { ...c, item_count: (c.item_count || 0) + 1 } : c));
      toast('Added to collection');
    } catch (e) { toast(e.message || 'Failed'); }
  }

  async function removeFromCollection(postId) {
    try {
      await pb.del(`/collections/${active}/items/${postId}`);
      setColPosts((prev) => prev.filter(p => p.id !== postId));
      setCollections((prev) => prev.map(c => c.id === active ? { ...c, item_count: Math.max(0, (c.item_count || 1) - 1) } : c));
      toast('Removed from collection');
    } catch (e) { toast(e.message || 'Failed'); }
  }

  const list = active === 'all' ? posts : colPosts;

  return (
    <Sidebar active="saved">
      <ToastHost />
      <div className="page-shell">
        <section className="page-hero" style={{ marginBottom: 22 }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="tag tag-lav" style={{ marginBottom: 12 }}>Bookmarked</div>
            <h1 className="section-title">Saved posts</h1>
            <p className="section-subtitle">
              {active === 'all'
                ? `${posts.length} post${posts.length === 1 ? '' : 's'} saved`
                : `${colPosts.length} post${colPosts.length === 1 ? '' : 's'} in this collection`}
            </p>
          </div>
        </section>

        {/* Collection tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
          <CollTab label="All saved" count={posts.length} activeTab={active === 'all'} onClick={() => setActive('all')} />
          {collections.map((c) => (
            <CollTab key={c.id} label={c.name} count={c.item_count}
                     activeTab={active === c.id} onClick={() => setActive(c.id)}
                     onDelete={() => deleteCollection(c.id)} />
          ))}
          <button onClick={createCollection} disabled={creating} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
            border: '1.5px dashed var(--line-2)', background: 'transparent',
            color: 'var(--ink-2)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M7 2v10M2 7h10" /></svg>
            New collection
          </button>
        </div>

        <div style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {list.length === 0 ? (
            <div className="empty-state">
              <p>{active === 'all'
                ? <>Nothing saved yet. Tap <strong>Save</strong> on any post in the feed to see it here.</>
                : <>This collection is empty. Use <strong>Add to collection</strong> on a saved post.</>}</p>
            </div>
          ) : list.map((p) => (
            <SavedCard
              key={p.id}
              p={p}
              inCollection={active !== 'all'}
              collections={collections}
              onUnsave={() => unsave(p.id)}
              onRemove={() => removeFromCollection(p.id)}
              onAddToCollection={(cid) => addToCollection(p.id, cid)}
              onProfile={() => navigate(`/profile?id=${p.author_id}`)}
            />
          ))}
        </div>
      </div>
    </Sidebar>
  );
}

function CollTab({ label, count, activeTab, onClick, onDelete }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
      border: `1.5px solid ${activeTab ? 'var(--blue)' : 'var(--line)'}`,
      background: activeTab ? 'var(--blue)' : 'var(--card)',
      color: activeTab ? '#fff' : 'var(--ink-2)',
      fontSize: 13, fontWeight: 600, transition: 'all .15s',
    }} onClick={onClick}>
      {label}
      <span style={{ fontSize: 11, opacity: .8 }}>{count ?? 0}</span>
      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete collection"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer',
                   color: activeTab ? 'rgba(255,255,255,.8)' : 'var(--ink-3)', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
      )}
    </span>
  );
}

function SavedCard({ p, inCollection, collections, onUnsave, onRemove, onAddToCollection, onProfile }) {
  const isMentor = p.author_role === 'mentor';
  const [bg, fg] = tagPalette(p.tag);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  return (
    <div className="fade-up" style={{
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

        <div style={{ display: 'flex', gap: 6, position: 'relative' }} ref={menuRef}>
          {!inCollection && (
            <>
              <button onClick={() => setMenuOpen(o => !o)} title="Add to collection" style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 11px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--ink-2)',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><path d="M12 11v6M9 14h6" />
                </svg>
                Collect
              </button>
              {menuOpen && (
                <div style={{
                  position: 'absolute', top: 38, right: 0, zIndex: 50, minWidth: 190,
                  background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 10,
                  boxShadow: 'var(--shadow-md)', overflow: 'hidden', padding: 4,
                }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase',
                                letterSpacing: '.05em', padding: '6px 10px 4px' }}>Add to collection</div>
                  {collections.length === 0 ? (
                    <div style={{ padding: '8px 10px', fontSize: 12.5, color: 'var(--ink-3)' }}>No collections yet.</div>
                  ) : collections.map(c => (
                    <button key={c.id} onClick={() => { onAddToCollection(c.id); setMenuOpen(false); }} style={{
                      width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 7,
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)',
                      display: 'flex', justifyContent: 'space-between', gap: 8,
                    }}>
                      <span>{c.name}</span>
                      <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{c.item_count || 0}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <button
            onClick={inCollection ? onRemove : onUnsave}
            title={inCollection ? 'Remove from collection' : 'Remove from saved'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              border: '1.5px solid var(--blue-mid)', background: 'var(--blue-soft)', color: 'var(--blue)',
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 3h12v18l-6-4-6 4V3Z" />
            </svg>
            {inCollection ? 'Remove' : 'Saved'}
          </button>
        </div>
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
