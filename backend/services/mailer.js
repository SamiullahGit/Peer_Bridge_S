// Unified email sender.
//
// Order of preference:
//   1. Brevo HTTP API  (https, port 443 - works on hosts that block SMTP
//      such as Render). Enabled when BREVO_API_KEY is set.
//   2. Gmail SMTP via nodemailer (with short timeouts so it fails fast).
//   3. Nothing — returns false so the caller can fall back to console.
//
// Returns true if an email was actually dispatched.
//
// Env:
//   BREVO_API_KEY  - Brevo (Sendinblue) v3 API key
//   MAIL_FROM      - the VERIFIED Brevo sender address (falls back to EMAIL_USER)
//   EMAIL_USER     - Gmail address (also used as the SMTP-fallback sender)
//   EMAIL_PASS     - Gmail app password (SMTP fallback only)

async function sendMail({ to, subject, text, html }) {
  const fromEmail = process.env.MAIL_FROM || process.env.EMAIL_USER;
  const fromName  = 'Peer Bridge';

  // 1. Brevo HTTP API ──────────────────────────────────────────────────
  if (process.env.BREVO_API_KEY) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method : 'POST',
        headers: {
          'api-key'     : process.env.BREVO_API_KEY,
          'content-type': 'application/json',
          'accept'      : 'application/json',
        },
        body: JSON.stringify({
          sender     : { email: fromEmail, name: fromName },
          to         : [{ email: to }],
          subject,
          textContent: text,
          htmlContent: html || `<p>${text}</p>`,
        }),
      });
      if (res.ok) return true;
      const body = await res.text().catch(() => '');
      console.error('[mailer] Brevo send failed:', res.status, body.slice(0, 300));
    } catch (err) {
      console.error('[mailer] Brevo error:', err.message);
    }
  }

  // 2. Gmail SMTP fallback ──────────────────────────────────────────────
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const nodemailer  = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth   : { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        connectionTimeout: 8000,
        greetingTimeout  : 8000,
        socketTimeout    : 8000,
      });
      await transporter.sendMail({
        from: `"${fromName}" <${process.env.EMAIL_USER}>`,
        to, subject, text, html,
      });
      return true;
    } catch (err) {
      console.error('[mailer] Gmail send failed:', err.message);
    }
  }

  // 3. Nothing configured / both failed.
  return false;
}

module.exports = { sendMail };
