// Upload-storage abstraction backed by Supabase Storage.
//
// Uploaded files (avatars, post images, event images, resource files) are
// streamed into a public Supabase Storage bucket and served from Supabase's
// CDN, so they survive backend redeploys/restarts.
//
// A custom Multer storage engine does the upload during the multipart parse,
// then exposes the resulting public URL as `req.file.path` - so route code
// keeps calling `fileUrl(req.file)` exactly as before.

const multer = require('multer');
const path   = require('path');
const { supabase } = require('./supabase');

// One public bucket with per-feature folders (avatars/, posts/, events/,
// resources/). Override the name with SUPABASE_BUCKET if you like.
const BUCKET = process.env.SUPABASE_BUCKET || 'uploads';

// ── Custom Multer storage engine ───────────────────────────────────────
function SupabaseStorageEngine(folder, filenamePrefix) {
  this.folder = folder;
  this.prefix = filenamePrefix || folder;
}

SupabaseStorageEngine.prototype._handleFile = function (req, file, cb) {
  const folder = this.folder;
  const prefix = this.prefix;
  const chunks = [];
  file.stream.on('data', (c) => chunks.push(c));
  file.stream.on('error', cb);
  file.stream.on('end', async () => {
    try {
      const buffer   = Buffer.concat(chunks);
      const ext      = path.extname(file.originalname || '').toLowerCase();
      const safeBase = path
        .basename(file.originalname || prefix, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      const key = `${folder}/${prefix}-${Date.now()}-${safeBase}${ext}`;

      const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert     : false,
      });
      if (error) return cb(error);

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
      cb(null, { path: data.publicUrl, key, filename: key, size: buffer.length });
    } catch (err) {
      cb(err);
    }
  });
};

SupabaseStorageEngine.prototype._removeFile = function (req, file, cb) {
  if (!file.key) return cb(null);
  supabase.storage.from(BUCKET).remove([file.key]).then(() => cb(null), cb);
};

/**
 * Build a Multer storage engine for the given logical "folder".
 * @param {string} folder         - e.g. 'avatars', 'posts', 'events', 'resources'
 * @param {string} filenamePrefix - prefix used in the stored object key
 */
function makeStorage(folder, filenamePrefix = folder) {
  return new SupabaseStorageEngine(folder, filenamePrefix);
}

/**
 * Public URL that should be persisted on the row. The storage engine already
 * put the fully-qualified Supabase public URL on req.file.path.
 */
function fileUrl(file) {
  if (!file) return null;
  return file.path;
}

/**
 * Ensure the public bucket exists. Called once at startup; idempotent and
 * best-effort (never throws - a missing bucket just means uploads will error
 * with a clear Supabase message until you create it in the dashboard).
 */
async function ensureBucket() {
  try {
    const { data } = await supabase.storage.getBucket(BUCKET);
    if (data) return;
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (createErr && !/already exists/i.test(createErr.message || '')) {
      console.warn(`[storage] Could not create bucket "${BUCKET}": ${createErr.message}`);
      return;
    }
    console.log(`  Supabase Storage bucket ready: ${BUCKET} (public)`);
  } catch (err) {
    console.warn(`[storage] ensureBucket error: ${err.message}`);
  }
}

module.exports = { makeStorage, fileUrl, ensureBucket, BUCKET };
