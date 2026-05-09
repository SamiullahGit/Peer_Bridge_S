const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  uploader_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:           { type: String, required: true, trim: true },
  description:     { type: String, default: null },
  file_path:       { type: String, default: null },
  file_name:       { type: String, default: null },
  file_type:       { type: String, default: null },
  file_size:       { type: Number, default: null },
  category:        { type: String, default: 'Other', index: true },
  course_code:     { type: String, default: null },
  downloads_count: { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Resource', resourceSchema);
