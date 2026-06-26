require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { connectDB }   = require('./config/supabase');
const { ensureBucket } = require('./config/storage');

// ── Production safety checks ───────────────────────────────────────────
const IS_PROD = process.env.NODE_ENV === 'production';
const DEFAULT_JWT = 'peer_bridge_secret_change_this_in_production';
if (IS_PROD && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT)) {
  console.error(
    '\n[server] Refusing to start in production with a missing or default JWT_SECRET.\n' +
    '         Set JWT_SECRET to a long random string in your host environment.\n',
  );
  process.exit(1);
}

const app = express();

// CORS: defaults to "*" for local dev; in production set CORS_ORIGIN to your
// frontend URL(s), comma-separated (e.g. https://peer-bridge.vercel.app).
// Note: "*" (or unset) must be passed to cors() as the literal string so it
// allows all origins — wrapping it in an array would only match an origin
// literally named "*".
const corsRaw = (process.env.CORS_ORIGIN || '').trim();
const corsOrigin = (!corsRaw || corsRaw === '*')
  ? '*'
  : corsRaw.split(',').map(s => s.trim());
app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static assets: uploaded files + generated certificates.
app.use('/uploads',      express.static(path.join(__dirname, 'uploads')));
app.use('/certificates', express.static(path.join(__dirname, 'certificates')));

// API routes
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/posts',        require('./routes/posts'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/messages',     require('./routes/messages'));
app.use('/api/resources',    require('./routes/resources'));
app.use('/api/events',       require('./routes/events'));
app.use('/api/reports',      require('./routes/reports'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/xp',           require('./routes/xp'));
app.use('/api/groups',       require('./routes/groups'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/search',       require('./routes/search'));
app.use('/api/collections',  require('./routes/collections'));

// Health-check endpoint (handy when wiring up the React dev proxy).
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Central error handler.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();
  await ensureBucket();
  app.listen(PORT, () => {
    console.log(`\n  Peer Bridge backend running at http://localhost:${PORT}`);
    console.log(`  NODE_ENV = ${process.env.NODE_ENV || 'development'}\n`);
  });
}

start().catch((err) => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
