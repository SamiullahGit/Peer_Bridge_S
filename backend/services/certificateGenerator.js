const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

// Generated PDFs live in backend/certificates - one level above this service file.
const CERT_DIR = path.join(__dirname, '..', 'certificates');

// ── Peer Bridge brand palette (matches the in-app logo) ─────────────
const C = {
  navy       : '#1A2744',   // dark bridge endpoint + signature ink
  navySoft   : '#304D72',   // mid navy
  blue       : '#60A5FA',   // bridge left circle
  blueLight  : '#93C5FD',   // bridge arc colour
  bluePale   : '#BFDBFE',   // bridge right circle
  gold       : '#B8902B',   // recipient underline + accent rules
  goldSoft   : '#D9B85A',   // outer hairline
  goldPale   : '#F2E6BD',   // tertiary hairline
  paper      : '#FBFAF6',   // certificate paper background
  paperEdge  : '#F2EFE5',   // outer mat colour
  ink        : '#1F2937',   // primary heading colour
  inkSoft    : '#4B5563',   // body text
  inkMute    : '#7B8694',   // captions / labels
  divider    : '#E1E5EC',
};

const LEVEL_COLOURS = {
  Bronze   : { fill: '#B87333', tint: '#E9C8A6' },
  Silver   : { fill: '#7A828D', tint: '#D7DCE2' },
  Gold     : { fill: '#C5A028', tint: '#F1DC92' },
  Platinum : { fill: '#3E7FA8', tint: '#B8D4E6' },
  Legend   : { fill: '#7B3FA8', tint: '#D6BBE6' },
};

/* ── Peer Bridge bridge-logo, drawn as vector (matches the SVG in api.js) ── */
function drawPeerBridgeLogo(doc, cx, cy, scale = 1) {
  // Logo viewBox is 140 x 90, anchored so (cx, cy) is the visual center.
  const w = 140 * scale, h = 90 * scale;
  const x = cx - w / 2, y = cy - h / 2;
  const sx = (vx) => x + vx * scale;
  const sy = (vy) => y + vy * scale;

  // Left arc:  M 14,70 C 14,18 62,18 70,44
  doc.save()
     .moveTo(sx(14), sy(70))
     .bezierCurveTo(sx(14), sy(18), sx(62), sy(18), sx(70), sy(44))
     .lineWidth(8 * scale).lineCap('round')
     .stroke(C.blue);

  // Right arc: M 70,44 C 78,18 126,18 126,70
  doc.moveTo(sx(70), sy(44))
     .bezierCurveTo(sx(78), sy(18), sx(126), sy(18), sx(126), sy(70))
     .lineWidth(8 * scale).lineCap('round')
     .stroke(C.bluePale);

  // Center node (ringed)
  doc.circle(sx(70), sy(44), 10 * scale).lineWidth(7 * scale).stroke(C.navySoft);
  doc.circle(sx(70), sy(44), 6  * scale).fill(C.navy);

  // Left circle (blue) and right circle (pale)
  doc.circle(sx(14),  sy(70), 10 * scale).fill(C.blue);
  doc.circle(sx(126), sy(70), 10 * scale).fill(C.bluePale);
  doc.restore();
}

/* ── Stat block: elegant, no jarring colour bar ── */
function statBlock(doc, x, y, w, value, label) {
  doc.font('Helvetica-Bold').fontSize(20).fillColor(C.navy)
     .text(value, x, y, { width: w, align: 'center' });
  doc.font('Helvetica').fontSize(8.5).fillColor(C.inkMute)
     .text(label.toUpperCase(), x, y + 26, { width: w, align: 'center', characterSpacing: 1.4 });
}

/* ── Stylised handwritten signature (drawn as bezier strokes) ── */
// `variant: 'a' | 'b'` produces two visually distinct signatures so the two
// signature blocks on the certificate don't look identical. Both are abstract
// flowing curves — no real names — sized to sit naturally above the line.
function drawSignature(doc, x, y, variant = 'a') {
  doc.save();
  doc.lineWidth(1.4).lineCap('round').lineJoin('round').strokeColor(C.navy);

  if (variant === 'a') {
    // Loopy "P-style" flourish — capital loop, then lowercase tail.
    doc.moveTo(x, y);
    // Capital opening loop (like a cursive P)
    doc.bezierCurveTo(x + 4,  y - 18, x + 22, y - 22, x + 18, y - 6);
    doc.bezierCurveTo(x + 16, y + 2,  x + 6,  y + 4,  x + 8,  y - 4);
    // Connecting stroke
    doc.bezierCurveTo(x + 14, y - 2,  x + 28, y + 2,  x + 36, y - 4);
    // Lowercase wave
    doc.bezierCurveTo(x + 44, y - 10, x + 58, y - 6,  x + 60, y);
    doc.bezierCurveTo(x + 62, y + 6,  x + 76, y + 4,  x + 84, y - 2);
    // Final flick / cross
    doc.bezierCurveTo(x + 92, y - 6,  x + 102, y - 2, x + 110, y - 6);
    doc.stroke();
    // Underline flourish
    doc.moveTo(x + 6, y + 8)
       .bezierCurveTo(x + 40, y + 14, x + 80, y + 12, x + 108, y + 6)
       .lineWidth(0.8).stroke();
  } else {
    // Sharper "A-style" flourish — angular peaks then trailing loop.
    doc.moveTo(x, y + 4);
    // Angular A-like peak
    doc.bezierCurveTo(x + 6,  y - 14, x + 16, y - 18, x + 22, y - 4);
    doc.bezierCurveTo(x + 24, y + 2,  x + 14, y + 6,  x + 18, y);
    // Connector
    doc.bezierCurveTo(x + 28, y - 2,  x + 36, y - 8,  x + 44, y - 2);
    // Bouncy mid section
    doc.bezierCurveTo(x + 50, y + 4,  x + 58, y - 10, x + 66, y - 4);
    doc.bezierCurveTo(x + 74, y + 2,  x + 86, y - 8,  x + 96, y - 2);
    // Trailing tail
    doc.bezierCurveTo(x + 104, y + 4, x + 112, y + 2, x + 118, y - 4);
    doc.stroke();
    // Trailing dot
    doc.circle(x + 122, y - 2, 1.2).fill(C.navy);
  }

  doc.restore();
}

/* ── Centred horizontal rule ── */
function centeredRule(doc, y, len, color = C.gold, lw = 0.8) {
  const W = doc.page.width;
  doc.moveTo((W - len) / 2, y).lineTo((W + len) / 2, y).lineWidth(lw).stroke(color);
}

/* ── Decorative corner flourish ── */
function cornerFlourish(doc, x, y, dirX, dirY, size = 26) {
  // Two thin gold lines meeting at right angle, plus a small diamond.
  doc.save();
  doc.moveTo(x, y).lineTo(x + dirX * size, y).lineWidth(0.6).stroke(C.gold);
  doc.moveTo(x, y).lineTo(x, y + dirY * size).lineWidth(0.6).stroke(C.gold);
  // Tiny diamond at the apex
  const d = 3.2;
  doc.moveTo(x, y - d * dirY)
     .lineTo(x + d * dirX, y)
     .lineTo(x, y + d * dirY)
     .lineTo(x - d * dirX, y)
     .closePath()
     .fillAndStroke(C.goldSoft, C.gold);
  doc.restore();
}

function generateCertPDF(userData, certNumber) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

    const filePath = path.join(CERT_DIR, `${certNumber}.pdf`);
    // size: [width, height] is explicit and unambiguous. Do NOT also pass
    // `layout: 'landscape'` — PDFKit would then swap the dimensions a second
    // time, producing a portrait-oriented 595×841 page that clips everything
    // drawn past x=595. (That was the right-side-cut-off bug.)
    const doc      = new PDFDocument({ size: [841, 595], margin: 0 });
    const stream   = fs.createWriteStream(filePath);
    stream.on('error', reject);
    stream.on('finish', () => resolve(filePath));
    doc.pipe(stream);

    const W = 841, H = 595;
    const lvl = LEVEL_COLOURS[userData.xp_level] || LEVEL_COLOURS.Bronze;

    // ── Mat background (the part visible outside the certificate paper) ─
    doc.rect(0, 0, W, H).fill(C.paperEdge);

    // ── Certificate paper ──────────────────────────────────────────────
    const m = 22;                                  // margin from page edge to paper
    doc.rect(m, m, W - 2 * m, H - 2 * m).fill(C.paper);

    // ── Triple-line elegant border ────────────────────────────────────
    // Outer hairline
    doc.rect(m + 6,  m + 6,  W - 2 * (m + 6),  H - 2 * (m + 6)).lineWidth(0.6).stroke(C.goldSoft);
    // Middle gold line
    doc.rect(m + 12, m + 12, W - 2 * (m + 12), H - 2 * (m + 12)).lineWidth(1.4).stroke(C.gold);
    // Inner pale-gold accent
    doc.rect(m + 16, m + 16, W - 2 * (m + 16), H - 2 * (m + 16)).lineWidth(0.4).stroke(C.goldPale);

    // ── Corner flourishes ──────────────────────────────────────────────
    cornerFlourish(doc, m + 30,       m + 30,       1,  1);
    cornerFlourish(doc, W - m - 30,   m + 30,      -1,  1);
    cornerFlourish(doc, m + 30,       H - m - 30,   1, -1);
    cornerFlourish(doc, W - m - 30,   H - m - 30,  -1, -1);

    // ── Header: logo + brand line ──────────────────────────────────────
    drawPeerBridgeLogo(doc, W / 2, 76, 0.42);     // ~59 x 38

    doc.font('Helvetica-Bold').fontSize(11.5).fillColor(C.navy)
       .text('PEER BRIDGE', 0, 100, { align: 'center', width: W, characterSpacing: 4 });

    doc.font('Helvetica').fontSize(7.5).fillColor(C.inkMute)
       .text('NATIONAL UNIVERSITY OF SCIENCES & TECHNOLOGY  ·  ISLAMABAD',
             0, 117, { align: 'center', width: W, characterSpacing: 1.6 });

    // Decorative gold rule under brand
    centeredRule(doc, 138, 120, C.gold, 0.9);

    // ── Title ──────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(30).fillColor(C.ink)
       .text('Certificate of Mentorship', 0, 154, { align: 'center', width: W, characterSpacing: 0.5 });

    // Subtitle
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(C.inkMute)
       .text('Awarded in recognition of outstanding peer mentorship and community contribution',
             80, 196, { align: 'center', width: W - 160 });

    // ── "This is to certify that" ──────────────────────────────────────
    doc.font('Helvetica-Oblique').fontSize(11).fillColor(C.inkSoft)
       .text('This is to certify that', 0, 226, { align: 'center', width: W });

    // ── Recipient name ────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(38).fillColor(C.navy)
       .text(userData.name, 0, 248, { align: 'center', width: W });

    // Gold flourish underline beneath the name
    const nameW = Math.min(doc.widthOfString(userData.name, { font: 'Helvetica-Bold', fontSize: 38 }), 520);
    const nameX = (W - nameW) / 2;
    const undY  = 296;
    doc.moveTo(nameX, undY).lineTo(nameX + nameW, undY).lineWidth(1.6).stroke(C.gold);
    // tiny center diamond
    doc.moveTo(W / 2, undY - 4)
       .lineTo(W / 2 + 4, undY)
       .lineTo(W / 2, undY + 4)
       .lineTo(W / 2 - 4, undY)
       .closePath().fill(C.gold);

    // ── Recognition line (department / general) ───────────────────────
    const deptLine = userData.department
      ? `has demonstrated exceptional commitment to peer learning and mentorship at ${userData.department}, NUST.`
      : 'has demonstrated exceptional commitment to peer learning and mentorship at NUST.';
    doc.font('Helvetica').fontSize(11).fillColor(C.inkSoft)
       .text(deptLine, 100, 312, { align: 'center', width: W - 200 });

    // ── Level pill ────────────────────────────────────────────────────
    const lvlText  = `${(userData.xp_level || 'Bronze').toUpperCase()}  LEVEL  ·  ${userData.total_xp} XP`;
    const lvlFontSize = 11;
    doc.font('Helvetica-Bold').fontSize(lvlFontSize);
    const pillTextW = doc.widthOfString(lvlText, { font: 'Helvetica-Bold', fontSize: lvlFontSize });
    const pillW     = pillTextW + 38;
    const pillH     = 26;
    const pillX     = (W - pillW) / 2;
    const pillY     = 350;
    // Tinted background
    doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2).fill(lvl.tint);
    // Filled core
    doc.roundedRect(pillX + 3, pillY + 3, pillW - 6, pillH - 6, (pillH - 6) / 2).fill(lvl.fill);
    doc.fillColor('#FFFFFF')
       .text(lvlText, pillX, pillY + 8, { width: pillW, align: 'center', characterSpacing: 1 });

    // ── Stats row ─────────────────────────────────────────────────────
    const statsY  = 400;
    const statW   = 175;
    const cols    = 3;
    const totalW  = cols * statW;
    const startX  = (W - totalW) / 2;

    statBlock(doc, startX,             statsY, statW,
      `${userData.total_xp}`,
      'Total XP Earned');
    statBlock(doc, startX + statW,     statsY, statW,
      String(userData.total_students_helped || 0),
      'Students Helped');
    statBlock(doc, startX + statW * 2, statsY, statW,
      userData.rating ? `${Number(userData.rating).toFixed(1)} / 5` : '—',
      'Community Rating');

    // (The full-width divider that used to live here was removed - it
    // cut straight through the seal and clashed with the signature
    // underlines, making the footer area look noisy.)

    // ── Footer: signature, seal, certificate number ───────────────────
    const footY = 478;

    // Left signature: handwritten flourish above the line + printed name below
    drawSignature(doc, 92, footY - 8, 'a');
    doc.moveTo(70, footY).lineTo(230, footY).lineWidth(0.7).stroke(C.ink);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.ink)
       .text('Peer Bridge Team', 70, footY + 6, { width: 160 });
    doc.font('Helvetica').fontSize(7.5).fillColor(C.inkMute)
       .text('PLATFORM AUTHORITY', 70, footY + 18, { width: 160, characterSpacing: 1 });

    // Right signature: different flourish so the two don't look identical
    drawSignature(doc, W - 210, footY - 8, 'b');
    doc.moveTo(W - 230, footY).lineTo(W - 70, footY).lineWidth(0.7).stroke(C.ink);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.ink)
       .text('Office of Academic Affairs', W - 230, footY + 6, { width: 160, align: 'left' });
    doc.font('Helvetica').fontSize(7.5).fillColor(C.inkMute)
       .text('NUST · ISLAMABAD', W - 230, footY + 18, { width: 160, align: 'left', characterSpacing: 1 });

    // Centre seal: gold ring + Peer Bridge logo + microcopy ring.
    // Tightly packed so logo and label fill the inner ring without leaving
    // a noticeable gap at the top. The bridge logo is bottom-heavy (its
    // dots sit at y=70/90 in the viewBox) so we draw it ~8px above the
    // seal centre to keep it optically centred above the label.
    const sealCx = W / 2, sealCy = footY + 4;
    const sealR  = 36;
    doc.circle(sealCx, sealCy, sealR).lineWidth(1.4).stroke(C.gold);
    doc.circle(sealCx, sealCy, sealR - 4).lineWidth(0.4).stroke(C.goldSoft);
    drawPeerBridgeLogo(doc, sealCx, sealCy - 8, 0.32);
    doc.font('Helvetica-Bold').fontSize(5.5).fillColor(C.gold)
       .text('VERIFIED  MENTOR', sealCx - 32, sealCy + 14,
             { width: 64, align: 'center', characterSpacing: 0.8 });

    // ── Bottom-line meta: cert number + date + URL ────────────────────
    // Centered as a clean two-line footer under the seal, well clear of
    // the bottom corner flourishes. Top line: cert number + issue date.
    // Bottom line: the verification URL.
    const issued = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const metaY = H - 50;

    doc.font('Helvetica').fontSize(7.5).fillColor(C.inkMute)
       .text(`CERTIFICATE NO.  ${certNumber}    ·    ISSUED  ${issued.toUpperCase()}`,
             0, metaY,
             { width: W, align: 'center', characterSpacing: 0.8, lineBreak: false });
    doc.end();
  });
}

async function cleanupOldCertificates() {
  try {
    if (!fs.existsSync(CERT_DIR)) return;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const file of fs.readdirSync(CERT_DIR)) {
      const fp = path.join(CERT_DIR, file);
      if (fs.statSync(fp).mtimeMs < cutoff) { fs.unlinkSync(fp); removed++; }
    }
    if (removed > 0) console.log(`[certCleanup] Removed ${removed} old certificate(s).`);
  } catch (err) {
    console.error('[certCleanup] Error:', err.message);
  }
}

module.exports = { generateCertPDF, cleanupOldCertificates, CERT_DIR };
