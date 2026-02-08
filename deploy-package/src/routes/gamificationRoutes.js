/**
 * Gamification Routes
 * Badges, challenges, and leaderboards
 */

const express = require('express');
const router = express.Router();
const gamificationController = require('../controllers/gamificationController');
const { authenticate } = require('../middleware/auth');

// User Progress
router.get('/:userId', authenticate, gamificationController.getUserProgress);

// Badges
router.get('/:userId/badges', authenticate, gamificationController.getBadges);
router.get('/badges', gamificationController.getAllBadges);
router.post('/:userId/badges', authenticate, gamificationController.awardBadge);

// Challenges
router.get('/:userId/challenges', authenticate, gamificationController.getChallenges);
router.post('/:userId/challenges/:challengeId/claim', authenticate, gamificationController.claimChallenge);

// Leaderboard
router.get('/leaderboard', gamificationController.getLeaderboard);

// Exclusive Deals
router.get('/:userId/deals', authenticate, gamificationController.getExclusiveDeals);
router.post('/:userId/deals/:dealId/claim', authenticate, gamificationController.claimDeal);

// Streak
router.get('/:userId/streak', authenticate, gamificationController.getStreak);

module.exports = router;
