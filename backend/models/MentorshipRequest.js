const mongoose = require('mongoose');

const mentorshipRequestSchema = new mongoose.Schema({
  requester_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mentor_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  message:      { type: String, default: null },
  status:       { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('MentorshipRequest', mentorshipRequestSchema);
