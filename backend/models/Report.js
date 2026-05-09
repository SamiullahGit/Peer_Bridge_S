const mongoose = require('mongoose');

const REPORT_TYPES   = ['post', 'user', 'resource'];
const REPORT_REASONS = ['Spam', 'Harassment', 'Inappropriate', 'Misinformation'];

const reportSchema = new mongoose.Schema({
  reporter_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  target_type: { type: String, enum: REPORT_TYPES,   required: true },
  target_id:   { type: mongoose.Schema.Types.ObjectId, required: true },
  reason:      { type: String, enum: REPORT_REASONS, required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

// Each user can only report a given target once.
reportSchema.index({ reporter_id: 1, target_type: 1, target_id: 1 }, { unique: true });
reportSchema.index({ target_type: 1, target_id: 1 });

module.exports = mongoose.model('Report', reportSchema);
module.exports.REPORT_TYPES   = REPORT_TYPES;
module.exports.REPORT_REASONS = REPORT_REASONS;
