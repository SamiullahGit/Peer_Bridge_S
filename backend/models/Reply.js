const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  post_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  author_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:        { type: String, required: true },
  likes_count: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Reply', replySchema);
