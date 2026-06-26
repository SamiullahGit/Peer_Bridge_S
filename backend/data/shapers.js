// ── Response shapers ───────────────────────────────────────────────────
// Centralised helpers that turn a Supabase row (with an embedded related
// resource, e.g. `author:author_id(...)`) into the EXACT JSON shape the
// frontend has always consumed. The id is already the primary key, so
// unlike the Mongoose version there is no _id -> id translation to do;
// these just flatten the embedded user into author_name/role/etc.

// Strip an embedded relation key off a row, returning the rest.
function omit(obj, key) {
  const { [key]: _removed, ...rest } = obj;
  return rest;
}

// Post + embedded author -> legacy post shape (+ liked/bookmarked flags).
function shapePost(p, likedSet, bmSet) {
  const a = p.author || {};
  return {
    ...omit(p, 'author'),
    id              : p.id,
    author_id       : p.author_id,
    author_name     : a.name,
    author_role     : a.role,
    department      : a.department,
    graduation_year : a.graduation_year,
    liked           : likedSet ? likedSet.has(p.id) : false,
    bookmarked      : bmSet    ? bmSet.has(p.id)    : false,
  };
}

// Reply + embedded author -> legacy reply shape.
function shapeReply(r) {
  const a = r.author || {};
  return {
    ...omit(r, 'author'),
    id          : r.id,
    author_id   : r.author_id,
    author_name : a.name,
    author_role : a.role,
  };
}

// Resource + embedded uploader -> legacy resource shape.
function shapeResource(r) {
  const u = r.uploader || {};
  return {
    ...omit(r, 'uploader'),
    id            : r.id,
    uploader_id   : r.uploader_id,
    uploader_name : u.name,
    uploader_role : u.role,
  };
}

// Event + embedded organizer -> legacy event shape.
function shapeEvent(e) {
  const o = e.organizer || {};
  return {
    ...omit(e, 'organizer'),
    id             : e.id,
    organizer_id   : e.organizer_id,
    organizer_name : o.name,
    organizer_role : o.role,
  };
}

// Message + embedded sender -> legacy message shape (thread view).
function shapeMessage(m) {
  const s = m.sender || {};
  return {
    ...omit(m, 'sender'),
    id          : m.id,
    sender_id   : m.sender_id,
    receiver_id : m.receiver_id,
    sender_name : s.name,
    sender_role : s.role,
  };
}

// Public user projection columns (mirrors the old PUBLIC_FIELDS string).
const PUBLIC_FIELDS =
  'id, name, role, department, graduation_year, bio, profile_image, rating, ' +
  'rating_count, sessions_count, is_online, is_locked, is_under_review, ' +
  'created_at, total_xp, xp_level, email, followers_count, following_count, skills';

// Strip sensitive fields from a full user row (parity with toSafeJSON()).
function toSafeUser(u) {
  if (!u) return u;
  const { password_hash, otp_code, otp_expires, ...safe } = u;
  return safe;
}

module.exports = {
  shapePost,
  shapeReply,
  shapeResource,
  shapeEvent,
  shapeMessage,
  toSafeUser,
  PUBLIC_FIELDS,
};
