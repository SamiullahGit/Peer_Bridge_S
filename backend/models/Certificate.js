const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  user_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  cert_number:    { type: String, required: true, unique: true },
  xp_snapshot:    { type: Number, required: true },
  level_snapshot: { type: String, required: true },
  file_path:      { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Certificate', certificateSchema);
