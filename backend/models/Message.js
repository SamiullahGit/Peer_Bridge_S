const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  receiver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text:        { type: String, required: true },
  is_read:     { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

messageSchema.index({ created_at: -1 });

module.exports = mongoose.model('Message', messageSchema);
