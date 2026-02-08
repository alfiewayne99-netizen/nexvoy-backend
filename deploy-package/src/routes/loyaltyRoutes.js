/**
 * Loyalty Routes
 * Points and rewards routes
 */

const express = require('express');
const router = express.Router();
const loyaltyController = require('../controllers/loyaltyController');
const { authenticate } = require('../middleware/auth');

// Account
router.get('/:userId', authenticate, loyaltyController.getAccount);
router.get('/:userId/transactions', authenticate, loyaltyController.getTransactionHistory);

// Booking Integration
router.post('/:userId/bookings', authenticate, loyaltyController.processBooking);

// Redemption
router.post('/:userId/redeem', authenticate, loyaltyController.redeemPoints);

// Referral
router.get('/:userId/referral', authenticate, loyaltyController.getReferralCode);
router.post('/referral', loyaltyController.processReferral);

// Leaderboard
router.get('/leaderboard', loyaltyController.getLeaderboard);

// Tier Benefits
router.get('/tiers/:tier/benefits', loyaltyController.getTierBenefits);

// Birthday
router.post('/:userId/birthday', authenticate, loyaltyController.awardBirthdayReward);
router.put('/:userId/birthday', authenticate, loyaltyController.updateBirthday);

module.exports = router;
