const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  rater_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mentor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  score:     { type: Number, required: true, min: 1, max: 5 },
  comment:   { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

// One rating per (rater, mentor) pair - subsequent rates upsert.
ratingSchema.index({ rater_id: 1, mentor_id: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
