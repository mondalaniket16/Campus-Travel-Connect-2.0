const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  participantNames: { type: Map, of: String },
  lastMessage: { type: String, default: '' },
  lastMessageTime: { type: Date, default: Date.now },
}, { timestamps: true });

// Generate conversation ID from two user IDs
conversationSchema.statics.getConversationId = function(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
};

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageTime: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);