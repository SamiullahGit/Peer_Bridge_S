import { useEffect, useRef, useState } from 'react';
import { useNavigate }                  from 'react-router-dom';

import Sidebar    from '../components/Sidebar.jsx';
import Avatar     from '../components/Avatar.jsx';
import ToastHost  from '../components/Toast.jsx';
import { toast }  from '../components/Toast.jsx';
import { pb }     from '../api/client.js';
import { MentorCardSkeleton } from '../components/Skeleton.jsx';
import VerifiedTick, { FOLLOWERS_FOR_VERIFIED } from '../components/VerifiedTick.jsx';

const DEPTS = ['', 'SEECS', 'NBS', 'SMME', 'CEME', 'SCME', 'S3H', 'ASAB', 'CAE'];

export default function Mentors() {
  const navigate                  = useNavigate();
  const [mentors, setMentors]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [searchVal, setSearchVal] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [requested, setRequested] = useState(new Set());
  const debounceRef = useRef(null);

  const [aiQuery, setAiQuery]   = useState('');
  const [aiMatches, setAiMatches] = useState(null);
  const [aiBusy, setAiBusy]     = useState(false);
  async function findWithAI() {
    if (!aiQuery.trim()) { toast('Describe what you need help with'); return; }
    setAiBusy(true); setAiMatches(null);
    try {
      const r = await pb.post('/ai/match-mentors', { query: aiQuery.trim() });
      setAiMatches(r.matches || []);
      if (!r.matches?.length) toast(r.note || 'No matches found');
    } catch (e) { toast(e.message || 'Failed'); }
    finally { setAiBusy(false); }
  }

  // Initial load: pull "my requests" first so the badges render correctly,
  // then load mentors. After mount, react to dept/skill filter changes.
  useEffect(() => { loadMyRequests(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { loadMentors();    /* eslint-disable-next-line */ }, [deptFilter, skillFilter]);

  async function loadMentors() {
    const q = new URLSearchParams();
    if (searchVal)   q.set('search', searchVal);
    if (deptFilter)  q.set('dept',   deptFilter);
    if (skillFilter) q.set('skill',  skillFilter);
    setLoading(true);
    try { setMentors(await pb.get('/users/mentors?' + q)); }
    catch { toast('Failed to load mentors'); }
    finally { setLoading(false); }
  }

  async function loadMyRequests() {
    try {
      const ids = await pb.get('/users/my-requests');
      setRequested(new Set(ids));
    } catch { /* silent */ }
  }

  function debounceSearch(v) {
    setSearchVal(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadMentors, 400);
  }

  async function requestMentorship(id, name) {
    try {
      await pb.post(`/users/${id}/request-mentorship`,
        { message: 'Hi! I would love to connect for mentorship.' });
      setRequested((prev) => new Set([...prev, id]));
      toast(`Request sent to ${name}!`);
    } catch (e) {
      toast(e.message || 'Failed to send request');
    }
  }

  return (
    <Sidebar active="mentors">
      <ToastHost />
      <div className="page-shell">
        <section className="page-hero">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="tag tag-lav" style={{ marginBottom: 14 }}>Verified mentor directory</div>
            <h1 className="section-title">Find the right senior to guide you</h1>
            <p className="section-subtitle">{loading ? 'Loading mentors…' : `${mentors.length} mentors available across NUST departments.`}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260,
                padding: '12px 14px', background: 'var(--card)',
                border: '1.5px solid var(--line)', borderRadius: 16, boxShadow: 'var(--shadow-sm)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="var(--ink-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  className="input"
                  style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontSize: 13.5, padding: 0 }}
                  value={searchVal} placeholder="Search by name, department, or expertise"
                  onChange={(e) => debounceSearch(e.target.value)}
                />
              </div>
              <select
                className="input" style={{ width: 'auto', minWidth: 180 }}
                value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
              >
                {DEPTS.map((d) => <option key={d} value={d}>{d || 'All departments'}</option>)}
              </select>
            </div>
            {skillFilter && (
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Filtering by skill:</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 999,
                  background: 'var(--blue-soft)', color: 'var(--blue)',
                  fontSize: 12.5, fontWeight: 700,
                }}>
                  {skillFilter}
                  <button onClick={() => setSkillFilter('')} style={{
                    border: 'none', background: 'transparent', color: 'var(--blue)',
                    cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0,
                  }}>×</button>
                </span>
              </div>
            )}
          </div>
        </section>

        {/* AI mentor matcher */}
        <div style={{ marginTop: 18, padding: 18, borderRadius: 16,
                      border: '1.5px solid rgba(124,58,237,.3)', background: 'rgba(124,58,237,.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>🧕</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>Find your mentor with Baba</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Describe your goal and AI will match you to the best mentors.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={aiQuery} onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && findWithAI()}
              placeholder="e.g. I want to break into machine learning and prep for an FYP"
              style={{ flex: 1, minWidth: 240, padding: '11px 14px', borderRadius: 11,
                       border: '1.5px solid var(--line)', background: 'var(--card)', color: 'var(--ink)',
                       fontFamily: 'inherit', fontSize: 13.5, outline: 'none' }}
            />
            <button onClick={findWithAI} disabled={aiBusy} style={{
              padding: '11px 20px', borderRadius: 11, border: 'none', cursor: aiBusy ? 'wait' : 'pointer',
              background: 'linear-gradient(135deg,#7C3AED,#2563EB)', color: '#fff',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
            }}>{aiBusy ? 'Matching…' : 'Match me'}</button>
          </div>

          {aiMatches && aiMatches.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {aiMatches.map((m) => (
                <div key={m.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start',
                                         padding: 12, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <Avatar name={m.name} size={42} imgUrl={m.profile_image || ''} shape="square" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14 }}>{m.name}</strong>
                      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{m.department || 'NUST'}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.5 }}>
                      <span style={{ color: '#7C3AED', fontWeight: 700 }}>Why: </span>{m.reason}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="chip-btn" style={{ fontSize: 12, padding: '6px 10px' }}
                            onClick={() => navigate(`/profile?id=${m.id}`)}>View</button>
                    <button className="btn btn-primary" style={{ fontSize: 12, padding: '7px 12px' }}
                            onClick={() => navigate(`/messages?to=${m.id}&name=${encodeURIComponent(m.name)}`)}>Message</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
          gap: 20, marginTop: 22,
        }}>
          {loading ? (
            [0, 1, 2, 3, 4, 5].map((i) => <MentorCardSkeleton key={i} />)
          ) : mentors.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <p>No mentors found yet. Try another search.</p>
            </div>
          ) : mentors.map((m) => (
            <MentorCard
              key={m.id}
              m={m}
              isRequested={requested.has(m.id)}
              onProfile={() => navigate(`/profile?id=${m.id}`)}
              onMessage={() => navigate(`/messages?to=${m.id}&name=${encodeURIComponent(m.name)}`)}
              onConnect={() => requestMentorship(m.id, m.name)}
              onSkill={(s) => setSkillFilter(s)}
            />
          ))}
        </div>
      </div>
    </Sidebar>
  );
}

function MentorCard({ m, isRequested, onProfile, onMessage, onConnect, onSkill }) {
  const isVerified = (m.rating || 0) >= 4 && (m.rating_count || 0) >= 10;
  const skills = Array.isArray(m.skills) ? m.skills : [];

  return (
    <article
      className="card fade-up"
      style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 22,
               borderRadius: 24, cursor: 'pointer' }}
      onClick={onProfile}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <Avatar name={m.name} size={56} imgUrl={m.profile_image || ''} shape="square" online={m.is_online} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 15 }}>{m.name}</strong>
            {(m.followers_count || 0) >= FOLLOWERS_FOR_VERIFIED && <VerifiedTick size={15} />}
            {isVerified && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 9px', borderRadius: 999,
                background: 'var(--mint)', color: 'var(--mint-ink)',
                fontSize: 10.5, fontWeight: 700,
              }}>Verified Mentor</span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>
            {m.department || 'NUST'}{m.graduation_year ? ` · '${String(m.graduation_year).slice(-2)}` : ''}
            {m.is_online ? ' · Online now' : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
            <Stars rating={m.rating || 0} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>
              {Number(m.rating || 0).toFixed(1)}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>({m.rating_count || 0} ratings)</span>
          </div>
        </div>
      </div>

      <p style={{
        margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)',
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {m.bio || 'Available to help with academics, career decisions, and finding the right next step.'}
      </p>

      {skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {skills.slice(0, 5).map((s) => (
            <button key={s}
              onClick={(e) => { e.stopPropagation(); onSkill(s); }}
              style={{
                padding: '3px 9px', borderRadius: 999, cursor: 'pointer',
                border: '1px solid var(--blue-mid)', background: 'var(--blue-soft)',
                color: 'var(--blue)', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
              }}>{s}</button>
          ))}
        </div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 10, paddingTop: 14, borderTop: '1px solid var(--line)', marginTop: 'auto',
      }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {m.sessions_count || 0} mentoring sessions
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="chip-btn" style={{ fontSize: 12, padding: '6px 10px' }}
            onClick={(e) => { e.stopPropagation(); onMessage(); }}
          >Message</button>
          {isRequested ? (
            <button className="btn btn-ghost" disabled
                    style={{ fontSize: 12, padding: '8px 12px',
                             color: 'var(--blue)', borderColor: 'var(--blue-mid)', cursor: 'default' }}>
              ✓ Requested
            </button>
          ) : (
            <button
              className="btn btn-primary" style={{ fontSize: 12, padding: '8px 12px' }}
              onClick={(e) => { e.stopPropagation(); onConnect(); }}
            >Connect</button>
          )}
        </div>
      </div>
    </article>
  );
}

function Stars({ rating }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24"
             fill={i < Math.round(rating) ? '#f59e0b' : 'none'}
             stroke="#f59e0b" strokeWidth="2">
          <path d="M12 2l2.9 6.1 6.6.9-4.8 4.7 1.1 6.6L12 17l-5.9 3.3 1.1-6.6L2.5 9l6.6-.9L12 2z" />
        </svg>
      ))}
    </div>
  );
}
