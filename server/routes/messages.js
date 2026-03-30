const express = require('express');
const { body, param } = require('express-validator');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// @route   GET /api/messages/conversations
// @desc    Get all conversations for current user
router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.userId
    })
      .populate('participants', 'name photoURL')
      .sort({ lastMessageTime: -1 });

    res.json({ conversations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// @route   GET /api/messages/conversation/:conversationId
// @desc    Get messages in conversation
router.get('/conversation/:conversationId', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.json({ messages: [] });
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.toString() === req.userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ error: 'Not authorized for this conversation' });
    }

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(100);

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// @route   POST /api/messages
// @desc    Send message
router.post('/', auth, [
  body('conversationId').notEmpty(),
  body('content').trim().notEmpty().isLength({ max: 2000 }),
], validate, async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.toString() === req.userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ error: 'Not authorized for this conversation' });
    }

    const message = new Message({
      conversationId,
      senderId: req.userId,
      content
    });

    await message.save();

    conversation.lastMessage = content.substring(0, 50);
    conversation.lastMessageTime = new Date();
    await conversation.save();

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// @route   POST /api/messages/start/:userId
// @desc    Start or get conversation with user
router.post('/start/:userId', auth, async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    console.log('[POST /messages/start/:userId] Request from:', req.userId, 'to:', otherUserId);

    // More flexible validation - accept both ObjectId and string formats
    if (!otherUserId || otherUserId === 'undefined' || otherUserId === 'null') {
      console.error('[POST /messages/start/:userId] Invalid user ID:', otherUserId);
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    if (otherUserId === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot start conversation with yourself' });
    }

    const otherUser = await User.findById(otherUserId).select('name photoURL');
    if (!otherUser) {
      console.error('[POST /messages/start/:userId] User not found:', otherUserId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('[POST /messages/start/:userId] Found user:', otherUser.name);

    const sortedIds = [req.userId.toString(), otherUserId].sort();
    const conversationId = sortedIds.join('_');

    let conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      conversation = new Conversation({
        _id: conversationId,
        participants: [req.userId, otherUserId]
      });
      await conversation.save();
    }

    res.json({ 
      conversationId: conversation._id,
      otherUser
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

module.exports = router;
