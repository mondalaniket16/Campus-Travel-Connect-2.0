const express = require('express');
const { body, param } = require('express-validator');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// Socket.io will be injected by server.js
let io = null;
router.setSocketIO = (socketIO) => {
  io = socketIO;
};


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
    
    console.log('[GET /conversation/:conversationId] Fetching messages for:', conversationId);
    
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      console.log('[GET /conversation/:conversationId] Conversation not found');
      return res.json({ messages: [] });
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.toString() === req.userId.toString()
    );

    if (!isParticipant) {
      console.log('[GET /conversation/:conversationId] User not a participant');
      return res.status(403).json({ error: 'Not authorized for this conversation' });
    }

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(100);

    console.log('[GET /conversation/:conversationId] Found', messages.length, 'messages');

    res.json({ messages });
  } catch (error) {
    console.error('[GET /conversation/:conversationId] Error:', error);
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
    
    console.log('[POST /messages] Sending message to conversation:', conversationId);
    
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      console.error('[POST /messages] Conversation not found:', conversationId);
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.toString() === req.userId.toString()
    );

    if (!isParticipant) {
      console.error('[POST /messages] User not authorized');
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

    console.log('[POST /messages] Message sent successfully');

    // Emit real-time notification via Socket.io
    if (io) {
      const sender = await User.findById(req.userId).select('name photoURL');
      const recipient = conversation.participants.find(p => p.toString() !== req.userId.toString());
      
      io.emit('new_message', {
        conversationId: conversation._id,
        senderId: req.userId,
        senderName: sender?.name,
        senderPhoto: sender?.photoURL,
        content: content.substring(0, 50),
        recipientId: recipient
      });
      
      console.log('[POST /messages] Socket event emitted to recipient:', recipient);
    }

    res.status(201).json({ message });
  } catch (error) {
    console.error('[POST /messages] Error:', error);
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

    const sortedIds = [req.userId.toString(), otherUserId.toString()].sort();
    
    console.log('[POST /messages/start/:userId] Looking for conversation between:', sortedIds);

    // Find existing conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [req.userId, otherUserId] }
    });

    if (!conversation) {
      console.log('[POST /messages/start/:userId] Creating new conversation');
      conversation = new Conversation({
        participants: [req.userId, otherUserId]
      });
      
      try {
        await conversation.save();
        console.log('[POST /messages/start/:userId] Conversation created:', conversation._id);
      } catch (saveError) {
        console.error('[POST /messages/start/:userId] Error saving conversation:', saveError);
        throw saveError;
      }
    } else {
      console.log('[POST /messages/start/:userId] Using existing conversation:', conversation._id);
    }

    res.json({ 
      conversationId: conversation._id,
      otherUser
    });
  } catch (error) {
    console.error('[POST /messages/start/:userId] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to start conversation' });
  }
});

module.exports = router;
