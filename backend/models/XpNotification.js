const mongoose = require('mongoose');

// Pending XP notifications (passive XP from ratings, level-ups). The frontend
// polls /api/xp/pending; once delivered, is_sent flips to true.
const xpNotificationSchema = new mongoose.Schema({
  user_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  points:      { type: Number,  default: 0 },
  message:     { type: String,  required: true },
  is_level_up: { type: Boolean, default: false },
  new_level:   { type: String,  default: null },
  is_sent:     { type: Boolean, default: false, index: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('XpNotification', xpNotificationSchema);
