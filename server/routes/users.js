const express = require('express');
const { body, param } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const validate = require('../middleware/validate');

const router = express.Router();

// @route   GET /api/users/me
// @desc    Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -googleId');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// @route   PUT /api/users/me
// @desc    Update current user profile
router.put('/me', auth, [
  body('name').optional().trim().notEmpty(),
  body('phone').optional().matches(/^\d{10}$/),
  body('bio').optional().isLength({ max: 500 }),
], validate, async (req, res) => {
  try {
    const allowedFields = ['name', 'phone', 'dept', 'bio', 'extraEmail', 'extraPhone'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true }).select('-password -googleId');
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// @route   GET /api/users/search/email
// @desc    Search user by email
router.get('/search/email', auth, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('name reg photoURL email');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user profile by ID
router.get('/:id', [
  param('id').isMongoId().withMessage('Invalid user ID')
], validate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -googleId');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user profile
router.put('/:id', auth, [
  param('id').isMongoId(),
  body('name').optional().trim().notEmpty(),
  body('phone').optional().matches(/^\d{10}$/),
  body('bio').optional().isLength({ max: 500 }),
], validate, async (req, res) => {
  try {
    if (req.params.id !== req.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const allowedFields = ['name', 'phone', 'dept', 'bio', 'extraEmail', 'extraPhone'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// @route   POST /api/users/:id/photo
// @desc    Upload profile photo
router.post('/:id/photo', auth, upload.single('photo'), async (req, res) => {
  try {
    if (req.params.id !== req.userId.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // In production, you'd upload to cloud storage (S3, Cloudinary, etc.)
    const photoURL = `/uploads/${req.file.filename}`;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { photoURL },
      { new: true }
    );

    res.json({ user, photoURL });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});


module.exports = router;
