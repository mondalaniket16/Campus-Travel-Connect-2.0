const express = require('express');
const { param } = require('express-validator');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// @route   GET /api/notifications
// @desc    Get user's notifications
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ 
      user: req.userId, 
      read: false 
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
router.put('/:id/read', auth, [
  param('id').isMongoId()
], validate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.userId, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
router.delete('/:id', auth, [
  param('id').isMongoId()
], validate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.userId
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;