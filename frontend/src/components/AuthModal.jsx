import { useEffect, useRef, useState } from 'react';
import { useNavigate }                  from 'react-router-dom';

import { useAuth }   from '../context/AuthContext.jsx';
import { toast }     from './Toast.jsx';
import SuccessPopup  from './SuccessPopup.jsx';

const NUST_DOMAINS = new Set([
  'nust.edu.pk', 'student.nust.edu.pk',
  'seecs.edu.pk',
  'smme.nust.edu.pk', 'scme.nust.edu.pk', 'scee.nust.edu.pk',
  'sns.nust.edu.pk',  's3h.nust.edu.pk',  'nbs.nust.edu.pk',
  'sese.nust.edu.pk', 'sada.nust.edu.pk', 'sines.nust.edu.pk',
  'asab.nust.edu.pk',
]);

function isNustEmail(email) {
  const parts = (email || '').trim().toLowerCase().split('@');
  return parts.length === 2 && NUST_DOMAINS.has(parts[1]);
}

const DEPTS = ['SEECS', 'NBS', 'SMME', 'CEME', 'SCME', 'S3H', 'ASAB', 'CAE', 'NISTE'];

// Multi-step auth modal: email -> OTP (or password) -> profile setup -> done.
// Mirrors the original /index.html flow exactly so behaviour is identical.

export default function AuthModal({ initialEmail = '', onClose }) {
  const navigate         = useNavigate();
  const { setAuth }      = useAuth();

  const [step, setStep]      = useState('email');     // email | otp | profile | done
  const [pwMode, setPwMode]  = useState(true);
  const [email, setEmail]    = useState(initialEmail);
  const [pw, setPw]          = useState('');
  const [otp, setOtp]        = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sentPopup, setSentPopup] = useState(false);

  const otpRefs = useRef([]);
  const verifyingRef = useRef(false);
  const sendingRef = useRef(false);
  const autoSentRef = useRef(false);

  // Auto-trigger send-otp on mount when an email was prefilled
  // (i.e. the user hit "Get started" from the landing form).
  // autoSentRef guards against StrictMode's double-mount in dev.
  useEffect(() => {
    if (autoSentRef.current) return;
    if (initialEmail && isNustEmail(initialEmail)) {
      autoSentRef.current = true;
      handleEmailSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helpers ----------------------------------------------------------
  const otpString = otp.join('');
  function setOtpDigit(idx, v) {
    const digit = v.replace(/\D/g, '').slice(0, 1);
    setOtp(prev => prev.map((d, i) => (i === idx ? digit : d)));
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
  }
  function handleOtpKey(e, idx) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  }
  function handleOtpPaste(e) {
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const next = [0, 1, 2, 3, 4, 5].map(i => text[i] || '');
    setOtp(next);
    e.preventDefault();
    otpRefs.current[Math.min(5, text.length - 1)]?.focus();
  }

  // When all digits are entered, the user can click Verify explicitly.

  // Handlers ---------------------------------------------------------
  async function handleEmailSubmit() {
    if (sendingRef.current) return;
    const clean = email.trim();
    if (!isNustEmail(clean)) { toast('Please enter a valid NUST institutional email.'); return; }
    sendingRef.current = true;
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/send-otp', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ email: clean }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOtp(['', '', '', '', '', '']);
      setStep('otp');
      setSentPopup(true);
      setTimeout(() => setSentPopup(false), 2500);
    } catch (err) {
      toast(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  }

  async function handleVerify(code = otpString) {
    if (verifyingRef.current) return;
    if (code.length !== 6) return;
    verifyingRef.current = true;
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/verify-otp', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.is_new_user) {
        sessionStorage.setItem('pb_setup_token', data.token);
        setStep('profile');
      } else {
        setAuth(data.token, data.user);
        setStep('done');
        setTimeout(() => navigate('/feed'), 800);
      }
    } catch (err) {
      toast(err.message || 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  }

  async function handlePwLogin() {
    if (!email.trim() || !pw) { toast('Enter your email and password'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ email: email.trim(), password: pw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAuth(data.token, data.user);
      setStep('done');
      setTimeout(() => navigate('/feed'), 800);
    } catch (err) {
      toast(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {sentPopup && <SuccessPopup message="Code sent! Check your inbox." />}
      <div className="lp-auth-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="lp-auth-modal">
        <button className="lp-auth-close" onClick={onClose}>X</button>
        <div className="lp-auth-body">
          {step === 'email'   && <EmailStep   {...{ email, setEmail, pw, setPw, pwMode, setPwMode, loading, handleEmailSubmit, handlePwLogin }} />}
          {step === 'otp'     && <OtpStep     {...{ email, otp, otpRefs, loading, setOtpDigit, handleOtpKey, handleOtpPaste, handleVerify, back: () => setStep('email') }} />}
          {step === 'profile' && <ProfileStep onDone={(token, user) => { setAuth(token, user); setStep('done'); setTimeout(() => navigate('/feed'), 800); }} />}
          {step === 'done'    && <DoneStep />}
        </div>
      </div>
    </div>
    </>
  );
}

/* ── Sub-step components ──────────────────────────────────────────── */

function Spinner() {
  return <span className="lp-spinner" />;
}

function EmailStep({ email, setEmail, pw, setPw, pwMode, setPwMode, loading, handleEmailSubmit, handlePwLogin }) {
  if (pwMode) {
    return (
      <>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: '#0D1B2A', marginBottom: 5 }}>Welcome back</div>
          <div style={{ fontSize: 13.5, color: '#8899B0' }}>Sign in to your Peer Bridge account</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email" placeholder="your.name@nust.edu.pk" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="lp-auth-input"
          />
          <input
            type="password" placeholder="Password" value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePwLogin()}
            className="lp-auth-input"
          />
          <button onClick={handlePwLogin} className="lp-big-btn">{loading ? <Spinner /> : 'Sign in -->'}</button>
        </div>
      </>
    );
  }

  const showErr = email && !isNustEmail(email);
  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: '#0D1B2A', marginBottom: 5 }}>Join Peer Bridge</div>
        <div style={{ fontSize: 13.5, color: '#8899B0' }}>Enter your NUST email to get started</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <input
            type="email" placeholder="your.name@nust.edu.pk" value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
            className="lp-auth-input"
            autoFocus
          />
          <div style={{ display: showErr ? 'block' : 'none', fontSize: 12, color: '#DC2626', marginTop: 5, paddingLeft: 2 }}>
            Only NUST institutional emails are allowed (e.g. @nust.edu.pk, @seecs.edu.pk, @nbs.nust.edu.pk).
          </div>
        </div>
        <button onClick={handleEmailSubmit} className="lp-big-btn">{loading ? <Spinner /> : 'Send code -->'}</button>
      </div>
    </>
  );
}

function OtpStep({ email, otp, otpRefs, loading, setOtpDigit, handleOtpKey, handleOtpPaste, handleVerify, back }) {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: '#0D1B2A', marginBottom: 5 }}>Check your email</div>
        <div style={{ fontSize: 13.5, color: '#8899B0' }}>
          6-digit code sent to <strong style={{ color: '#4B5C73' }}>{email}</strong>
        </div>
      </div>
      <div style={{
        marginBottom: 18, padding: '10px 12px',
        background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 9,
        fontSize: 12.5, color: '#92400E', lineHeight: 1.5,
        display: 'flex', gap: 8, alignItems: 'flex-start',
      }}>
        <span style={{ flexShrink: 0, fontSize: 14 }}>⚠️</span>
        <span>Can't find the email? It may be in your <strong>spam or junk</strong> folder.</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => (otpRefs.current[i] = el)}
            value={digit}
            inputMode="numeric"
            maxLength={1}
            onChange={(e) => setOtpDigit(i, e.target.value)}
            onKeyDown={(e) => handleOtpKey(e, i)}
            onPaste={i === 0 ? handleOtpPaste : undefined}
            className="lp-otp-box"
            autoFocus={i === 0}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={back} className="lp-ghost-btn">&larr; Back</button>
        <button
          onClick={() => handleVerify(otp.join(''))}
          className="lp-big-btn"
          disabled={loading || otp.join('').length !== 6}
        >{loading ? <Spinner /> : 'Verify code'}</button>
      </div>
    </>
  );
}

function ProfileStep({ onDone }) {
  const [name, setName]      = useState('');
  const [dept, setDept]      = useState('');
  const [role, setRole]      = useState('student');
  const [bio, setBio]        = useState('');
  const [pw,  setPw]         = useState('');
  const [imgFile, setImgFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);

  function handleFile(e) {
    const f = e.target.files?.[0];
    setImgFile(f || null);
    if (f) setPreview(URL.createObjectURL(f));
  }

  async function submit() {
    if (!name.trim()) { toast('Name is required'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('department', dept);
      fd.append('role', role);
      fd.append('bio', bio);
      fd.append('password', pw);
      if (imgFile) fd.append('profile_image', imgFile);

      const setupToken = sessionStorage.getItem('pb_setup_token');
      const res        = await fetch('/api/auth/setup-profile', {
        method : 'POST',
        headers: { Authorization: `Bearer ${setupToken}` },
        body   : fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      sessionStorage.removeItem('pb_setup_token');
      onDone(data.token, data.user);
    } catch (err) {
      toast(err.message || 'Profile setup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: '#0D1B2A', marginBottom: 5 }}>Complete your profile</div>
        <div style={{ fontSize: 13.5, color: '#8899B0' }}>Tell us a bit about yourself</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '6px 0' }}>
          <label htmlFor="p-img" style={{
            width: 76, height: 76, borderRadius: '50%', background: '#EFF3FF',
            border: '2px dashed #93C5FD', display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', cursor: 'pointer',
          }}>
            {preview
              ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                     stroke="#93C5FD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              )}
          </label>
          <label htmlFor="p-img" style={{ fontSize: 12.5, color: '#2563EB', cursor: 'pointer', fontWeight: 600 }}>
            Upload photo <span style={{ color: '#8899B0', fontWeight: 400 }}>(optional)</span>
          </label>
          <input id="p-img" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </div>
        <input className="lp-auth-input" placeholder="Full name *" value={name} onChange={(e) => setName(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <select className="lp-auth-input" style={{ background: '#fff', cursor: 'pointer' }}
                  value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">Department</option>
            {DEPTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select className="lp-auth-input" style={{ background: '#fff', cursor: 'pointer' }}
                  value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="student">Student</option>
            <option value="mentor">Mentor</option>
          </select>
        </div>
        <textarea className="lp-auth-input" rows={3} value={bio} onChange={(e) => setBio(e.target.value)}
                  placeholder="Short bio - what you study, interests, how you can help others (optional)"
                  style={{ resize: 'none', lineHeight: 1.55 }} />
        <input className="lp-auth-input" type="password" placeholder="Set a password (optional)"
               value={pw} onChange={(e) => setPw(e.target.value)} />
        <button onClick={submit} className="lp-big-btn">
          {loading ? <Spinner /> : 'Create my account -->'}
        </button>
      </div>
    </>
  );
}

function DoneStep() {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%', background: '#F0FDF4',
        border: '1.5px solid #BBF7D0', display: 'flex', alignItems: 'center',
        justifyContent: 'center', margin: '0 auto 18px',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
             stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round">
          <path d="m5 13 4 4 10-10" />
        </svg>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0D1B2A', marginBottom: 8 }}>All set!</div>
      <div style={{ fontSize: 14, color: '#8899B0' }}>Redirecting you to your feed…</div>
    </div>
  );
}
