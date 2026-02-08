const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  register,
  login,
  logout,
  refresh,
  getProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  googleAuth,
  googleCallback
} = require('../controllers/authController');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Google OAuth routes
router.get('/google', googleAuth);
router.post('/google/callback', googleCallback);

// Protected routes - require authentication
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getProfile);
router.put('/password', authenticate, changePassword);

module.exports = router;
