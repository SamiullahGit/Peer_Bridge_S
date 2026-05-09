const mongoose = require('mongoose');

// Join collection: a user has liked a post.
// Compound unique index prevents duplicate likes.
const postLikeSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  post_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

postLikeSchema.index({ user_id: 1, post_id: 1 }, { unique: true });

module.exports = mongoose.model('PostLike', postLikeSchema);
