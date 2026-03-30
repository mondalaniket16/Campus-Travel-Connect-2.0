const express = require('express');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const User = require('../models/User');
const validate = require('../middleware/validate');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @route   POST /api/auth/signup
// @desc    Register new user
router.post('/signup', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be 6+ characters'),
  body('reg').optional().trim(),
  body('phone').optional().matches(/^\d{10}$/).withMessage('Phone must be 10 digits'),
], validate, async (req, res) => {
  try {
    const { name, email, password, reg, phone } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Account already exists' });
    }

    // Create user
    const user = new User({ name, email, password, reg, phone, authProvider: 'local' });
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], validate, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);
    res.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// @route   POST /api/auth/google
// @desc    Google OAuth login
router.post('/google', [
  body('googleId').notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('name').notEmpty(),
], validate, async (req, res) => {
  try {
    const { googleId, email, name, photoURL } = req.body;

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    
    if (user) {
      // Update Google ID if not set
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = 'google';
      }
      if (photoURL && !user.photoURL) {
        user.photoURL = photoURL;
      }
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Create new user
      user = new User({
        name,
        email,
        googleId,
        photoURL: photoURL || '',
        authProvider: 'google',
        isVerified: true
      });
      await user.save();
    }

    const token = generateToken(user._id);
    res.json({ token, user });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

// @route   POST /api/auth/logout
// @desc    Logout (client-side token removal, server-side optional tracking)
router.post('/logout', auth, async (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;