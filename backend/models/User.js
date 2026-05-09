const mongoose = require('mongoose');

const NUST_DOMAINS = [
  'nust.edu.pk', 'student.nust.edu.pk',
  'seecs.edu.pk',
  'smme.nust.edu.pk', 'scme.nust.edu.pk', 'scee.nust.edu.pk',
  'sns.nust.edu.pk',  's3h.nust.edu.pk',  'nbs.nust.edu.pk',
  'sese.nust.edu.pk', 'sada.nust.edu.pk', 'sines.nust.edu.pk',
  'asab.nust.edu.pk',
];

const userSchema = new mongoose.Schema({
  name:                  { type: String, required: true, trim: true },
  email:                 {
    type: String, required: true, unique: true, lowercase: true, trim: true,
    validate: {
      validator: v => {
        const domain = (v || '').split('@')[1];
        return !!domain && NUST_DOMAINS.includes(domain);
      },
      message: 'Only NUST institutional email addresses are allowed',
    },
  },
  password_hash:         { type: String, default: null },
  role:                  { type: String, enum: ['student', 'mentor', 'admin'], default: 'student' },
  department:            { type: String, default: null },
  graduation_year:       { type: Number, default: null },
  bio:                   { type: String, default: null },
  profile_image:         { type: String, default: null },
  is_verified:           { type: Boolean, default: false },
  otp_code:              { type: String, default: null },
  otp_expires:           { type: Date,   default: null },
  rating:                { type: Number, default: 0 },
  rating_count:          { type: Number, default: 0 },
  sessions_count:        { type: Number, default: 0 },
  is_online:             { type: Boolean, default: false },
  is_locked:             { type: Boolean, default: false },
  is_under_review:       { type: Boolean, default: false },
  total_xp:              { type: Number, default: 0 },
  xp_level:              { type: String, default: 'Bronze' },
  total_students_helped: { type: Number, default: 0 },
  total_hours_helped:    { type: Number, default: 0 },
  last_login_xp_date:    { type: Date,   default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Strip sensitive fields whenever a user is serialised to JSON.
userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject({ virtuals: false });
  delete obj.password_hash;
  delete obj.otp_code;
  delete obj.otp_expires;
  obj.id = obj._id.toString();
  return obj;
};

module.exports = mongoose.model('User', userSchema);
module.exports.NUST_DOMAINS = NUST_DOMAINS;
