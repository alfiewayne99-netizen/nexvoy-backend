/**
 * Affiliate Routes
 * Creator/affiliate program routes
 */

const express = require('express');
const router = express.Router();
const affiliateController = require('../controllers/affiliateController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Application
router.post('/apply', affiliateController.apply);
router.get('/status', affiliateController.getApplicationStatus);

// Dashboard
router.get('/:creatorId/dashboard', authenticate, affiliateController.getDashboard);
router.get('/:creatorId/stats', authenticate, affiliateController.getStats);

// Tracking
router.get('/:creatorId/links', authenticate, affiliateController.getTrackingLinks);
router.post('/click/:trackingId', affiliateController.recordClick);

// Bookings
router.get('/:creatorId/bookings', authenticate, affiliateController.getBookings);

// Payouts
router.get('/:creatorId/payouts', authenticate, affiliateController.getPayouts);
router.post('/:creatorId/payouts/request', authenticate, affiliateController.requestPayout);

// Leaderboard
router.get('/leaderboard', affiliateController.getLeaderboard);

// Marketing Assets
router.get('/:creatorId/assets', authenticate, affiliateController.getAssets);

// Admin
router.post('/:creatorId/approve', authenticate, requireAdmin, affiliateController.approveCreator);

module.exports = router;
