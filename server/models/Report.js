const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  description: { type: String, required: true, maxlength: 1000 },
  status: { type: String, enum: ['open', 'reviewing', 'resolved', 'dismissed'], default: 'open' },
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);