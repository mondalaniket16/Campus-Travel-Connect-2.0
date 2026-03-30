const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 2000 },
  read: { type: Boolean, default: false },
}, { timestamps: true });

// Index for efficient queries
messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);