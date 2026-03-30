const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, required: true },
  description: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
}, { timestamps: true });

module.exports = mongoose.model('Issue', issueSchema);