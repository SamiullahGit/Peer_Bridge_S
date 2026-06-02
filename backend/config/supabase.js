const { createClient } = require('@supabase/supabase-js');

// ── Supabase service-role client ───────────────────────────────────────
// The backend is a trusted server that does its OWN JWT auth (see
// middleware/auth.js), so we use the service-role key and let it bypass
// Row Level Security. Never expose this key to the frontend.
//
// Credentials come from the environment only - never hardcode them:
//   SUPABASE_URL                = https://<project-ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   = the "service_role" secret from
//                                 Project Settings -> API
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '\n[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.\n' +
    '           Copy backend/.env.example to backend/.env and fill them in\n' +
    '           (Project Settings -> API in the Supabase dashboard).\n',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Lightweight connectivity check used at startup (parity with the old
// connectDB()). Throws if the credentials/URL are wrong so the process
// fails fast instead of erroring on the first request.
async function connectDB() {
  const { error } = await supabase.from('users').select('id', { head: true, count: 'exact' });
  if (error) throw new Error(`Supabase connection failed: ${error.message}`);
  console.log(`  Supabase connected: ${SUPABASE_URL}`);
}

module.exports = { supabase, connectDB };
