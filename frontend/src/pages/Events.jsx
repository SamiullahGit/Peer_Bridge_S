import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

import Sidebar    from '../components/Sidebar.jsx';
import Avatar     from '../components/Avatar.jsx';
import ToastHost, { toast }  from '../components/Toast.jsx';
import { pb }     from '../api/client.js';
import { EventCardSkeleton } from '../components/Skeleton.jsx';

const CATS        = ['', 'Academic', 'Career', 'Society', 'Workshop', 'Other'];
const CAT_COLORS  = {
  Academic: '#c7d9ff', Career: '#fde8f0', Society: '#d4f1e3',
  Workshop: '#ffe4cc', Other: '#e9d7fb',
};
const CAT_COLORS_DARK = {
  Academic: '#0f1a2b', Career: '#1c0d14', Society: '#0a1912',
  Workshop: '#1a1008', Other: '#130a1f',
};

export default function Events() {
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [catFilter, setCatFilter] = useState('');
  const [viewMode, setViewMode]   = useState('upcoming');     // 'upcoming' | 'past'
  const [openModal, setOpenModal] = useState(null);            // event object | null
  const [showCreate, setShowCreate] = useState(false);
  const [creating,   setCreating]   = useState(false);

  useEffect(() => { loadEvents(); /* eslint-disable-next-line */ }, [catFilter, viewMode]);

  async function loadEvents() {
    const q = new URLSearchParams({ when: viewMode });
    if (catFilter) q.set('category', catFilter);
    setLoading(true);
    try { setEvents(await pb.get('/events?' + q)); }
    catch { /* silent */ }
    finally { setLoading(false); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const form      = e.target;
    const eventDate = form.event_date.value;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (new Date(eventDate) < today) { toast('Event date cannot be in the past'); return; }
    if (!form.venue.value.trim())    { toast('Venue is required'); return; }

    setCreating(true);
    try {
      await pb.upload('/events', new FormData(form));
      setShowCreate(false);
      await loadEvents();
      toast('Event created!');
    } catch (err) {
      toast('Failed: ' + err.message);
    } finally {
      setCreating(false);
    }
  }

  const topnavMid = (
    <>
      <div style={{ flex: 1 }} />
      <button
        className="btn btn-primary" onClick={() => setShowCreate(true)}
        style={{ padding: '9px 14px', fontSize: 13, flexShrink: 0,
                 display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="white" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14" /><path d="M5 12h14" />
        </svg>
        Add event
      </button>
    </>
  );

  return (
    <Sidebar active="events" topnavMid={topnavMid}>
      <ToastHost />
      <div className="page-shell">
        <section className="page-hero" style={{ marginBottom: 22 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12, position: 'relative', zIndex: 1,
          }}>
            <div>
              <div className="tag tag-lav" style={{ marginBottom: 12 }}>Campus calendar</div>
              <h1 className="section-title">Events &amp; Societies</h1>
              <p className="section-subtitle">
                {loading
                  ? 'Loading events…'
                  : `${events.length} ${viewMode === 'past' ? 'past' : 'upcoming'} event${events.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <ViewToggle mode={viewMode} onChange={setViewMode} />
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
          </div>
        </section>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 20,
        }}>
          {loading ? (
            [0, 1, 2, 3, 4, 5].map((i) => <EventCardSkeleton key={i} />)
          ) : events.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <p>{viewMode === 'past' ? 'No past events to show.' : 'No upcoming events.'}</p>
            </div>
          ) : events.map((e) => (
            <EventCard key={e.id} e={e} viewMode={viewMode} onClick={() => setOpenModal(e)} />
          ))}
        </div>
      </div>

      {openModal  && <EventModal event={openModal} onClose={() => setOpenModal(null)} />}
      {showCreate && (
        <CreateEventModal
          creating={creating}
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </Sidebar>
  );
}

function CreateEventModal({ creating, onSubmit, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(26,31,58,.25)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card fade-up" style={{
        width: '100%', maxWidth: 540, padding: 0,
        boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div className="serif" style={{ fontSize: 22 }}>Create an Event</div>
          <button className="chip-btn" onClick={onClose} style={{ padding: 6 }}>X</button>
        </div>
        <form onSubmit={onSubmit} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input name="title" className="input" placeholder="Title *" required
                 style={{ padding: '11px 14px', fontSize: 14 }} />
          <input name="venue" className="input" placeholder="Venue *" required
                 style={{ padding: '11px 14px', fontSize: 14 }} />
          <div className="form-two-col">
            <input name="event_date" type="date" className="input" required
                   style={{ padding: '11px 14px', fontSize: 14 }} />
            <input name="event_time" type="time" className="input"
                   style={{ padding: '11px 14px', fontSize: 14 }} />
          </div>
          <select name="category" className="input" defaultValue="Other"
                  style={{ padding: '11px 14px', fontSize: 14 }}>
            {CATS.filter((c) => c).map((c) => <option key={c}>{c}</option>)}
          </select>
          <textarea name="description" className="input" rows={3} placeholder="Description (optional)"
                    style={{ resize: 'vertical', fontSize: 14 }} />
          <input name="image" type="file" accept="image/*" className="input" />
          <button type="submit" className="btn btn-primary" disabled={creating} style={{ padding: 13 }}>
            {creating ? 'Creating…' : 'Create event'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ViewToggle({ mode, onChange }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div role="tablist" aria-label="Show events" style={{
      display: 'inline-flex', background: isDark ? 'var(--bg-2)' : '#f1f5f9',
      border: '1px solid var(--line)', borderRadius: 999, padding: 3, gap: 2,
    }}>
      {[
        ['upcoming', 'Upcoming'],
        ['past',     'Past'],
      ].map(([key, label]) => {
        const active = mode === key;
        return (
          <button
            key={key}
            role="tab" aria-selected={active}
            onClick={() => onChange(key)}
            style={{
              border: 'none', background: active ? 'var(--card)' : 'transparent',
              font: 'inherit', fontSize: 12.5, fontWeight: 600,
              color: active ? 'var(--blue)' : 'var(--ink-2)',
              padding: '7px 16px', borderRadius: 999, cursor: 'pointer',
              boxShadow: active ? '0 1px 4px rgba(15,23,42,.08)' : 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >{label}</button>
        );
      })}
    </div>
  );
}

function EventCard({ e, viewMode, onClick }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const d        = new Date(e.event_date);
  const month    = d.toLocaleString('en', { month: 'short' }).toUpperCase();
  const day      = d.getDate();
  const bg       = (isDark ? CAT_COLORS_DARK : CAT_COLORS)[e.category] || (isDark ? '#130a1f' : '#e9d7fb');
  const isPast   = viewMode === 'past';

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--card)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)', cursor: 'pointer', position: 'relative',
        opacity: isPast ? 0.82 : 1,
      }}
    >
      {isPast && (
        <span style={{
          position: 'absolute', top: 12, left: 12, zIndex: 3,
          fontSize: 9.5, fontWeight: 800, letterSpacing: '.14em', color: '#fff',
          background: 'rgba(15,23,42,.55)', padding: '4px 9px', borderRadius: 6,
          backdropFilter: 'blur(6px)',
        }}>PAST</span>
      )}
      {e.image_path ? (
        <div style={{ position: 'relative', height: 160, overflow: 'hidden' }}>
          <img src={e.image_path} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,.02), rgba(0,0,0,.38))' }} />
          <CardOverlay e={e} day={day} month={month} />
        </div>
      ) : (
        <div style={{ background: bg, padding: '20px 22px',
                      display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'center', minWidth: 52 }}>
            <div className="serif" style={{ fontSize: 36, lineHeight: 1, fontWeight: 400 }}>{day}</div>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700,
                          color: 'var(--ink-2)', marginTop: 2 }}>{month}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="serif" style={{ fontSize: 20, lineHeight: 1.2, marginBottom: 4 }}>{e.title}</div>
            <span className="tag" style={{ fontSize: 11, padding: '3px 8px' }}>{e.category || 'Event'}</span>
          </div>
        </div>
      )}

      <div style={{ padding: '16px 22px' }}>
        {e.description && (
          <p style={{
            margin: '0 0 12px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{e.description}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {e.venue && <Row label={e.venue} icon={MapIcon} />}
          {e.event_time && (
            <Row label={new Date('1970-01-01T' + e.event_time)
              .toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })} icon={ClockIcon} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Avatar name={e.organizer_name} size={22} />
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>by {e.organizer_name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardOverlay({ e, day, month }) {
  return (
    <div style={{
      position: 'absolute', bottom: 14, left: 16, right: 16,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    }}>
      <div>
        <div className="serif" style={{ fontSize: 19, lineHeight: 1.2,
              color: 'white', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>{e.title}</div>
        <span className="tag" style={{
          fontSize: 11, padding: '3px 8px', marginTop: 4,
          background: 'rgba(255,255,255,.18)', borderColor: 'rgba(255,255,255,.3)', color: 'white',
        }}>{e.category || 'Event'}</span>
      </div>
      <div style={{
        textAlign: 'center', background: 'rgba(255,255,255,.9)',
        borderRadius: 10, padding: '6px 10px', flexShrink: 0,
      }}>
        <div className="serif" style={{ fontSize: 26, lineHeight: 1, fontWeight: 400, color: 'var(--ink)' }}>{day}</div>
        <div style={{ fontSize: 9, letterSpacing: '0.1em', fontWeight: 700,
                      color: 'var(--ink-2)', marginTop: 1 }}>{month}</div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)' }}>
      <Icon /> {label}
    </div>
  );
}
function MapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="var(--ink-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" /><path d="M9 3v15m6-12v15" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="var(--ink-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
    </svg>
  );
}

function EventModal({ event, onClose }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(26,31,58,.25)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--card)', borderRadius: 18, maxWidth: 600, width: '100%',
        boxShadow: 'var(--shadow-lg)', overflow: 'hidden', border: '1px solid var(--line)',
      }}>
        {event.image_path
          ? (
            <div style={{ position: 'relative', height: 220, overflow: 'hidden' }}>
              <img src={event.image_path} alt=""
                   style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0,
                            background: 'linear-gradient(to bottom, rgba(0,0,0,.02), rgba(0,0,0,.38))' }} />
              <CardOverlay e={event}
                           day={new Date(event.event_date).getDate()}
                           month={new Date(event.event_date).toLocaleString('en', { month: 'short' }).toUpperCase()} />
            </div>
          )
          : (
            <div style={{
              background: (isDark ? CAT_COLORS_DARK : CAT_COLORS)[event.category] || (isDark ? '#130a1f' : '#e9d7fb'),
              padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{ textAlign: 'center', minWidth: 52 }}>
                <div className="serif" style={{ fontSize: 36, lineHeight: 1, fontWeight: 400 }}>
                  {new Date(event.event_date).getDate()}
                </div>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700,
                              color: 'var(--ink-2)', marginTop: 2 }}>
                  {new Date(event.event_date).toLocaleString('en', { month: 'short' }).toUpperCase()}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="serif" style={{ fontSize: 20, lineHeight: 1.2, marginBottom: 4 }}>
                  {event.title}
                </div>
                <span className="tag" style={{ fontSize: 11, padding: '3px 8px' }}>{event.category || 'Event'}</span>
              </div>
            </div>
          )}
        <div style={{ padding: '22px 22px 18px 22px' }}>
          {event.description && (
            <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              {event.description}
            </p>
          )}
          {event.venue && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink-2)', marginBottom: 6 }}><MapIcon /> {event.venue}</div>}
          {event.event_time && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink-2)', marginBottom: 6 }}>
              <ClockIcon /> {new Date('1970-01-01T' + event.event_time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Avatar name={event.organizer_name} size={26} />
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>by {event.organizer_name}</span>
          </div>
          <button onClick={onClose} style={{
            marginTop: 18, width: '100%', padding: '10px 0',
            fontSize: 15, fontWeight: 600, background: 'var(--blue)',
            color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer',
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}
