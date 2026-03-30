const express = require('express');
const { body, param, query } = require('express-validator');
const Listing = require('../models/Listing');
const User = require('../models/User');
const { auth, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// @route   GET /api/listings/search
// @desc    Search listings with more flexible filtering
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { type, destination, from, transport, date, gender, q } = req.query;
    const filter = { isActive: true };

    if (type) filter.type = type;
    if (destination) filter.to = new RegExp(destination, 'i');
    if (from) filter.from = new RegExp(from, 'i');
    if (transport && transport !== 'Anything') filter.vehicle = new RegExp(transport, 'i');
    if (date) filter.date = date;
    if (gender && gender !== 'No Preference' && !/select/i.test(gender)) filter.gender = gender;
    
    // General search query
    if (q) {
      filter.$or = [
        { to: new RegExp(q, 'i') },
        { from: new RegExp(q, 'i') },
        { notes: new RegExp(q, 'i') },
        { name: new RegExp(q, 'i') }
      ];
    }

    const listings = await Listing.find(filter)
      .populate('creator', 'name photoURL email phone')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ listings, count: listings.length });
  } catch (error) {
    console.error('Listing search error:', error);
    res.status(500).json({ error: 'Failed to search listings' });
  }
});

// @route   GET /api/listings
// @desc    Get all listings with filters
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { type, destination, transport, date, gender } = req.query;
    const filter = { isActive: true };

    if (type) filter.type = type;
    if (destination) filter.to = new RegExp(destination, 'i');
    if (transport && transport !== 'Anything' && !/select/i.test(transport)) filter.vehicle = transport;
    if (date) filter.date = date;
    if (gender && gender !== 'No Preference' && !/select/i.test(gender)) filter.gender = gender;

    console.log('[GET /api/listings] Query params:', req.query);
    console.log('[GET /api/listings] Filter:', filter);

    const listings = await Listing.find(filter)
      .populate('uid', 'name photoURL email phone')
      .sort({ createdAt: -1 });

    console.log('[GET /api/listings] Found', listings.length, 'listings');

    res.json({ listings });
  } catch (error) {
    console.error('[GET /api/listings] Error:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// @route   GET /api/listings/my
// @desc    Get current user's listings
router.get('/my', auth, async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { uid: req.userId };
    if (type) filter.type = type;

    const listings = await Listing.find(filter).sort({ createdAt: -1 });
    res.json({ listings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// @route   GET /api/listings/my-journeys
// @desc    Get journeys user is part of (for rating)
router.get('/my-journeys', auth, async (req, res) => {
  try {
    const listings = await Listing.find({
      $or: [
        { uid: req.userId },
        { members: req.userId }
      ]
    }).sort({ createdAt: -1 });

    res.json({ listings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch journeys' });
  }
});

// @route   GET /api/listings/:id
// @desc    Get single listing
router.get('/:id', [
  param('id').isMongoId()
], validate, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate('creator', 'name photoURL email');
    
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    res.json({ listing });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// @route   GET /api/listings/:id/members
// @desc    Get group members with full details
router.get('/:id/members', auth, [
  param('id').isMongoId()
], validate, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const members = await User.find({ 
      _id: { $in: listing.members || [] } 
    }).select('name email photoURL reg phone dept');

    res.json({ members });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// @route   POST /api/listings
// @desc    Create listing (match or group)
router.post('/', auth, async (req, res) => {
  try {
    const { type, from, to, date, time, vehicle, gender, notes, maxMembers, members, name, uid } = req.body;

    console.log('[POST /api/listings] Creating listing:', { type, from, to, date, vehicle, gender, maxMembers });

    const listing = new Listing({
      type: type || 'match',
      uid: req.userId,
      name: req.user.name,
      from,
      to,
      date,
      time,
      vehicle,
      gender: gender || 'Any',
      notes,
      maxMembers: maxMembers || 4,
      members: members || [req.userId],
      isActive: true
    });

    await listing.save();
    console.log('[POST /api/listings] Created listing with ID:', listing._id);
    
    res.status(201).json({ listing, message: 'Listing created successfully' });
  } catch (error) {
    console.error('[POST /api/listings] Error:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// @route   POST /api/listings/:id/join
// @desc    Join a group directly
router.post('/:id/join', auth, [
  param('id').isMongoId()
], validate, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.members.includes(req.userId)) {
      return res.status(400).json({ error: 'Already a member' });
    }

    if (listing.members.length >= listing.maxMembers) {
      return res.status(400).json({ error: 'Group is full' });
    }

    listing.members.push(req.userId);
    await listing.save();

    res.json({ message: 'Joined successfully', listing });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// @route   DELETE /api/listings/:id/members/:memberId
// @desc    Remove member from group
router.delete('/:id/members/:memberId', auth, [
  param('id').isMongoId(),
  param('memberId').isMongoId()
], validate, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Only creator can remove members
    if (listing.uid.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    listing.members = listing.members.filter(m => m.toString() !== req.params.memberId);
    await listing.save();

    res.json({ message: 'Member removed', listing });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// @route   DELETE /api/listings/:id
// @desc    Delete listing
router.delete('/:id', auth, [
  param('id').isMongoId()
], validate, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (listing.uid.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await listing.deleteOne();
    res.json({ message: 'Listing deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

module.exports = router;