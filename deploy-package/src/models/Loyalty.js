/**
 * Loyalty Points Model for Nexvoy
 * Handles points accrual, redemption, and history
 */

const crypto = require('crypto');

// Points earning rules
const POINTS_RULES = {
  // Booking points (per $1 spent)
  FLIGHT: 1,        // 1 point per $1
  HOTEL: 2,         // 2 points per $1
  CAR: 1,           // 1 point per $1
  INSURANCE: 0.5,   // 0.5 points per $1
  PACKAGE: 3,       // 3 points per $1 (bundled bookings)
  
  // Bonus points
  FIRST_BOOKING: 500,
  REFERRAL_SIGNUP: 1000,
  REFERRAL_BOOKING: 2000,
  REVIEW_SUBMITTED: 100,
  PROFILE_COMPLETE: 200,
  MOBILE_APP_BOOKING: 500,
  OFF_SEASON_BONUS: 1.5, // 1.5x multiplier
  
  // Tier bonuses (multipliers applied to base points)
  BRONZE_MULTIPLIER: 1.0,
  SILVER_MULTIPLIER: 1.25,
  GOLD_MULTIPLIER: 1.5,
  PLATINUM_MULTIPLIER: 2.0
};

// Points redemption values (points per $1)
const REDEMPTION_RATES = {
  FLIGHT: 100,      // 100 points = $1
  HOTEL: 80,        // 80 points = $1
  CAR: 100,
  INSURANCE: 120,
  CASHBACK: 200     // 200 points = $1 cashback
};

/**
 * Points Transaction Schema
 */
const PointsTransactionSchema = {
  transactionId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  type: { 
    type: String, 
    required: true, 
    enum: ['earned', 'redeemed', 'bonus', 'expired', 'adjusted', 'referral'],
    index: true 
  },
  
  // Amount details
  points: { type: Number, required: true }, // positive for earned, negative for redeemed
  pointsValue: { type: Number }, // monetary value of points
  
  // Source details
  source: {
    type: { 
      type: String, 
      enum: ['booking', 'referral', 'review', 'profile', 'promotion', 'manual', 'expiry']
    },
    bookingId: { type: String },
    bookingType: { type: String, enum: ['flight', 'hotel', 'car', 'insurance', 'package'] },
    bookingAmount: { type: Number },
    referralUserId: { type: String },
    promoCode: { type: String },
    description: { type: String }
  },
  
  // Redemption details
  redemption: {
    type: { type: String, enum: ['discount', 'free_booking', 'cashback', 'upgrade'] },
    bookingId: { type: String },
    discountAmount: { type: Number },
    currency: { type: String, default: 'USD' }
  },
  
  // Expiration
  expiresAt: { type: Date, index: true },
  expired: { type: Boolean, default: false },
  
  // Tier at time of transaction
  tierAtTransaction: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'] },
  multiplierApplied: { type: Number, default: 1.0 },
  
  // Metadata
  createdAt: { type: Date, default: Date.now, index: true },
  notes: { type: String }
};

/**
 * User Loyalty Account Schema
 */
const UserLoyaltySchema = {
  userId: { type: String, required: true, unique: true },
  
  // Points balance
  pointsBalance: { type: Number, default: 0 },
  lifetimePoints: { type: Number, default: 0 },
  
  // Tier status
  currentTier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
  tierProgress: {
    currentSpend: { type: Number, default: 0 },
    bookingsCount: { type: Number, default: 0 },
    nextTierSpendRequired: { type: Number, default: 1000 },
    nextTierBookingsRequired: { type: Number, default: 3 }
  },
  
  // Special dates
  joinDate: { type: Date, default: Date.now },
  birthday: { type: Date },
  lastBirthdayReward: { type: Date },
  
  // Referral tracking
  referralCode: { type: String, unique: true },
  referralsMade: { type: Number, default: 0 },
  referralEarnings: { type: Number, default: 0 },
  
  // Streak tracking
  streaks: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastBookingDate: { type: Date }
  },
  
  // Expiring points tracking
  expiringPoints: [{
    points: { type: Number },
    expiresAt: { type: Date }
  }],
  
  // Preferences
  preferences: {
    autoRedeem: { type: Boolean, default: false },
    autoRedeemThreshold: { type: Number, default: 10000 },
    notificationsEnabled: { type: Boolean, default: true }
  },
  
  updatedAt: { type: Date, default: Date.now }
};

/**
 * Points Transaction Class
 */
class PointsTransaction {
  constructor(data = {}) {
    this.transactionId = data.transactionId || crypto.randomUUID();
    this.userId = data.userId;
    this.type = data.type;
    this.points = data.points;
    this.pointsValue = data.pointsValue;
    this.source = data.source || {};
    this.redemption = data.redemption || null;
    this.expiresAt = data.expiresAt || this.calculateExpiry();
    this.expired = data.expired || false;
    this.tierAtTransaction = data.tierAtTransaction || 'bronze';
    this.multiplierApplied = data.multiplierApplied || 1.0;
    this.createdAt = data.createdAt || new Date();
    this.notes = data.notes || '';
  }
  
  calculateExpiry() {
    // Points expire after 24 months
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 24);
    return expiry;
  }
  
  toJSON() {
    return {
      transactionId: this.transactionId,
      userId: this.userId,
      type: this.type,
      points: this.points,
      pointsValue: this.pointsValue,
      source: this.source,
      redemption: this.redemption,
      expiresAt: this.expiresAt,
      expired: this.expired,
      tierAtTransaction: this.tierAtTransaction,
      multiplierApplied: this.multiplierApplied,
      createdAt: this.createdAt,
      notes: this.notes
    };
  }
}

/**
 * User Loyalty Account Class
 */
class UserLoyalty {
  constructor(data = {}) {
    this.userId = data.userId;
    this.pointsBalance = data.pointsBalance || 0;
    this.lifetimePoints = data.lifetimePoints || 0;
    this.currentTier = data.currentTier || 'bronze';
    this.tierProgress = data.tierProgress || {
      currentSpend: 0,
      bookingsCount: 0,
      nextTierSpendRequired: 1000,
      nextTierBookingsRequired: 3
    };
    this.joinDate = data.joinDate || new Date();
    this.birthday = data.birthday || null;
    this.lastBirthdayReward = data.lastBirthdayReward || null;
    this.referralCode = data.referralCode || this.generateReferralCode();
    this.referralsMade = data.referralsMade || 0;
    this.referralEarnings = data.referralEarnings || 0;
    this.streaks = data.streaks || {
      current: 0,
      longest: 0,
      lastBookingDate: null
    };
    this.expiringPoints = data.expiringPoints || [];
    this.preferences = data.preferences || {
      autoRedeem: false,
      autoRedeemThreshold: 10000,
      notificationsEnabled: true
    };
    this.updatedAt = data.updatedAt || new Date();
  }
  
  generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'NVY';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
  
  /**
   * Calculate points earned for a booking
   */
  calculateBookingPoints(bookingType, amount, tier = this.currentTier) {
    const baseRate = POINTS_RULES[bookingType.toUpperCase()] || 1;
    const tierMultiplier = POINTS_RULES[`${tier.toUpperCase()}_MULTIPLIER`] || 1;
    
    return Math.floor(amount * baseRate * tierMultiplier);
  }
  
  /**
   * Add points to account
   */
  addPoints(points, source) {
    this.pointsBalance += points;
    this.lifetimePoints += points;
    
    // Update tier progress
    if (source?.bookingAmount) {
      this.tierProgress.currentSpend += source.bookingAmount;
      this.tierProgress.bookingsCount += 1;
    }
    
    this.updatedAt = new Date();
    return this.pointsBalance;
  }
  
  /**
   * Deduct points (for redemption)
   */
  deductPoints(points) {
    if (this.pointsBalance < points) {
      throw new Error('Insufficient points balance');
    }
    this.pointsBalance -= points;
    this.updatedAt = new Date();
    return this.pointsBalance;
  }
  
  /**
   * Update streak
   */
  updateStreak() {
    const now = new Date();
    const lastBooking = this.streaks.lastBookingDate;
    
    if (lastBooking) {
      const daysSinceLastBooking = Math.floor((now - lastBooking) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastBooking <= 30) {
        this.streaks.current += 1;
        if (this.streaks.current > this.streaks.longest) {
          this.streaks.longest = this.streaks.current;
        }
      } else {
        this.streaks.current = 1;
      }
    } else {
      this.streaks.current = 1;
    }
    
    this.streaks.lastBookingDate = now;
    this.updatedAt = new Date();
    return this.streaks.current;
  }
  
  /**
   * Check for birthday reward eligibility
   */
  isBirthdayRewardEligible() {
    if (!this.birthday) return false;
    
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastReward = this.lastBirthdayReward;
    
    // Check if already given this year
    if (lastReward && lastReward.getFullYear() === thisYear) {
      return false;
    }
    
    // Check if birthday is within 7 days
    const birthdayThisYear = new Date(this.birthday);
    birthdayThisYear.setFullYear(thisYear);
    
    const daysUntilBirthday = Math.floor((birthdayThisYear - now) / (1000 * 60 * 60 * 24));
    
    return daysUntilBirthday >= -7 && daysUntilBirthday <= 7;
  }
  
  /**
   * Get redemption value for points
   */
  getRedemptionValue(points, type = 'CASHBACK') {
    const rate = REDEMPTION_RATES[type.toUpperCase()] || 100;
    return points / rate;
  }
  
  /**
   * Check if user should be upgraded to next tier
   */
  checkTierUpgrade() {
    const tiers = ['bronze', 'silver', 'gold', 'platinum'];
    const currentIndex = tiers.indexOf(this.currentTier);
    
    if (currentIndex >= tiers.length - 1) return null;
    
    const nextTier = tiers[currentIndex + 1];
    const requirements = TIER_REQUIREMENTS[nextTier];
    
    if (this.tierProgress.currentSpend >= requirements.minSpend &&
        this.tierProgress.bookingsCount >= requirements.minBookings) {
      return nextTier;
    }
    
    return null;
  }
  
  toJSON() {
    return {
      userId: this.userId,
      pointsBalance: this.pointsBalance,
      lifetimePoints: this.lifetimePoints,
      currentTier: this.currentTier,
      tierProgress: this.tierProgress,
      joinDate: this.joinDate,
      birthday: this.birthday,
      lastBirthdayReward: this.lastBirthdayReward,
      referralCode: this.referralCode,
      referralsMade: this.referralsMade,
      referralEarnings: this.referralEarnings,
      streaks: this.streaks,
      expiringPoints: this.expiringPoints,
      preferences: this.preferences,
      updatedAt: this.updatedAt
    };
  }
}

// Tier requirements
const TIER_REQUIREMENTS = {
  bronze: { minSpend: 0, minBookings: 0 },
  silver: { minSpend: 1000, minBookings: 3 },
  gold: { minSpend: 5000, minBookings: 10 },
  platinum: { minSpend: 20000, minBookings: 25 }
};

/**
 * Loyalty Program Repository
 */
class LoyaltyRepository {
  constructor(database = null) {
    this.db = database;
    this.accounts = new Map();
    this.transactions = new Map();
  }
  
  /**
   * Create loyalty account for user
   */
  async createAccount(userId, birthday = null) {
    const account = new UserLoyalty({ 
      userId,
      birthday: birthday ? new Date(birthday) : null
    });
    
    this.accounts.set(userId, account);
    
    if (this.db) {
      await this.db.collection('loyalty_accounts').insertOne(account.toJSON());
    }
    
    return account;
  }
  
  /**
   * Get account by user ID
   */
  async getAccount(userId) {
    if (this.accounts.has(userId)) {
      return this.accounts.get(userId);
    }
    
    if (this.db) {
      const data = await this.db.collection('loyalty_accounts').findOne({ userId });
      if (data) {
        const account = new UserLoyalty(data);
        this.accounts.set(userId, account);
        return account;
      }
    }
    
    return null;
  }
  
  /**
   * Record points transaction
   */
  async recordTransaction(userId, type, points, source = {}, tier = 'bronze') {
    const transaction = new PointsTransaction({
      userId,
      type,
      points,
      source,
      tierAtTransaction: tier
    });
    
    this.transactions.set(transaction.transactionId, transaction);
    
    // Update account
    const account = await this.getAccount(userId);
    if (account) {
      if (type === 'earned' || type === 'bonus' || type === 'referral') {
        account.addPoints(points, source);
      } else if (type === 'redeemed') {
        account.deductPoints(Math.abs(points));
      }
      
      // Check for tier upgrade
      const newTier = account.checkTierUpgrade();
      if (newTier) {
        account.currentTier = newTier;
        // Update requirements for next tier
        const nextTierRequirements = TIER_REQUIREMENTS[this.getNextTier(newTier)];
        if (nextTierRequirements) {
          account.tierProgress.nextTierSpendRequired = nextTierRequirements.minSpend;
          account.tierProgress.nextTierBookingsRequired = nextTierRequirements.minBookings;
        }
      }
    }
    
    if (this.db) {
      await this.db.collection('points_transactions').insertOne(transaction.toJSON());
      await this.db.collection('loyalty_accounts').updateOne(
        { userId },
        { $set: account.toJSON() }
      );
    }
    
    return transaction;
  }
  
  /**
   * Get transaction history
   */
  async getTransactionHistory(userId, options = {}) {
    const { limit = 50, offset = 0, type } = options;
    
    let transactions = Array.from(this.transactions.values())
      .filter(t => t.userId === userId);
    
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }
    
    transactions.sort((a, b) => b.createdAt - a.createdAt);
    
    return transactions.slice(offset, offset + limit);
  }
  
  /**
   * Process booking and award points
   */
  async processBooking(userId, bookingId, bookingType, amount) {
    const account = await this.getAccount(userId);
    if (!account) {
      throw new Error('Loyalty account not found');
    }
    
    // Calculate points
    const points = account.calculateBookingPoints(bookingType, amount, account.currentTier);
    
    // Record transaction
    const transaction = await this.recordTransaction(
      userId,
      'earned',
      points,
      {
        type: 'booking',
        bookingId,
        bookingType,
        bookingAmount: amount
      },
      account.currentTier
    );
    
    // Update streak
    account.updateStreak();
    
    // Check for first booking bonus
    if (account.tierProgress.bookingsCount === 1) {
      await this.recordTransaction(
        userId,
        'bonus',
        POINTS_RULES.FIRST_BOOKING,
        { type: 'promotion', description: 'First booking bonus' },
        account.currentTier
      );
    }
    
    return { transaction, newBalance: account.pointsBalance, tier: account.currentTier };
  }
  
  /**
   * Process referral
   */
  async processReferral(referrerId, referredId) {
    const referrer = await this.getAccount(referrerId);
    if (!referrer) return null;
    
    // Award referral signup bonus
    await this.recordTransaction(
      referrerId,
      'referral',
      POINTS_RULES.REFERRAL_SIGNUP,
      { type: 'referral', referralUserId: referredId, description: 'Referral signup' },
      referrer.currentTier
    );
    
    referrer.referralsMade += 1;
    
    return referrer;
  }
  
  /**
   * Award birthday reward
   */
  async awardBirthdayReward(userId) {
    const account = await this.getAccount(userId);
    if (!account || !account.isBirthdayRewardEligible()) {
      return null;
    }
    
    const birthdayPoints = 1000; // 1000 bonus points
    
    const transaction = await this.recordTransaction(
      userId,
      'bonus',
      birthdayPoints,
      { type: 'promotion', description: 'Birthday reward' },
      account.currentTier
    );
    
    account.lastBirthdayReward = new Date();
    
    return transaction;
  }
  
  /**
   * Redeem points
   */
  async redeemPoints(userId, points, redemptionType, bookingId = null) {
    const account = await this.getAccount(userId);
    if (!account) {
      throw new Error('Loyalty account not found');
    }
    
    if (account.pointsBalance < points) {
      throw new Error('Insufficient points');
    }
    
    const value = account.getRedemptionValue(points, redemptionType);
    
    const transaction = await this.recordTransaction(
      userId,
      'redeemed',
      -points,
      {},
      account.currentTier
    );
    
    transaction.redemption = {
      type: redemptionType,
      bookingId,
      discountAmount: value,
      currency: 'USD'
    };
    
    return { transaction, value, newBalance: account.pointsBalance };
  }
  
  /**
   * Get next tier
   */
  getNextTier(currentTier) {
    const tiers = ['bronze', 'silver', 'gold', 'platinum'];
    const index = tiers.indexOf(currentTier);
    return index < tiers.length - 1 ? tiers[index + 1] : null;
  }
  
  /**
   * Get tier benefits
   */
  getTierBenefits(tier) {
    const benefits = {
      bronze: {
        name: 'Bronze',
        multiplier: 1.0,
        perks: ['Earn points on every booking', 'Member-only deals'],
        color: '#cd7f32'
      },
      silver: {
        name: 'Silver',
        multiplier: 1.25,
        perks: ['25% bonus points', 'Priority customer support', 'Free seat selection on flights'],
        color: '#c0c0c0'
      },
      gold: {
        name: 'Gold',
        multiplier: 1.5,
        perks: ['50% bonus points', 'Free checked bag', 'Room upgrades (subject to availability)', 'Early check-in/late checkout'],
        color: '#ffd700'
      },
      platinum: {
        name: 'Platinum',
        multiplier: 2.0,
        perks: ['100% bonus points', 'Dedicated support line', 'Guaranteed room upgrades', 'Lounge access', 'Free cancellation on most bookings'],
        color: '#e5e4e2'
      }
    };
    
    return benefits[tier] || benefits.bronze;
  }
  
  /**
   * Get leaderboard
   */
  async getLeaderboard(limit = 10) {
    const accounts = Array.from(this.accounts.values())
      .sort((a, b) => b.lifetimePoints - a.lifetimePoints)
      .slice(0, limit)
      .map((account, index) => ({
        rank: index + 1,
        userId: account.userId,
        currentTier: account.currentTier,
        lifetimePoints: account.lifetimePoints,
        streak: account.streaks.current
      }));
    
    return accounts;
  }
}

module.exports = {
  POINTS_RULES,
  REDEMPTION_RATES,
  TIER_REQUIREMENTS,
  PointsTransaction,
  PointsTransactionSchema,
  UserLoyalty,
  UserLoyaltySchema,
  LoyaltyRepository
};