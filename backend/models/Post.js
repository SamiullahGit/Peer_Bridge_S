const mongoose = require('mongoose');

const POST_TAGS = ['Academic Help', 'Career & Internships', 'Resources', 'Events & Societies'];

const postSchema = new mongoose.Schema({
  author_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tag:             { type: String, enum: POST_TAGS, required: true, index: true },
  title:           { type: String, required: true, trim: true, maxlength: 500 },
  body:            { type: String, default: null },
  image_path:      { type: String, default: null },
  likes_count:     { type: Number, default: 0 },
  comments_count:  { type: Number, default: 0 },
  bookmarks_count: { type: Number, default: 0 },
  is_hidden:       { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Post', postSchema);
module.exports.POST_TAGS = POST_TAGS;
