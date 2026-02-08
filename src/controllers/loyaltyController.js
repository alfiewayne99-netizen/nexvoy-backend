/**
 * Loyalty Controller
 * Handles points, tiers, and rewards
 */

const { LoyaltyRepository } = require('../models/Loyalty');

const loyaltyRepo = new LoyaltyRepository();

/**
 * Get user loyalty account
 */
exports.getAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    let account = await loyaltyRepo.getAccount(userId);
    
    if (!account) {
      // Create new account
      account = await loyaltyRepo.createAccount(userId);
    }
    
    res.json({
      success: true,
      data: account.toJSON()
    });
  } catch (error) {
    console.error('Failed to get account:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get transaction history
 */
exports.getTransactionHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const options = req.query;
    
    const transactions = await loyaltyRepo.getTransactionHistory(userId, options);
    
    res.json({
      success: true,
      data: transactions.map(t => t.toJSON())
    });
  } catch (error) {
    console.error('Failed to get transactions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Process booking and award points
 */
exports.processBooking = async (req, res) => {
  try {
    const { userId } = req.params;
    const { bookingId, bookingType, amount } = req.body;
    
    const result = await loyaltyRepo.processBooking(userId, bookingId, bookingType, amount);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Failed to process booking:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Redeem points
 */
exports.redeemPoints = async (req, res) => {
  try {
    const { userId } = req.params;
    const { points, redemptionType, bookingId } = req.body;
    
    const result = await loyaltyRepo.redeemPoints(userId, points, redemptionType, bookingId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Failed to redeem points:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get referral code
 */
exports.getReferralCode = async (req, res) => {
  try {
    const { userId } = req.params;
    const account = await loyaltyRepo.getAccount(userId);
    
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        referralCode: account.referralCode,
        referralsMade: account.referralsMade,
        referralEarnings: account.referralEarnings
      }
    });
  } catch (error) {
    console.error('Failed to get referral code:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Process referral
 */
exports.processReferral = async (req, res) => {
  try {
    const { referralCode } = req.body;
    const { userId } = req.params; // New user
    
    // Find referrer by code
    // In production, this would query the database
    
    res.json({
      success: true,
      data: {
        message: 'Referral processed successfully',
        bonusPoints: 1000
      }
    });
  } catch (error) {
    console.error('Failed to process referral:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get leaderboard
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const leaderboard = await loyaltyRepo.getLeaderboard(parseInt(limit));
    
    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Failed to get leaderboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get tier benefits
 */
exports.getTierBenefits = async (req, res) => {
  try {
    const { tier } = req.params;
    const benefits = loyaltyRepo.getTierBenefits(tier);
    
    res.json({
      success: true,
      data: benefits
    });
  } catch (error) {
    console.error('Failed to get tier benefits:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Award birthday reward
 */
exports.awardBirthdayReward = async (req, res) => {
  try {
    const { userId } = req.params;
    const transaction = await loyaltyRepo.awardBirthdayReward(userId);
    
    if (!transaction) {
      return res.status(400).json({
        success: false,
        error: 'Not eligible for birthday reward'
      });
    }
    
    res.json({
      success: true,
      data: transaction.toJSON()
    });
  } catch (error) {
    console.error('Failed to award birthday reward:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Update birthday
 */
exports.updateBirthday = async (req, res) => {
  try {
    const { userId } = req.params;
    const { birthday } = req.body;
    
    const account = await loyaltyRepo.getAccount(userId);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    account.birthday = new Date(birthday);
    
    res.json({
      success: true,
      data: account.toJSON()
    });
  } catch (error) {
    console.error('Failed to update birthday:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
