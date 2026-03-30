const express = require('express');
const { body, param } = require('express-validator');
const JoinRequest = require('../models/JoinRequest');
const Listing = require('../models/Listing');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// @route   POST /api/join-requests
// @desc    Send join request
router.post('/', auth, [
  body('groupId').isMongoId().withMessage('Invalid group ID'),
  body('message').optional().isLength({ max: 200 }),
], validate, async (req, res) => {
  try {
    const { groupId, creatorId, destination, message } = req.body;

    const listing = await Listing.findById(groupId);
    if (!listing) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (listing.members?.includes(req.userId)) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    if (listing.members?.length >= listing.maxMembers) {
      return res.status(400).json({ error: 'Group is full' });
    }

    // Check for existing pending request
    const existingRequest = await JoinRequest.findOne({
      senderId: req.userId,
      groupId: groupId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'Request already sent' });
    }

    const joinRequest = new JoinRequest({
      senderId: req.userId,
      senderName: req.user.name,
      senderEmail: req.user.email,
      senderPhoto: req.user.photoURL || '',
      groupId,
      creatorId: creatorId || listing.uid,
      destination: destination || listing.to,
      message,
      status: 'pending'
    });

    await joinRequest.save();

    res.status(201).json({ request: joinRequest, message: 'Request sent successfully' });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Request already exists' });
    }
    console.error('Join request error:', error);
    res.status(500).json({ error: 'Failed to send request' });
  }
});

// @route   GET /api/join-requests/check/:groupId
// @desc    Check if user already sent a request
router.get('/check/:groupId', auth, [
  param('groupId').isMongoId()
], validate, async (req, res) => {
  try {
    const existing = await JoinRequest.findOne({
      senderId: req.userId,
      groupId: req.params.groupId,
      status: 'pending'
    });

    res.json({ exists: !!existing });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check request' });
  }
});

// @route   GET /api/join-requests/sent
// @desc    Get requests sent by current user
router.get('/sent', auth, async (req, res) => {
  try {
    const requests = await JoinRequest.find({ senderId: req.userId })
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// @route   GET /api/join-requests/received
// @desc    Get requests for user's groups
router.get('/received', auth, async (req, res) => {
  try {
    const requests = await JoinRequest.find({ creatorId: req.userId })
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// @route   PUT /api/join-requests/:id/accept
// @desc    Accept join request
router.put('/:id/accept', auth, [
  param('id').isMongoId()
], validate, async (req, res) => {
  try {
    const request = await JoinRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.creatorId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    // Update request
    request.status = 'accepted';
    request.respondedAt = new Date();
    await request.save();

    // Add to group members
    await Listing.findByIdAndUpdate(request.groupId, {
      $addToSet: { members: request.senderId }
    });

    res.json({ message: 'Request accepted', request });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// @route   PUT /api/join-requests/:id/reject
// @desc    Reject join request
router.put('/:id/reject', auth, [
  param('id').isMongoId()
], validate, async (req, res) => {
  try {
    const request = await JoinRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.creatorId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    request.status = 'rejected';
    request.respondedAt = new Date();
    await request.save();

    res.json({ message: 'Request rejected', request });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// @route   DELETE /api/join-requests/:id
// @desc    Cancel/delete join request
router.delete('/:id', auth, [
  param('id').isMongoId()
], validate, async (req, res) => {
  try {
    const request = await JoinRequest.findById(req.params.id);
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.senderId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await request.deleteOne();
    res.json({ message: 'Request cancelled' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel request' });
  }
});

module.exports = router;