require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const connectDB = require('./config/db');

const app = express();

app.use(cors({ origin: '*' }));
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
  app.listen(PORT, () => {
    console.log(`\n  Peer Bridge backend running at http://localhost:${PORT}`);
    console.log(`  NODE_ENV = ${process.env.NODE_ENV || 'development'}\n`);
  });
}

start().catch((err) => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
