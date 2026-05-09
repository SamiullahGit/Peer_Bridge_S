const mongoose = require('mongoose');

// Append-only log of every XP grant. Drives the recent-activity table on profile.
const xpTransactionSchema = new mongoose.Schema({
  user_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  points:   { type: Number, required: true },
  reason:   { type: String, required: true },
  ref_type: { type: String, default: null },
  ref_id:   { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('XpTransaction', xpTransactionSchema);
