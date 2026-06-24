import { useEffect, useState } from 'react';
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

  async function deleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This cannot be undone - all your posts and data will be permanently removed.')) return;
    try {
      await pb.del('/users/me');
      logout();
    } catch (e) {
      toast('Failed to delete account: ' + e.message);
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
            background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12,
            padding: '16px 20px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#991B1B' }}>
              This account has been suspended.
            </span>
          </div>
        )}

        {/* Profile header card */}
        <div className="card" style={{ padding: 0, marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ padding: '9px 20px', borderBottom: '1px solid var(--line)', background: '#f0f1f3' }}>
            <button onClick={() => history.back()} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: 0, border: 'none', background: 'none',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--blue)', cursor: 'pointer',
            }}>&larr; Back</button>
          </div>
          <div style={{ padding: 32, display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
            <Avatar name={p.name} size={80} imgUrl={p.profile_image || ''} />
            <div style={{ flex: 1, minWidth: 200 }}>
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
            : (p.posts || []).map((post) => (
                <PostRow key={post.id} post={post} onClick={() => navigate('/feed')} />
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

        <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
          <button type="button" onClick={onShowFollowers} style={statBtn}>
            <strong style={{ color: 'var(--ink)', fontWeight: 700 }}>{p.followers_count || 0}</strong> followers
          </button>
          <button type="button" onClick={onShowFollowing} style={statBtn}>
            <strong style={{ color: 'var(--ink)', fontWeight: 700 }}>{p.following_count || 0}</strong> following
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <span className="tag tag-lav">{roleLabel(p.role)}</span>
          {p.department && <span style={{ color: 'var(--ink-2)', fontSize: 13 }}>{p.department}</span>}
          {p.graduation_year && <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>'{String(p.graduation_year).slice(-2)}</span>}
          {p.is_online && (
            <span style={{ fontSize: 11.5, color: '#2a5b46', display: 'flex', alignItems: 'center', gap: 4 }}>
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
                          background: '#FEF3C7', color: '#92400E' }}>Under Review</span>;
  if ((p.rating || 0) >= 4 && (p.rating_count || 0) >= 10)
    return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                          background: '#D1FAE5', color: '#065F46' }}>Verified Mentor</span>;
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
      <div className="stack-actions">
        <button className="btn btn-primary" onClick={onSave} style={{ padding: '10px 18px' }}>Save</button>
        <button className="btn btn-ghost"   onClick={onCancel} style={{ padding: '10px 18px' }}>Cancel</button>
        <button className="btn btn-ghost"   onClick={onDelete}
                style={{ padding: '10px 18px', color: '#DC2626', borderColor: '#FECACA', marginLeft: 'auto' }}>
          Delete account
        </button>
      </div>
    </div>
  );
}

function PostRow({ post, onClick }) {
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
    <div onClick={onClick} style={{ padding: '16px 0', borderTop: '1px solid var(--line)', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span className={`tag tag-${tagTone(post.tag)}`}>{post.tag}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{timeAgo(post.created_at)}</span>
      </div>
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
