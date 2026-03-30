const express = require('express');
const { body, param } = require('express-validator');
const Rating = require('../models/Rating');
const Report = require('../models/Report');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// @route   POST /api/ratings
// @desc    Rate a journey/listing
router.post('/', auth, [
  body('listingId').isMongoId(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isLength({ max: 500 }),
], validate, async (req, res) => {
  try {
    const { listingId, rating, comment } = req.body;

    const newRating = new Rating({
      fromUid: req.userId,
      listingId,
      rating,
      comment
    });

    await newRating.save();
    res.status(201).json({ rating: newRating, message: 'Rating submitted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// @route   POST /api/ratings/by-email
// @desc    Rate a user by email
router.post('/by-email', auth, [
  body('email').isEmail(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('comment').optional().isLength({ max: 500 }),
], validate, async (req, res) => {
  try {
    const { email, rating, comment } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found with that email' });
    }

    if (user._id.toString() === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot rate yourself' });
    }

    const newRating = new Rating({
      fromUid: req.userId,
      toUid: user._id,
      rating,
      comment
    });

    await newRating.save();
    res.status(201).json({ rating: newRating, message: 'Rating submitted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// @route   GET /api/ratings/my
// @desc    Get ratings given by current user
router.get('/my', auth, async (req, res) => {
  try {
    const ratings = await Rating.find({ fromUid: req.userId })
      .populate('toUid', 'name')
      .sort({ createdAt: -1 });

    res.json({ ratings, count: ratings.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

module.exports = router;