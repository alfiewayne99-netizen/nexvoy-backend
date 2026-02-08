const express = require('express');
const router = express.Router();

/**
 * Simple auth middleware to check for req.user
 */
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }
  next();
};

/**
 * User Routes
 * Protected routes for authenticated users
 */

/**
 * GET /api/user/profile
 * Get current user profile
 */
router.get('/profile', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      userId: req.user.userId,
      email: req.user.email,
      role: req.user.role
    }
  });
});

/**
 * PUT /api/user/profile
 * Update user profile
 */
router.put('/profile', requireAuth, (req, res) => {
  const updates = req.body;
  
  res.json({
    success: true,
    message: 'Profile updated',
    data: {
      userId: req.user.userId,
      updates: Object.keys(updates)
    }
  });
});

/**
 * GET /api/user/bookings
 * Get user's bookings
 */
router.get('/bookings', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      userId: req.user.userId,
      bookings: []
    }
  });
});

module.exports = router;
