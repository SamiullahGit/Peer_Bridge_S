import { useEffect, useRef, useState } from 'react';

import Sidebar    from '../components/Sidebar.jsx';
import Avatar     from '../components/Avatar.jsx';
import ToastHost, { toast }  from '../components/Toast.jsx';
import { pb, API_BASE } from '../api/client.js';
import { formatFileSize } from '../utils/format.js';
import { ResourceCardSkeleton } from '../components/Skeleton.jsx';

const CATS        = ['', 'Past Papers', 'Course Notes', 'FYP Resources', 'Career Guide', 'Society Guide', 'Other'];
const TYPE_ICONS  = { PDF: 'PDF', ZIP: 'ZIP', DOCX: 'DOC', XLSX: 'XLS', PPTX: 'PPT', PNG: 'PNG', JPG: 'JPG' };

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [catFilter, setCatFilter] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading]   = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => { loadResources(); /* eslint-disable-next-line */ }, [catFilter]);

  async function loadResources() {
    const q = new URLSearchParams();
    if (catFilter) q.set('category', catFilter);
    if (searchVal) q.set('search',   searchVal);
    setLoading(true);
    try { setResources(await pb.get('/resources?' + q)); }
    catch { /* silent */ }
    finally { setLoading(false); }
  }

  function debounceSearch(v) {
    setSearchVal(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadResources, 400);
  }

  async function handleUpload(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    setUploading(true);
    try {
      await pb.upload('/resources', form);
      setShowUpload(false);
      await loadResources();
      toast('Resource uploaded!');
    } catch (err) {
      toast('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  function downloadResource(id, filename) {
    // Hit the protected /download endpoint with auth, then either save
    // the streamed bytes (local disk) or follow the redirect Cloudinary
    // returns (cloud storage). fetch() follows 3xx redirects by default
    // and Cloudinary's URLs have permissive CORS, so the same code path
    // works for both backends.
    fetch(`${API_BASE}/resources/${id}/download`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('pb_token')}` },
    })
      .then((res) => { if (!res.ok) throw new Error('Download failed'); return res.blob(); })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url; a.download = filename || 'download';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      })
      .catch((err) => toast('Download failed: ' + err.message));
  }

  const topnavMid = (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 400,
        background: 'rgba(255,255,255,.12)', border: '1.5px solid rgba(255,255,255,.18)',
        borderRadius: 10, padding: '8px 14px',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="rgba(255,255,255,.55)" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={searchVal}
          placeholder="Search resources…"
          onChange={(e) => debounceSearch(e.target.value)}
          style={{ flex: 1, border: 0, outline: 0, background: 'transparent',
                   fontSize: 13.5, color: 'rgba(255,255,255,.9)' }}
        />
      </div>
      <button
        className="btn btn-primary" onClick={() => setShowUpload(true)}
        style={{ padding: '9px 14px', fontSize: 13, flexShrink: 0,
                 display: 'flex', alignItems: 'center', gap: 6 }}
      >Upload</button>
    </>
  );

  return (
    <Sidebar active="resources" topnavMid={topnavMid}>
      <ToastHost />
      <div className="page-shell">
        <section className="page-hero" style={{ marginBottom: 22 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12, position: 'relative', zIndex: 1,
          }}>
            <div>
              <div className="tag tag-lav" style={{ marginBottom: 12 }}>Shared learning vault</div>
              <h1 className="section-title">Resource Library</h1>
              <p className="section-subtitle">{loading ? 'Loading resources…' : `${resources.length} resources shared by the community`}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CATS.map((c) => (
                <button
                  key={c}
                  className={`chip-btn${catFilter === c ? ' active' : ''}`}
                  onClick={() => setCatFilter(c)}
                >{c || 'All'}</button>
              ))}
            </div>
          </div>
        </section>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 18,
        }}>
          {loading ? (
            [0, 1, 2, 3, 4, 5].map((i) => <ResourceCardSkeleton key={i} />)
          ) : resources.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <p>No resources found. Be the first to share!</p>
            </div>
          ) : resources.map((r) => (
            <div key={r.id} style={{
              background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)', padding: 20,
              boxShadow: 'var(--shadow-sm)',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'var(--mint)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'var(--mint-ink)', flexShrink: 0,
                }}>{TYPE_ICONS[r.file_type] || 'FILE'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>
                    {r.title}
                  </div>
                  {r.course_code && <span className="tag tag-lav" style={{ marginBottom: 6 }}>{r.course_code}</span>}
                  {r.category    && <span className="tag" style={{ marginLeft: 4, marginBottom: 6 }}>{r.category}</span>}
                </div>
              </div>

              {r.description && (
                <p style={{
                  margin: 0, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{r.description}</p>
              )}

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                paddingTop: 10, borderTop: '1px solid var(--line)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={r.uploader_name} size={24} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{r.uploader_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      {formatFileSize(r.file_size)} · {r.downloads_count} downloads
                    </div>
                  </div>
                </div>
                <button
                  className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 12.5 }}
                  onClick={() => downloadResource(r.id, r.file_name || 'file')}
                >Download</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showUpload && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(26,31,58,.25)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowUpload(false); }}
        >
          <div className="card fade-up" style={{
            width: '100%', maxWidth: 540, padding: 0,
            boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div className="serif" style={{ fontSize: 22 }}>Upload a Resource</div>
              <button className="chip-btn" onClick={() => setShowUpload(false)} style={{ padding: 6 }}>X</button>
            </div>
            <form onSubmit={handleUpload} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input name="title" className="input" placeholder="Title *" required style={{ padding: '11px 14px', fontSize: 14 }} />
              <div className="form-two-col">
                <select name="category" className="input" style={{ padding: '11px 14px', fontSize: 14 }}>
                  {CATS.filter((c) => c).map((c) => <option key={c}>{c}</option>)}
                </select>
                <input name="course_code" className="input" placeholder="Course code (optional)"
                       style={{ padding: '11px 14px', fontSize: 14 }} />
              </div>
              <textarea name="description" className="input" rows={3} placeholder="Brief description…"
                        style={{ resize: 'vertical', fontSize: 14 }} />
              <input name="file" type="file" className="input" />
              <button type="submit" className="btn btn-primary" style={{ padding: 13 }}>
                {uploading ? 'Uploading…' : 'Upload resource'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
