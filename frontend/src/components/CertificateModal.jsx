import { useEffect, useState } from 'react';

import { pb }      from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { toast }   from './Toast.jsx';

const LEVEL_COLOR = {
  Bronze: '#CD7F32', Silver: '#A8A9AD',
  Gold  : '#C5A028', Platinum: '#6fa8c8',
  Legend: '#9B59B6',
};

// Modal that triggers PDF generation server-side, then offers a
// download / copy / LinkedIn share row.

export default function CertificateModal({ stats, onClose, onGenerated }) {
  const { user }                      = useAuth();
  const [certNumber, setCertNumber]   = useState('Generating…');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [status, setStatus]           = useState('Generating your certificate…');

  useEffect(() => { generate(); /* eslint-disable-next-line */ }, []);

  async function generate() {
    try {
      const data = await pb.post('/certificates/generate', {});
      setCertNumber(data.certNumber);
      setDownloadUrl(data.downloadUrl);
      setStatus('Your certificate is ready!');
      onGenerated?.();
    } catch (err) {
      setCertNumber('Error');
      setStatus(err.message || 'Failed to generate certificate.');
    }
  }

  function downloadCert() {
    if (!downloadUrl) return;
    const a    = document.createElement('a');
    a.href     = downloadUrl;
    a.download = `PeerBridge-Certificate-${certNumber}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  function copyCertNumber() {
    if (!certNumber || certNumber === 'Generating…' || certNumber === 'Error') {
      toast('Certificate not generated yet.'); return;
    }
    navigator.clipboard?.writeText(certNumber)
      .then(() => toast('Certificate number copied!'))
      .catch(() => toast(certNumber));
  }

  function shareLinkedIn() {
    if (!downloadUrl) { toast('Certificate not generated yet.'); return; }
    const text = encodeURIComponent(
      `I just earned the Peer Bridge Verified Mentor Certificate at NUST!\n\n` +
      `Level: ${stats.level}  |  ${stats.xp} XP  |  ${stats.total_students_helped} students helped\n` +
      `Certificate No: ${certNumber}\n\n` +
      `#PeerBridgeNUST #Mentorship #NUST #PeerLearning #StudentSuccess`,
    );
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://peerbridge.nust.edu.pk')}&summary=${text}`,
      '_blank',
    );
  }

  return (
    <div className="cert-modal-overlay"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cert-modal">
        <div className="cert-modal-header">
          <h2>Verified Mentor Certificate</h2>
          <button className="cert-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="cert-modal-body">
          <div className="cert-preview-box">
            <div className="cert-preview-title">NUST · Peer Bridge Platform</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginBottom: 4 }}>
              Certificate of Verified Mentor
            </div>
            <div className="cert-preview-name">{user?.name || 'You'}</div>
            <span className="cert-preview-level"
                  style={{ background: LEVEL_COLOR[stats.level] || LEVEL_COLOR.Bronze }}>
              {stats.level} Level
            </span>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginBottom: 8 }}>
              {stats.xp} XP · {stats.total_students_helped} students helped
            </div>
            <div className="cert-preview-number">{certNumber}</div>
          </div>

          <div className="cert-actions">
            <div className="cert-action-row">
              <button className="cert-btn cert-btn-primary"
                      onClick={downloadCert} disabled={!downloadUrl}>Download PDF</button>
              <button className="cert-btn cert-copy-btn" onClick={copyCertNumber}>Copy No.</button>
            </div>
            <button className="cert-btn cert-linkedin-btn" onClick={shareLinkedIn}>
              Share on LinkedIn
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 10, textAlign: 'center' }}>{status}</p>
        </div>
      </div>
    </div>
  );
}
