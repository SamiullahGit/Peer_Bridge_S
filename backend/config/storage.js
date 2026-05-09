// Upload-storage abstraction.
//
// In production we want uploaded files (avatars, post images, event
// images, resources) to survive re-deploys, so we push them to
// Cloudinary. In local dev there's no need to pull in cloud creds, so
// if Cloudinary env vars are missing we transparently fall back to
// Multer's diskStorage writing into backend/uploads/ - the legacy
// behaviour the project has always used.
//
// All routes import { makeStorage, fileUrl } from this module - they
// don't need to care whether the bytes ended up locally or in the cloud.

const multer = require('multer');
const path   = require('path');

const HAS_CLOUDINARY = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY    &&
  process.env.CLOUDINARY_API_SECRET
);

// Lazy-load the Cloudinary modules only if they're needed - keeps the
// dev path zero-config and keeps `npm install` fast for contributors
// who don't care about cloud uploads.
let cloudinary = null;
let CloudinaryStorage = null;
if (HAS_CLOUDINARY) {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key   : process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure    : true,
  });
  ({ CloudinaryStorage } = require('multer-storage-cloudinary'));
}

/**
 * Build a multer storage engine for the given logical "folder".
 *
 * @param {string} folder        - e.g. 'avatars', 'posts', 'events', 'resources'
 * @param {string} filenamePrefix - prefix used for local filenames (ignored on Cloudinary)
 */
function makeStorage(folder, filenamePrefix = folder) {
  if (HAS_CLOUDINARY) {
    return new CloudinaryStorage({
      cloudinary,
      params: {
        folder       : `peerbridge/${folder}`,
        // 'auto' lets Cloudinary route images to its image pipeline and
        // raw files (PDFs/ZIPs/DOCX) to its raw pipeline - both end up
        // with public URLs we can serve directly.
        resource_type: 'auto',
      },
    });
  }

  return multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads'),
    filename: (req, file, cb) => {
      const ext      = path.extname(file.originalname || '').toLowerCase();
      const safeBase = path
        .basename(file.originalname || filenamePrefix, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      cb(null, `${filenamePrefix}-${Date.now()}-${safeBase}${ext}`);
    },
  });
}

/**
 * Returns the public URL / path that should be persisted on the document.
 * - Cloudinary: req.file.path is already a fully-qualified https URL.
 * - Local disk: synthesize the /uploads/<filename> path served by Express.
 */
function fileUrl(file) {
  if (!file) return null;
  if (HAS_CLOUDINARY) return file.path;          // e.g. https://res.cloudinary.com/...
  return `/uploads/${file.filename}`;
}

module.exports = { makeStorage, fileUrl, HAS_CLOUDINARY };
