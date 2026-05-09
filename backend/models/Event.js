const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  organizer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:        { type: String, required: true, trim: true },
  description:  { type: String, default: null },
  venue:        { type: String, required: true, trim: true },
  event_date:   { type: Date,   required: true, index: true },
  event_time:   { type: String, default: null },     // HH:mm:ss string for parity with the SQL TIME column
  category:     { type: String, default: 'Other' },
  image_path:   { type: String, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Event', eventSchema);
