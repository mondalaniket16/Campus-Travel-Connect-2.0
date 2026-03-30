const express = require('express');
const { body, param, query } = require('express-validator');
const Group = require('../models/Group');
const Listing = require('../models/Listing');
const JoinRequest = require('../models/JoinRequest');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// @route   GET /api/groups/search
// @desc    Search groups with filters
router.get('/search', async (req, res) => {
  try {
    const { destination, date, from, mode, gender } = req.query;
    const filter = { type: 'group', isActive: true };

    if (destination) filter.to = new RegExp(destination, 'i');
    if (date) filter.date = date;
    if (from) filter.from = new RegExp(from, 'i');
    if (mode) filter.vehicle = mode;
    if (gender && gender !== 'No Preference') filter.gender = gender;

    // Search in both Group and Listing models for comprehensive results
    const [groups, listings] = await Promise.all([
      Group.find(filter)
        .populate('creator', 'name photoURL')
        .populate('members', 'name photoURL')
        .sort({ createdAt: -1 })
        .limit(50),
      Listing.find(filter)
        .populate('creator', 'name photoURL email phone')
        .sort({ createdAt: -1 })
        .limit(50)
    ]);

    // Combine results, removing duplicates based on _id
    const seen = new Set();
    const combined = [...groups, ...listings].filter(item => {
      if (seen.has(item._id.toString())) return false;
      seen.add(item._id.toString());
      return true;
    });

    res.json({ groups: combined, listings: combined });
  } catch (error) {
    console.error('Group search error:', error);
    res.status(500).json({ error: 'Failed to search groups' });
  }
});

// @route   GET /api/groups
// @desc    Get all groups with filters
router.get('/', async (req, res) => {
  try {
    const { to, date, mode, gender } = req.query;
    const filter = { type: 'group', isActive: true };

    if (to) filter.to = new RegExp(to, 'i');
    if (date) filter.date = date;
    if (mode) filter.mode = mode;
    if (gender && gender !== 'No Preference') filter.gender = gender;

    const groups = await Group.find(filter)
      .populate('creator', 'name photoURL')
      .populate('members', 'name photoURL')
      .sort({ createdAt: -1 });

    res.json({ groups });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// @route   GET /api/groups/my
// @desc    Get groups created by current user
router.get('/my', auth, async (req, res) => {
  try {
    const groups = await Group.find({ creator: req.userId })
      .populate('members', 'name photoURL email')
      .sort({ createdAt: -1 });

    // Get pending requests for each group
    const groupsWithRequests = await Promise.all(groups.map(async (group) => {
      const pendingRequests = await JoinRequest.find({ 
        group: group._id, 
        status: 'pending' 
      }).populate('sender', 'name photoURL email');
      
      return {
        ...group.toObject(),
        pendingRequests
      };
    }));

    res.json({ groups: groupsWithRequests });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// @route   GET /api/groups/joined
// @desc    Get groups user is a member of
router.get('/joined', auth, async (req, res) => {
  try {
    const groups = await Group.find({ 
      members: req.userId,
      creator: { $ne: req.userId }
    })
      .populate('creator', 'name photoURL')
      .populate('members', 'name photoURL')
      .sort({ date: 1 });

    res.json({ groups });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// @route   GET /api/groups/:id
// @desc    Get single group
router.get('/:id', [
  param('id').isMongoId()
], validate, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('creator', 'name photoURL email phone')
      .populate('members', 'name photoURL email');

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({ group });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// @route   POST /api/groups
// @desc    Create new group
router.post('/', auth, [
  body('to').trim().notEmpty().withMessage('Destination required'),
  body('date').notEmpty().withMessage('Date required'),
  body('mode').isIn(['Train', 'Flight', 'Bus', 'Car']).withMessage('Invalid travel mode'),
  body('maxMembers').isInt({ min: 2, max: 20 }).withMessage('Max members must be 2-20'),
], validate, async (req, res) => {
  try {
    const { from, to, date, mode, gender, maxMembers, extraInfo, name } = req.body;

    const group = new Group({
      name: name || req.user.name,
      type: 'group',
      creator: req.userId,
      from: from || 'VIT Chennai',
      to,
      date,
      mode,
      gender: gender || 'No Preference',
      maxMembers,
      extraInfo,
      members: [req.userId]
    });

    await group.save();
    await group.populate('creator', 'name photoURL');

    res.status(201).json({ group, message: 'Group created successfully' });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// @route   PUT /api/groups/:id
// @desc    Update group
router.put('/:id', auth, [
  param('id').isMongoId(),
], validate, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.creator.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const allowedFields = ['to', 'date', 'mode', 'gender', 'maxMembers', 'extraInfo', 'isActive'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        group[field] = req.body[field];
      }
    });

    await group.save();
    res.json({ group, message: 'Group updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// @route   DELETE /api/groups/:id
// @desc    Delete group
router.delete('/:id', auth, [
  param('id').isMongoId()
], validate, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.creator.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete associated join requests
    await JoinRequest.deleteMany({ group: group._id });
    await group.deleteOne();

    res.json({ message: 'Group deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// @route   POST /api/groups/:id/leave
// @desc    Leave a group
router.post('/:id/leave', auth, [
  param('id').isMongoId()
], validate, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.creator.toString() === req.userId.toString()) {
      return res.status(400).json({ error: 'Creator cannot leave group. Delete it instead.' });
    }

    group.members = group.members.filter(m => m.toString() !== req.userId.toString());
    await group.save();

    res.json({ message: 'Left group successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// @route   DELETE /api/groups/:id/members/:memberId
// @desc    Remove member from group (creator only)
router.delete('/:id/members/:memberId', auth, [
  param('id').isMongoId(),
  param('memberId').isMongoId()
], validate, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.creator.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only creator can remove members' });
    }

    if (req.params.memberId === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    group.members = group.members.filter(m => m.toString() !== req.params.memberId);
    await group.save();

    res.json({ message: 'Member removed', group });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;