import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Sidebar       from '../components/Sidebar.jsx';
import Avatar        from '../components/Avatar.jsx';
import ToastHost, { toast }  from '../components/Toast.jsx';
import XpSection     from '../components/XpSection.jsx';
import ReportModal   from '../components/ReportModal.jsx';
import { pb }        from '../api/client.js';
import { useAuth }   from '../context/AuthContext.jsx';
import { roleLabel } from '../utils/role.js';
import { timeAgo }   from '../utils/time.js';
import { tagTone, linkifyHTML } from '../utils/format.js';
import { ProfileSkeleton } from '../components/Skeleton.jsx';
import VerifiedTick, { isVerified } from '../components/VerifiedTick.jsx';
import FollowListModal from '../components/FollowListModal.jsx';

const DEPTS = ['', 'SEECS', 'NBS', 'SMME', 'CEME', 'SCME', 'S3H', 'ASAB', 'CAE'];

// Animated count-up: eases from 0 to `target` over `dur` ms.
function useCountUp(target = 0, dur = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, start;
    const from = 0, to = Number(target) || 0;
    if (to === 0) { setN(0); return; }
    function tick(t) {
      if (!start) start = t;
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);   // easeOutCubic
      setN(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return n;
}

function CountUp({ value, dur }) {
  const n = useCountUp(value, dur);
  return <>{n}</>;
}

export default function Profile() {
  const { user: me, setAuth, token, logout } = useAuth();
  const navigate     = useNavigate();
  const [params]     = useSearchParams();
  const profileId    = params.get('id') || me?.id;
  const isSelf       = profileId === me?.id;

  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [edit, setEdit] = useState({ name: '', dept: '', bio: '', year: '', role: 'student' });

  const [showRate, setShowRate]     = useState(false);
  const [rateScore, setRateScore]   = useState(5);
  const [rateComment, setRateComment] = useState('');

  const [showReport, setShowReport] = useState(false);
  const [followModal, setFollowModal] = useState(null);   // 'followers' | 'following' | null

  useEffect(() => { loadProfile(); /* eslint-disable-next-line */ }, [profileId]);

  async function toggleFollow() {
    // Optimistic update; reload from server on failure.
    setProfile((prev) => ({
      ...prev,
      is_following   : !prev.is_following,
      followers_count: Math.max(0, (prev.followers_count || 0) + (prev.is_following ? -1 : 1)),
    }));
    try {
      await pb.post(`/users/${profileId}/follow`);
    } catch (e) {
      toast('Failed to update follow');
      loadProfile();
    }
  }

  async function loadProfile() {
    try {
      const p = await pb.get(`/users/${profileId}`);
      setProfile(p);
      setEdit({
        name: p.name, dept: p.department || '', bio: p.bio || '',
        year: p.graduation_year || '', role: p.role,
        skills: Array.isArray(p.skills) ? p.skills : [],
      });
    } catch {
      toast('Failed to load profile');
    }
  }

  async function saveProfile() {
    try {
      const updated = await pb.put('/users/me', {
        name           : edit.name,
        department     : edit.dept,
        graduation_year: edit.year || null,
        bio            : edit.bio,
        role           : edit.role,
        skills         : edit.skills || [],
      });
      setAuth(token, { ...me, ...updated });
      setProfile((prev) => ({ ...prev, ...updated }));
      setEditMode(false);
      toast('Profile updated!');
    } catch (e) {
      toast('Failed to save: ' + e.message);
    }
  }

  async function submitRating() {
    try {
      await pb.post(`/users/${profileId}/rate`, { score: rateScore, comment: rateComment });
      setShowRate(false); setRateComment('');
      await loadProfile();
      toast('Rating submitted!');
    } catch (e) {
      toast(e.message);
    }
  }

  async function deletePost(id) {
    try {
      await pb.del(`/posts/${id}`);
      setProfile((prev) => ({ ...prev, posts: prev.posts.filter((p) => p.id !== id) }));
      toast('Post deleted');
    } catch (e) {
      toast(e.message || 'Failed to delete post');
    }
  }

  async function updatePost(id, fields) {
    try {
      const updated = await pb.patch(`/posts/${id}`, fields);
      setProfile((prev) => ({
        ...prev,
        posts: prev.posts.map((p) => p.id === id ? { ...p, ...updated } : p),
      }));
    } catch (e) {
      toast(e.message || 'Failed to update post');
      throw e;
    }
  }

  async function deleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This cannot be undone - all your posts and data will be permanently removed.')) return;
    try {
      await pb.del('/users/me');
      logout();
    } catch (e) {
      toast('Failed to delete account: ' + e.message);
    }
  }

  const [uploadingPic, setUploadingPic] = useState(false);
  async function uploadAvatar(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please choose an image'); return; }
    if (file.size > 5 * 1024 * 1024)     { toast('Image must be under 5 MB'); return; }
    setUploadingPic(true);
    try {
      const fd = new FormData();
      fd.append('profile_image', file);
      const updated = await pb.upload('/users/me/avatar', fd);
      setAuth(token, { ...me, ...updated });
      setProfile((prev) => ({ ...prev, ...updated }));
      toast('Profile picture updated!');
    } catch (e) {
      toast(e.message || 'Failed to upload picture');
    } finally {
      setUploadingPic(false);
    }
  }

  if (!profile) {
    return (
      <Sidebar active="profile">
        <ProfileSkeleton />
      </Sidebar>
    );
  }

  const p = profile;
  const isMentor = p.role === 'mentor';

  return (
    <Sidebar active="profile">
      <ToastHost />
      <div className="page-shell">
        {p.is_locked && (
          <div style={{
            background: 'var(--blush)', border: '1.5px solid var(--blush-ink)', borderRadius: 12,
            padding: '16px 20px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--blush-ink)' }}>
              This account has been suspended.
            </span>
          </div>
        )}

        {/* Profile header card */}
        <div className="card" style={{ padding: 0, marginBottom: 24, overflow: 'hidden' }}>
          {/* Animated gradient cover */}
          <div className="profile-cover" />
          <div style={{ padding: '0 32px 32px', display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
            <div className="profile-avatar-wrap" style={{ position: 'relative' }}>
              <Avatar name={p.name} size={88} imgUrl={p.profile_image || ''} />
              {isSelf && (
                <label title="Change profile picture" style={{
                  position: 'absolute', bottom: 2, right: 2, width: 30, height: 30,
                  borderRadius: '50%', background: 'var(--blue)', border: '3px solid var(--card)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadingPic ? 'wait' : 'pointer',
                }}>
                  {uploadingPic ? (
                    <span style={{ color: '#fff', fontSize: 11 }}>…</span>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                    </svg>
                  )}
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                         disabled={uploadingPic}
                         onChange={(e) => uploadAvatar(e.target.files?.[0])} />
                </label>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 200, paddingTop: 18 }}>
              {editMode
                ? <EditForm
                    edit={edit} setEdit={setEdit}
                    onSave={saveProfile} onCancel={() => setEditMode(false)}
                    onDelete={deleteAccount}
                  />
                : <ViewHeader
                    p={p} isSelf={isSelf} isMentor={isMentor}
                    onEdit={() => setEditMode(true)}
                    onMessage={() => navigate(`/messages?to=${p.id}&name=${encodeURIComponent(p.name)}`)}
                    onRate={() => setShowRate(true)}
                    onReport={() => setShowReport(true)}
                    onFollow={toggleFollow}
                    onShowFollowers={() => setFollowModal('followers')}
                    onShowFollowing={() => setFollowModal('following')}
                  />}
            </div>
          </div>
        </div>

        {/* XP & Certificate (own profile only) */}
        {isSelf && (
          <div className="card xp-section" style={{ marginBottom: 20 }}>
            <XpSection />
          </div>
        )}

        {/* Posts */}
        <div className="card" style={{ padding: 22 }}>
          <div className="serif" style={{ fontSize: 22, marginBottom: 16 }}>
            {isSelf ? 'Your posts' : `Posts by ${p.name}`}
          </div>
          {(p.posts || []).length === 0
            ? <div className="empty-state"><p>No posts yet</p></div>
            : (p.posts || []).map((post, i) => (
                <PostRow
                  key={post.id}
                  post={post}
                  index={i}
                  isSelf={isSelf}
                  onDelete={deletePost}
                  onUpdate={updatePost}
                />
              ))}
        </div>
      </div>

      {showRate && (
        <RateModal
          name={p.name}
          score={rateScore} setScore={setRateScore}
          comment={rateComment} setComment={setRateComment}
          onSubmit={submitRating}
          onClose={() => setShowRate(false)}
        />
      )}

      {showReport && (
        <ReportModal
          targetType="user"
          targetId={profileId}
          onClose={() => setShowReport(false)}
        />
      )}

      {followModal && (
        <FollowListModal
          userId={profileId}
          mode={followModal}
          onClose={() => setFollowModal(null)}
          onOpenProfile={(id) => navigate(`/profile?id=${id}`)}
        />
      )}
    </Sidebar>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */

function StatCard({ label, value, text, delay = 0, accent = 'var(--blue)' }) {
  return (
    <div className="profile-stat-card stat-pop" style={{
      minWidth: 84, padding: '10px 14px', borderRadius: 12,
      border: '1.5px solid var(--line)', background: 'var(--card)',
      animationDelay: `${delay}ms`,
    }}>
      <div style={{ fontSize: 19, fontWeight: 800, color: accent, lineHeight: 1.1 }}>
        {text !== undefined ? text : <CountUp value={value} />}
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ViewHeader({ p, isSelf, isMentor, onEdit, onMessage, onRate, onReport, onFollow, onShowFollowers, onShowFollowing }) {
  const statBtn = {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    font: 'inherit', fontSize: 13.5, color: 'var(--ink-2)',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{p.name}</h1>
          {isVerified(p) && <VerifiedTick size={20} />}
          <VerifiedBadge p={p} />
        </div>

        <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
          <button type="button" onClick={onShowFollowers} style={statBtn}>
            <strong style={{ color: 'var(--ink)', fontWeight: 700 }}><CountUp value={p.followers_count || 0} /></strong> followers
          </button>
          <button type="button" onClick={onShowFollowing} style={statBtn}>
            <strong style={{ color: 'var(--ink)', fontWeight: 700 }}><CountUp value={p.following_count || 0} /></strong> following
          </button>
        </div>

        {/* Animated stat cards */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <StatCard label="Total XP"  value={p.total_xp || 0} delay={0}   accent="var(--gold-ink)" />
          <StatCard label="Level"     text={p.xp_level || 'Bronze'} delay={80} accent="var(--blue)" />
          {isMentor && <StatCard label="Sessions" value={p.sessions_count || 0} delay={160} accent="var(--mint-ink)" />}
          {isMentor && <StatCard label="Rating"   text={Number(p.rating || 0).toFixed(1)} delay={240} accent="var(--gold-ink)" />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <span className="tag tag-lav">{roleLabel(p.role)}</span>
          {p.department && <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>{p.department}</span>}
          {p.graduation_year && <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>'{String(p.graduation_year).slice(-2)}</span>}
          {p.is_online && (
            <span style={{ fontSize: 11.5, color: 'var(--mint-ink)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="dot" style={{ background: '#7fc9a4' }} /> Online
            </span>
          )}
        </div>
        {isMentor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Stars rating={p.rating || 0} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{p.rating || '0.0'}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              ({p.rating_count || 0} ratings · {p.sessions_count || 0} sessions)
            </span>
          </div>
        )}
        {p.bio
          ? <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, maxWidth: 500 }}>{p.bio}</p>
          : <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-3)', fontStyle: 'italic' }}>No bio yet.</p>}
        {Array.isArray(p.skills) && p.skills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, maxWidth: 500 }}>
            {p.skills.map((s) => (
              <span key={s} style={{
                padding: '4px 11px', borderRadius: 999,
                background: 'var(--blue-soft)', color: 'var(--blue)',
                fontSize: 12, fontWeight: 600,
              }}>{s}</span>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isSelf ? (
          <button className="btn btn-ghost" onClick={onEdit} style={{ padding: '10px 16px', fontSize: 13.5 }}>Edit profile</button>
        ) : (
          <>
            <button
              className={`btn ${p.is_following ? 'btn-ghost' : 'btn-primary'}`}
              onClick={onFollow}
              style={{ padding: '10px 16px', fontSize: 13.5 }}
            >{p.is_following ? '✓ Following' : '+ Follow'}</button>
            <button className="btn btn-ghost" onClick={onMessage} style={{ padding: '10px 16px', fontSize: 13.5 }}>Message</button>
          </>
        )}
        {!isSelf && isMentor && !p.is_locked && (
          <button className="btn btn-ghost" onClick={onRate} style={{ padding: '10px 16px', fontSize: 13.5 }}>Rate mentor</button>
        )}
        {!isSelf && (
          <button className="btn btn-ghost" onClick={onReport}
                  style={{ padding: '10px 16px', fontSize: 13.5, color: '#DC2626', borderColor: '#FECACA' }}>
            Report this profile
          </button>
        )}
      </div>
    </div>
  );
}

function VerifiedBadge({ p }) {
  if (p.role !== 'mentor') return null;
  if (p.is_under_review)
    return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                          background: 'var(--gold-soft)', color: 'var(--gold-ink)' }}>Under Review</span>;
  if ((p.rating || 0) >= 4 && (p.rating_count || 0) >= 10)
    return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                          background: 'var(--mint)', color: 'var(--mint-ink)' }}>Verified Mentor</span>;
  return null;
}

function EditForm({ edit, setEdit, onSave, onCancel, onDelete }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        className="input" value={edit.name} placeholder="Full name"
        onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))}
        style={{ fontSize: 16, padding: '10px 14px' }}
      />
      <div className="form-two-col">
        <select className="input" value={edit.dept} onChange={(e) => setEdit((p) => ({ ...p, dept: e.target.value }))}
                style={{ padding: '10px 14px', fontSize: 14 }}>
          {DEPTS.map((d) => <option key={d} value={d}>{d || 'Department'}</option>)}
        </select>
        <select className="input" value={edit.role} onChange={(e) => setEdit((p) => ({ ...p, role: e.target.value }))}
                style={{ padding: '10px 14px', fontSize: 14 }}>
          {['student', 'mentor'].map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
      </div>
      <input
        type="number" className="input" value={edit.year} placeholder="Graduation year"
        onChange={(e) => setEdit((p) => ({ ...p, year: e.target.value }))}
        style={{ padding: '10px 14px', fontSize: 14 }}
      />
      <textarea
        className="input" rows={3} value={edit.bio} placeholder="Short bio…"
        onChange={(e) => setEdit((p) => ({ ...p, bio: e.target.value }))}
        style={{ resize: 'vertical' }}
      />
      <SkillsEditor
        skills={edit.skills || []}
        onChange={(skills) => setEdit((p) => ({ ...p, skills }))}
      />
      <div className="stack-actions">
        <button className="btn btn-primary" onClick={onSave} style={{ padding: '10px 18px' }}>Save</button>
        <button className="btn btn-ghost"   onClick={onCancel} style={{ padding: '10px 18px' }}>Cancel</button>
        <button className="btn btn-ghost"   onClick={onDelete}
                style={{ padding: '10px 18px', color: 'var(--blush-ink)', borderColor: 'rgba(248,113,113,.35)', marginLeft: 'auto' }}>
          Delete account
        </button>
      </div>
    </div>
  );
}

function SkillsEditor({ skills, onChange }) {
  const [draft, setDraft] = useState('');
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (skills.length >= 12) return;
    if (skills.some(s => s.toLowerCase() === v.toLowerCase())) { setDraft(''); return; }
    onChange([...skills, v.slice(0, 30)]);
    setDraft('');
  }
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase',
                    letterSpacing: '.05em', marginBottom: 7 }}>
        Skills &amp; expertise
      </div>
      {skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {skills.map((s) => (
            <span key={s} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 999,
              background: 'var(--blue-soft)', color: 'var(--blue)',
              fontSize: 12, fontWeight: 600,
            }}>
              {s}
              <button onClick={() => onChange(skills.filter(x => x !== s))} style={{
                border: 'none', background: 'transparent', color: 'var(--blue)',
                cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0,
              }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="input" value={draft}
          placeholder="e.g. PyTorch, DSA, System Design"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          style={{ flex: 1, padding: '9px 12px', fontSize: 13.5 }}
        />
        <button className="btn btn-ghost" onClick={add} disabled={!draft.trim() || skills.length >= 12}
                style={{ padding: '9px 16px' }}>Add</button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
        Up to 12 tags. Shown on your profile and used in mentor search.
      </div>
    </div>
  );
}

const POST_TAGS = ['Academic Help', 'Career', 'Resources', 'Events', 'General'];

function PostRow({ post, index = 0, isSelf, onDelete, onUpdate }) {
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [editing,    setEditing]    = useState(false);
  const [editTag,    setEditTag]    = useState(post.tag);
  const [editTitle,  setEditTitle]  = useState(post.title);
  const [editBody,   setEditBody]   = useState(post.body || '');
  const [saving,     setSaving]     = useState(false);
  const menuRef = useRef(null);

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
      <div style={{ padding: '16px 0', borderTop: '1px solid var(--line)' }}>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          This post has been flagged by the community.
        </p>
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ padding: '16px 0', borderTop: '1px solid var(--line)',
                  animationDelay: `${Math.min(index * 60, 360)}ms` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span className={`tag tag-${tagTone(post.tag)}`}>{post.tag}</span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{timeAgo(post.created_at)}</span>
        </div>

        {isSelf && !editing && (
          <div style={{ position: 'relative', flexShrink: 0 }} ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: 8,
                border: '1.5px solid var(--line)', background: 'var(--bg-3)',
                cursor: 'pointer', color: 'var(--ink-3)',
              }}
              title="Post options"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
              </svg>
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 34,
                background: 'var(--card)', border: '1.5px solid var(--line)', borderRadius: 10,
                minWidth: 150, boxShadow: 'var(--shadow-md)', zIndex: 50, overflow: 'hidden',
              }}>
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
              </div>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <select
            value={editTag} onChange={(e) => setEditTag(e.target.value)}
            style={{ padding: '8px 12px', border: '1.5px solid var(--line)', borderRadius: 9, fontFamily: 'inherit', fontSize: 13, background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer' }}
          >
            {POST_TAGS.map(t => <option key={t}>{t}</option>)}
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
            style={{ padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 9, fontFamily: 'inherit', fontSize: 13.5, resize: 'vertical', lineHeight: 1.55, background: 'var(--card)', color: 'var(--ink)' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave} disabled={saving || !editTitle.trim()}
              style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: 'var(--blue)', color: 'white', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >{saving ? 'Saving…' : 'Save'}</button>
            <button
              onClick={() => setEditing(false)}
              style={{ padding: '8px 18px', borderRadius: 9, border: '1.5px solid var(--line)', background: 'var(--card)', color: 'var(--ink-2)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="serif" style={{ fontSize: 18, fontWeight: 400, lineHeight: 1.3, marginBottom: 6 }}>
            {post.title}
          </div>
          {post.body && (
            <p style={{
              margin: 0, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.45,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }} dangerouslySetInnerHTML={{ __html: linkifyHTML(post.body) }} />
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--ink-3)' }}>
            <span>♥ {post.likes_count}</span>
            <span>{post.comments_count} replies</span>
            <span>{post.bookmarks_count} saves</span>
          </div>
        </>
      )}
    </div>
  );
}

function Stars({ rating }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24"
             fill={i < Math.round(rating) ? '#e6c84d' : 'none'}
             stroke="#e6c84d" strokeWidth="2">
          <path d="M12 2l2.9 6.1 6.6.9-4.8 4.7 1.1 6.6L12 17l-5.9 3.3 1.1-6.6L2.5 9l6.6-.9L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function RateModal({ name, score, setScore, comment, setComment, onSubmit, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(26,31,58,.25)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 24, boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Rate {name}</div>
          <button className="chip-btn" onClick={onClose} style={{ padding: 6 }}>X</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setScore(n)}
              style={{
                fontSize: 28, padding: 4, color: n <= score ? '#e6c84d' : 'var(--ink-3)',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >★</button>
          ))}
        </div>
        <textarea
          className="input" rows={3} placeholder="Leave a comment (optional)…"
          value={comment} onChange={(e) => setComment(e.target.value)}
          style={{ marginBottom: 14, resize: 'vertical' }}
        />
        <button className="btn btn-primary" onClick={onSubmit} style={{ width: '100%', padding: 12 }}>
          Submit rating
        </button>
      </div>
    </div>
  );
}
