const mongoose = require('mongoose');

const joinRequestSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String },
  senderEmail: { type: String },
  senderPhoto: { type: String },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  destination: { type: String },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  message: { type: String, maxlength: 200 },
  respondedAt: { type: Date },
}, { timestamps: true });

// Compound unique index to prevent duplicate pending requests
joinRequestSchema.index(
  { senderId: 1, groupId: 1, status: 1 },
  { unique: true }
);

module.exports = mongoose.model('JoinRequest', joinRequestSchema);
