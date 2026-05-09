import { useEffect, useState } from 'react';
import { Navigate }            from 'react-router-dom';

import { useAuth }   from '../context/AuthContext.jsx';
import AuthModal     from '../components/AuthModal.jsx';
import InfoModal     from '../components/InfoModal.jsx';
import BridgeLogo    from '../components/BridgeLogo.jsx';
import ToastHost     from '../components/Toast.jsx';

import '../styles/landing.css';

// Marketing landing page. 1:1 visual port of the original
// frontend/index.html, with the inline scripts converted to React state
// and the auth modal extracted into <AuthModal />.

const NUST_RE = /^[a-z0-9._-]+@(student\.)?nust\.edu\.pk$/i;

export default function Landing() {
  const { token } = useAuth();
  const [heroEmail, setHeroEmail] = useState('');
  const [heroErr,   setHeroErr]   = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEmail, setModalEmail] = useState('');
  const [infoKey,    setInfoKey]   = useState(null);   // 'about' | 'blog' | 'contact' | 'privacy' | 'terms' | 'support'

  // Reveal-on-scroll animation for ".reveal" elements.
  // NOTE: this useEffect MUST run on every render path, including the
  // "already signed in" one, otherwise the hook order changes between
  // the pre-login render (5 hooks) and the post-login render (4 hooks)
  // and React throws "rendered fewer hooks than expected", which blanks
  // the page. Keep the early return *below* every hook.
  useEffect(() => {
    if (token) return; // nothing to observe; we're about to navigate away
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('on'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.landing .reveal').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [token]);

  // Already signed in -> jump straight to the feed.
  if (token) return <Navigate to="/feed" replace />;

  function openAuth(prefill = '') {
    setModalEmail(prefill);
    setModalOpen(true);
  }

  function onHeroSubmit() {
    const v = heroEmail.trim();
    setHeroErr(!!v && !NUST_RE.test(v));
    openAuth(v);
  }

  return (
    <div className="landing">
      <ToastHost />

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav>
        <a href="#" className="lp-logo" onClick={(e) => e.preventDefault()}>
          <BridgeLogo width={44} height={30} variant="brand" />
          <span className="lp-logo-wm">Peer Bridge</span>
        </a>

        <ul className="lp-nav-links">
          <li><a href="#hiw">How it works</a></li>
          <li><a href="#features">Resources</a></li>
          <li><a href="#" onClick={(e) => e.preventDefault()}>About</a></li>
        </ul>

        <div className="lp-nav-ctas">
          <button className="lp-btn-outline" onClick={() => openAuth()}>Sign in</button>
          <button className="lp-btn-blue"    onClick={() => openAuth()}>Get started</button>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <div className="hero-banner">
        <div className="hero-img" />
        <div className="hero-overlay" />
        <div className="hero-text">
          <div className="hero-eyebrow">Verified NUST community · 2,847 students</div>
          <h1 className="hero-h1">
            The bridge between<br />
            <em>where you are</em><br />
            and where they&apos;ve been.
          </h1>
          <p className="hero-sub">
            Connect with verified NUST seniors for mentorship, career guidance, and shared resources.
          </p>
          <div className="hero-form">
            <input
              type="email" placeholder="Enter your NUST email"
              value={heroEmail}
              onChange={(e) => {
                setHeroEmail(e.target.value);
                setHeroErr(!!e.target.value.trim() && !NUST_RE.test(e.target.value.trim()));
              }}
              onKeyDown={(e) => e.key === 'Enter' && onHeroSubmit()}
            />
            <button onClick={onHeroSubmit}>Get started -&gt;</button>
          </div>
          {heroErr && (
            <div className="hero-err">Only NUST email addresses are allowed.</div>
          )}
          <p className="hero-note"><b>NUST-only</b> · Verified seniors · <b>Free forever</b></p>
        </div>
      </div>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section className="feat-section" id="features">
        <div className="feat-inner">
          <div className="feat-header reveal">
            <span className="feat-tag">What&apos;s inside</span>
            <h2 className="feat-h2">Everything you need, in one place</h2>
            <p className="feat-lead">Four pillars designed around how NUST students actually ask for help.</p>
          </div>

          <div className="feat-grid">
            {FEATURE_CARDS.map((f, i) => (
              <div key={f.title} className={`feat-card reveal${i ? ` d${i}` : ''}`}>
                <div className="feat-icon">{f.icon}</div>
                <div className="feat-h">{f.title}</div>
                <p className="feat-p">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────── */}
      <div className="stats-strip">
        <div className="stats-inner">
          <Stat n="2,847" label="Verified students"  emClass=""        />
          <Stat n="430"    label="Senior mentors"      emClass="d1"     />
          <Stat n="12k+"   label="Questions answered"  emClass="d2"     />
          <Stat n="98%"    label="Satisfaction rate"   emClass="d3"     />
        </div>
      </div>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section className="hiw-section" id="hiw">
        <div className="hiw-inner">
          <div className="hiw-top reveal">
            <span className="hiw-tag">How it works</span>
            <h2 className="hiw-h2">Three steps to your <em>Mentor</em></h2>
          </div>
          <div className="steps">
            {HIW_STEPS.map((s, i) => (
              <div key={s.title} className={`step reveal${i ? ` d${i}` : ''}`}>
                <div className="step-num">{String(i + 1).padStart(2, '0')}</div>
                <div className="step-ico">{s.icon}</div>
                <div className="step-h">{s.title}</div>
                <p className="step-p">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ height: 60, background: 'white' }} />

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="cta-section">
        <div className="cta-bg" />
        <div className="cta-content reveal">
          <h2 className="cta-h">Your bridge is waiting.<br /><em>Step onto it.</em></h2>
          <p className="cta-p">
            Join 2,847 NUST students already learning from verified seniors<br />
            who&apos;ve walked your exact path.
          </p>
          <div className="cta-btns">
            <button className="cta-btn-pri" onClick={() => openAuth()}>Join free - it takes 2 minutes</button>
            <button className="cta-btn-sec" onClick={() => openAuth()}>Become a mentor</button>
          </div>
        </div>
      </section>

      <div style={{ height: 60, background: 'white' }} />

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer>
        <div className="footer-in">
          <div className="footer-grid">
            <div>
              <a href="#" className="lp-logo" onClick={(e) => e.preventDefault()}>
                <BridgeLogo width={44} height={30} variant="brand" />
                <span className="lp-logo-wm">Peer Bridge</span>
              </a>
              <p className="footer-blurb">The structured mentorship platform built for NUST - by NUST students.</p>
            </div>
            {FOOTER_COLS.map((col) => (
              <div className="footer-col" key={col.h}>
                <h5>{col.h}</h5>
                <ul>
                  {col.items.map((item) => {
                    const label = typeof item === 'string' ? item : item.label;
                    const key   = typeof item === 'string' ? null   : item.key;
                    return (
                      <li key={label}>
                        <a href="#" onClick={(e) => {
                          e.preventDefault();
                          if (key) setInfoKey(key);
                        }}>{label}</a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="footer-bottom">
            <span className="footer-copy">© 2026 Peer Bridge. Built at NUST, for NUST.</span>
            <div className="footer-lnks">
              <a href="#" onClick={(e) => { e.preventDefault(); setInfoKey('privacy'); }}>Privacy</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setInfoKey('terms');   }}>Terms</a>
              <a href="#" onClick={(e) => { e.preventDefault(); setInfoKey('support'); }}>Support</a>
            </div>
          </div>
        </div>
      </footer>

      {modalOpen && <AuthModal initialEmail={modalEmail} onClose={() => setModalOpen(false)} />}
      {infoKey && (
        <InfoModal title={INFO_CONTENT[infoKey].title} onClose={() => setInfoKey(null)}>
          {INFO_CONTENT[infoKey].body}
        </InfoModal>
      )}
    </div>
  );
}

function Stat({ n, label, emClass }) {
  // The original page italicises just the number.
  return (
    <div className={`stat-cell reveal ${emClass}`}>
      <div className="stat-n"><em>{n}</em></div>
      <div className="stat-l">{label}</div>
    </div>
  );
}

const FEATURE_CARDS = [
  {
    title: 'Academic Help',
    body : 'Post a question, get mentored answers from verified seniors in your department. Threaded and searchable.',
    icon : (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
  },
  {
    title: 'Career & Interns',
    body : "Resume reviews, interview prep, and direct referrals from alumni who've secured the roles you're targeting.",
    icon : (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round">
        <polyline points="21 6 12.5 14.5 7.5 9.5 1 16" />
        <polyline points="15 6 21 6 21 12" />
      </svg>
    ),
  },
  {
    title: 'Events & Societies',
    body : 'Never miss a recruitment drive or society open-house again. Verified NUST events curated to your feed.',
    icon : (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round">
        <rect x="2" y="3" width="18" height="18" rx="2" />
        <line x1="15" y1="1" x2="15" y2="5" /><line x1="7" y1="1" x2="7" y2="5" /><line x1="2" y1="9" x2="20" y2="9" />
      </svg>
    ),
  },
  {
    title: 'Resource Library',
    body : 'Past papers, roadmaps, notes - curated by cohort. Stop searching Drive; start learning immediately.',
    icon : (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#2563EB" strokeWidth="1.7" strokeLinecap="round">
        <path d="M21 18a2 2 0 01-2 2H3a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
    ),
  },
];

const HIW_STEPS = [
  {
    title: 'Create your profile',
    body : "Sign up with your NUST email. Student status is verified automatically and you're placed in your department community.",
    icon : (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#60A5FA" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="11" cy="8" r="4" /><path d="M3 19c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    title: 'Find your mentor',
    body : 'Browse verified seniors by department, expertise, and availability. Filter by career track or research interest.',
    icon : (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#60A5FA" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="10" cy="10" r="7" /><path d="M17 17l3 3" />
      </svg>
    ),
  },
  {
    title: 'Start growing',
    body : 'Ask questions, book sessions, and access curated resources - all in one structured, trusted platform.',
    icon : (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#60A5FA" strokeWidth="1.7" strokeLinecap="round">
        <path d="M5 11l4 4 8-8" />
      </svg>
    ),
  },
];

// String items render as plain decorative links; { label, key } items
// open the matching InfoModal on click.
const FOOTER_COLS = [
  { h: 'Platform',  items: ['Academic Help', 'Career & Interns', 'Events', 'Resource Library'] },
  { h: 'Community', items: ['For juniors', 'For mentors', 'Departments', 'Leaderboard'] },
  { h: 'Company',   items: [
      { label: 'About',   key: 'about'   },
      { label: 'Blog',    key: 'blog'    },
      { label: 'Contact', key: 'contact' },
      { label: 'Privacy', key: 'privacy' },
    ],
  },
];

const INFO_CONTENT = {
  about: {
    title: 'About Peer Bridge',
    body: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          Peer Bridge is a student-built mentorship platform that connects NUST
          juniors with verified seniors for academic help, career guidance, and
          curated learning resources.
        </p>
        <p style={{ margin: '0 0 12px' }}>
          The platform was developed as a fourth-semester Web Technologies course
          project at the School of Electrical Engineering &amp; Computer Science
          (SEECS), NUST Islamabad.
        </p>
        <p style={{ margin: '16px 0 12px' }}>
          Made by <strong>Sami Ullah</strong>, <strong>Muhammad Ahmad</strong> and <strong>Fazalhadi</strong>.
        </p>
        <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0D1B2A', margin: '16px 0 8px' }}>
          Tech stack
        </h4>
        <p style={{ margin: 0 }}>
          MongoDB, Express.js, React (Vite), Node.js — with JWT auth, bcryptjs,
          Multer for uploads, and PDFKit for the Verified Mentor Certificate.
        </p>
      </>
    ),
  },

  blog: {
    title: 'Peer Bridge Blog',
    body: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          We&apos;re working on a blog to share NUST-specific guides, mentor
          spotlights, and platform updates. Until then, here&apos;s what&apos;s coming up:
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>How to land your first SEECS internship — a step-by-step playbook</li>
          <li>FYP supervisor selection: a guide for third-year students</li>
          <li>Mentor stories: from CS-101 to Google Singapore</li>
          <li>NUST Job Fair survival kit</li>
        </ul>
        <p style={{ margin: '14px 0 0', color: '#8899B0', fontStyle: 'italic' }}>
          Want to contribute an article? Email the team using the Contact page.
        </p>
      </>
    ),
  },

  contact: {
    title: 'Contact the Team',
    body: (
      <>
        <p style={{ margin: '0 0 14px' }}>
          We&apos;d love to hear from you — feature requests, bug reports, or
          just to say hi.
        </p>
        <ContactRow label="Email"   value="peerbridge@seecs.edu.pk" />
        <ContactRow label="GitHub"  value="github.com/peerbridge-nust" />
        <ContactRow label="Campus"  value="SEECS, NUST H-12, Islamabad" />
        <p style={{ margin: '16px 0 0', color: '#4B5C73' }}>
          For mentorship-specific questions, sign in and message any verified
          mentor directly through the platform.
        </p>
      </>
    ),
  },

  privacy: {
    title: 'Privacy Policy',
    body: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          Peer Bridge is built for the NUST community and treats your data with
          the same care you&apos;d expect from any university service.
        </p>
        <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0D1B2A', margin: '14px 0 8px' }}>
          What we collect
        </h4>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Your NUST email (used only to verify you&apos;re a student/alum)</li>
          <li>Profile fields you choose to fill in: name, department, bio, photo</li>
          <li>Posts, replies, messages, and resources you upload</li>
          <li>XP and rating data tied to your account</li>
        </ul>
        <h4 style={{ fontSize: 14, fontWeight: 800, color: '#0D1B2A', margin: '14px 0 8px' }}>
          What we never do
        </h4>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Sell your data, ever</li>
          <li>Share private messages with anyone outside the conversation</li>
          <li>Use your content for advertising</li>
        </ul>
        <p style={{ margin: '14px 0 0' }}>
          You can delete your account and all associated data at any time from
          the profile page.
        </p>
      </>
    ),
  },

  terms: {
    title: 'Terms of Use',
    body: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          By using Peer Bridge you agree to act in good faith with the rest of
          the NUST community. The short version:
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Be respectful — harassment or hate speech results in account suspension.</li>
          <li>Don&apos;t impersonate other students or staff.</li>
          <li>Resources you upload must be yours to share, or freely shareable.</li>
          <li>Mentor ratings should reflect genuine experience, not personal grievances.</li>
          <li>Reports are reviewed by the platform team — false reports may also lead to suspension.</li>
        </ul>
        <p style={{ margin: '14px 0 0' }}>
          We may update these terms as the platform grows; significant changes
          will be announced in the feed.
        </p>
      </>
    ),
  },

  support: {
    title: 'Support',
    body: (
      <>
        <p style={{ margin: '0 0 12px' }}>
          Having trouble? Most issues fall into one of these:
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><strong>Can&apos;t receive an OTP?</strong> Check your spam folder; in dev mode the OTP also prints in the modal.</li>
          <li><strong>Account locked?</strong> Multiple community reports temporarily lock an account. Email the team to appeal.</li>
          <li><strong>Mentor rating dropped?</strong> Mentors below 2.0 with 5+ reviews are placed under review until ratings improve.</li>
          <li><strong>Certificate not generating?</strong> You need at least 500 XP and a 24-hour gap since your last regenerate.</li>
        </ul>
        <p style={{ margin: '14px 0 0' }}>
          Still stuck? Reach the team at <strong>peerbridge@seecs.edu.pk</strong>.
        </p>
      </>
    ),
  },
};

function ContactRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '6px 0' }}>
      <div style={{
        flex: '0 0 70px', fontSize: 11, fontWeight: 700,
        letterSpacing: 1.4, textTransform: 'uppercase',
        color: '#8899B0', paddingTop: 3,
      }}>{label}</div>
      <div style={{ fontSize: 14, color: '#0D1B2A', fontWeight: 600 }}>{value}</div>
    </div>
  );
}
