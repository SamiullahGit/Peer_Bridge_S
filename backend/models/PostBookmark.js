const mongoose = require('mongoose');

const postBookmarkSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

postBookmarkSchema.index({ user_id: 1, post_id: 1 }, { unique: true });

module.exports = mongoose.model('PostBookmark', postBookmarkSchema);
