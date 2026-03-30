const express = require('express');
const { body, param } = require('express-validator');
const JoinRequest = require('../models/JoinRequest');
const Listing = require('../models/Listing');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// ────────────────────────────────────────────────────────────────────────────
// SPECIFIC ROUTES (must come BEFORE parameterized routes)
// ────────────────────────────────────────────────────────────────────────────

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

// @route   GET /api/join-requests/check/:groupId
// @desc    Check if user already sent a request to specific group (for UI updates)
router.get('/check/:groupId', auth, [
  param('groupId').isMongoId()
], validate, async (req, res) => {
  try {
    console.log('[GET /check/:groupId] Checking for user', req.userId, 'group', req.params.groupId);
    
    const existing = await JoinRequest.findOne({
      senderId: req.userId,
      groupId: req.params.groupId,
      status: 'pending'
    });

    console.log('[GET /check/:groupId] Found existing request:', !!existing);
    res.json({ exists: !!existing });
  } catch (error) {
    console.error('[GET /check/:groupId] Error:', error);
    res.status(500).json({ error: 'Failed to check request' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// PARAMETERIZED ROUTES (come AFTER specific routes)
// ────────────────────────────────────────────────────────────────────────────

// @route   POST /api/join-requests
// @desc    Send join request
router.post('/', auth, [
  body('groupId').isMongoId().withMessage('Invalid group ID'),
  body('message').optional().isLength({ max: 200 }),
], validate, async (req, res) => {
  try {
    const { groupId, creatorId, destination, message } = req.body;

    console.log('[POST /join-requests] User', req.userId, 'requesting to join group', groupId);

    const listing = await Listing.findById(groupId);
    if (!listing) {
      console.error('[POST /join-requests] Group not found:', groupId);
      return res.status(404).json({ error: 'Group not found' });
    }

    console.log('[POST /join-requests] Found group:', listing.to, 'by', listing.uid);

    // Check if user is the group creator
    if (String(listing.uid) === String(req.userId)) {
      console.log('[POST /join-requests] User is the group creator');
      return res.status(400).json({ error: 'You cannot join your own group' });
    }

    // Check if already a member (using safer comparison)
    const members = listing.members || [];
    const isAlreadyMember = members.some(memberId => 
      String(memberId) === String(req.userId)
    );
    
    if (isAlreadyMember) {
      console.log('[POST /join-requests] User is already a member');
      return res.status(400).json({ error: 'You are already a member of this group' });
    }

    // Check if group is full
    if (members.length >= (listing.maxMembers || 4)) {
      console.log('[POST /join-requests] Group is full');
      return res.status(400).json({ error: 'This group is full and cannot accept more members' });
    }

    // Check for existing pending request from this user to this specific group
    const existingRequest = await JoinRequest.findOne({
      senderId: req.userId,
      groupId: groupId,
      status: 'pending'
    });

    if (existingRequest) {
      console.log('[POST /join-requests] Found existing pending request:', existingRequest._id);
      return res.status(400).json({ error: 'You have already sent a request to this group' });
    }

    // All checks passed - create the join request
    const joinRequest = new JoinRequest({
      senderId: req.userId,
      senderName: req.user.name,
      senderEmail: req.user.email,
      senderPhoto: req.user.photoURL || '',
      groupId,
      creatorId: listing.uid,
      destination: listing.to,
      message,
      status: 'pending'
    });

    await joinRequest.save();

    console.log('[POST /join-requests] Request created successfully:', joinRequest._id);

    // Create notification for group leader
    await Notification.create({
      user: listing.uid,
      type: 'join_request',
      title: 'New Join Request',
      message: `${req.user.name} wants to join your trip to ${listing.to}`,
      data: { requestId: joinRequest._id, groupId, senderId: req.userId }
    });

    res.status(201).json({ 
      request: joinRequest, 
      message: 'Request sent successfully' 
    });
    
  } catch (error) {
    console.error('[POST /join-requests] Error:', error);
    res.status(500).json({ error: 'Failed to send request. Please try again.' });
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
    const listing = await Listing.findByIdAndUpdate(request.groupId, {
      $addToSet: { members: request.senderId }
    }, { new: true });

    // Notify the requester
    await Notification.create({
      user: request.senderId,
      type: 'request_accepted',
      title: 'Request Accepted! 🎉',
      message: `Your request to join the trip to ${request.destination || 'the group'} has been accepted!`,
      data: { requestId: request._id, groupId: request.groupId }
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

    // Notify the requester
    await Notification.create({
      user: request.senderId,
      type: 'request_rejected',
      title: 'Request Declined',
      message: `Your request to join the trip to ${request.destination || 'the group'} was not accepted.`,
      data: { requestId: request._id, groupId: request.groupId }
    });

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
