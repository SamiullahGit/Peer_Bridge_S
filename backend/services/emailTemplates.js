// HTML email templates for Peer Bridge transactional emails.
// Each function returns { subject, text, html }.

const BRAND_COLOR = '#2563EB';
const BRAND_NAME  = 'Peer Bridge';

function wrap(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7ff;font-family:'Segoe UI',Arial,sans-serif;color:#0d1b2a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7ff;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(37,99,235,.10);">
        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:24px 32px;">
            <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-.5px;">${BRAND_NAME}</span>
            <span style="display:block;font-size:12px;color:rgba(255,255,255,.65);margin-top:2px;">NUST Peer Mentorship Platform</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px;">
            ${bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 28px;border-top:1px solid #e4eaf2;">
            <p style="margin:0;font-size:12px;color:#8899b0;line-height:1.6;">
              You received this email because you have an account on ${BRAND_NAME}.<br/>
              If you did not expect this, you can safely ignore it.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Welcome email ──────────────────────────────────────────────────────
function welcome({ name, role }) {
  const roleLabel = role === 'mentor' ? 'Mentor' : 'Student';
  const roleMsg   = role === 'mentor'
    ? 'You can now receive mentorship requests from students, answer questions, and share your experience.'
    : 'You can now connect with mentors, ask questions, and explore resources shared by the NUST community.';

  const bodyHtml = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0d1b2a;">Welcome to ${BRAND_NAME}, ${name}! 🎉</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5c73;line-height:1.6;">
      Your account is all set up. You've joined as a <strong>${roleLabel}</strong>.<br/>${roleMsg}
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="background:#eff6ff;border-radius:12px;padding:18px 22px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.5px;">Get started</p>
          <ul style="margin:0;padding:0 0 0 18px;font-size:14px;color:#0d1b2a;line-height:2;">
            <li>Browse the <strong>Feed</strong> for questions and updates</li>
            <li>Connect with <strong>Mentors</strong> in your field</li>
            <li>Check out upcoming <strong>Events</strong></li>
            <li>Share <strong>Resources</strong> with your peers</li>
          </ul>
        </td>
      </tr>
    </table>
    <a href="https://peer-bridge.vercel.app/feed"
       style="display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#ffffff;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">
      Go to my feed →
    </a>`;

  return {
    subject: `Welcome to ${BRAND_NAME}, ${name}!`,
    text   : `Welcome to ${BRAND_NAME}, ${name}!\n\nYour account is ready. You've joined as a ${roleLabel}.\n${roleMsg}\n\nVisit: https://peer-bridge.vercel.app/feed`,
    html   : wrap(`Welcome to ${BRAND_NAME}`, bodyHtml),
  };
}

// ── Mentorship request email (sent to the mentor) ──────────────────────
function mentorshipRequest({ mentorName, studentName, studentEmail, message }) {
  const bodyHtml = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0d1b2a;">New Mentorship Request</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5c73;line-height:1.6;">
      Hi <strong>${mentorName}</strong>, a student would like you to be their mentor on ${BRAND_NAME}.
    </p>
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <td style="background:#f8fbff;border:1.5px solid #e4eaf2;border-radius:12px;padding:18px 22px;">
          <p style="margin:0 0 6px;font-size:13px;color:#8899b0;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">From</p>
          <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#0d1b2a;">${studentName} <span style="font-size:13px;font-weight:400;color:#4b5c73;">&lt;${studentEmail}&gt;</span></p>
          ${message ? `<p style="margin:0 0 6px;font-size:13px;color:#8899b0;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Message</p>
          <p style="margin:0;font-size:14px;color:#0d1b2a;line-height:1.65;font-style:italic;">"${message}"</p>` : ''}
        </td>
      </tr>
    </table>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5c73;">Log in to review the request and respond:</p>
    <a href="https://peer-bridge.vercel.app/feed"
       style="display:inline-block;padding:13px 28px;background:${BRAND_COLOR};color:#ffffff;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">
      View request →
    </a>`;

  return {
    subject: `${studentName} sent you a mentorship request on ${BRAND_NAME}`,
    text   : `Hi ${mentorName},\n\n${studentName} (${studentEmail}) sent you a mentorship request on ${BRAND_NAME}.\n${message ? `\nTheir message: "${message}"\n` : ''}\nLog in to respond: https://peer-bridge.vercel.app/feed`,
    html   : wrap('New Mentorship Request', bodyHtml),
  };
}

module.exports = { welcome, mentorshipRequest };
