/**
 * Affiliate/Creator Program Model for Nexvoy
 * Handles creator onboarding, tracking, commissions, and payouts
 */

const crypto = require('crypto');

// Commission structure
const COMMISSION_RATES = {
  STANDARD: 0.15,      // 15% standard rate
  BETA: 0.20,          // 20% beta/promotional rate
  VIP: 0.18,           // 18% top performer rate
  ENTERPRISE: 0.10     // 10% for B2B referrals
};

// Influencer tiers based on performance
const INFLUENCER_TIERS = {
  NEWBIE: {
    name: 'Newbie',
    minFollowers: 1000,
    minBookings: 0,
    commissionRate: COMMISSION_RATES.STANDARD,
    benefits: ['Standard 15% commission', '30-day cookie']
  },
  RISING: {
    name: 'Rising Star',
    minFollowers: 10000,
    minBookings: 5,
    commissionRate: COMMISSION_RATES.STANDARD,
    benefits: ['15% commission', 'Early access to new features', 'Monthly performance report']
  },
  ESTABLISHED: {
    name: 'Established',
    minFollowers: 50000,
    minBookings: 20,
    commissionRate: COMMISSION_RATES.VIP,
    benefits: ['18% commission', 'Priority support', 'Exclusive promo codes', 'Co-marketing opportunities']
  },
  ELITE: {
    name: 'Elite Creator',
    minFollowers: 100000,
    minBookings: 50,
    commissionRate: COMMISSION_RATES.VIP,
    benefits: ['18% commission', 'Dedicated account manager', 'Free trips for content', 'Custom landing pages', 'First look at new destinations']
  },
  AMBASSADOR: {
    name: 'Brand Ambassador',
    minFollowers: 250000,
    minBookings: 100,
    commissionRate: 0.20,
    benefits: ['20% commission', 'Annual brand trip', 'Revenue share on referred creators', 'Product input privileges', 'Speaking opportunities']
  }
};

/**
 * Creator/Affiliate Schema
 */
const CreatorSchema = {
  creatorId: { type: String, required: true, unique: true },
  
  // Personal info
  email: { type: String, required: true },
  name: { type: String, required: true },
  handle: { type: String, required: true },
  
  // Social media
  platform: { 
    type: String, 
    required: true, 
    enum: ['instagram', 'tiktok', 'youtube', 'twitter', 'blog', 'podcast', 'other'] 
  },
  platformUrl: { type: String },
  followerCount: { type: Number, default: 0 },
  
  // Categorization
  category: { 
    type: String, 
    enum: ['travel', 'food', 'lifestyle', 'fashion', 'tech', 'fitness', 'family', 'luxury', 'budget', 'adventure'] 
  },
  bio: { type: String },
  avatarUrl: { type: String },
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'active', 'suspended', 'banned'],
    default: 'pending'
  },
  tier: { 
    type: String, 
    enum: ['newbie', 'rising', 'established', 'elite', 'ambassador'],
    default: 'newbie'
  },
  
  // Commission
  commissionRate: { type: Number, default: COMMISSION_RATES.STANDARD },
  customRate: { type: Number }, // Override default rate
  
  // Tracking
  trackingId: { type: String, unique: true },
  promoCode: { type: String, unique: true },
  
  // Payout info
  payoutMethod: { 
    type: String, 
    enum: ['paypal', 'bank_transfer', 'crypto', 'venmo'],
    default: 'paypal'
  },
  payoutDetails: { type: Object }, // Encrypted
  payoutThreshold: { type: Number, default: 50 }, // Minimum $50 for payout
  
  // Stats
  stats: {
    totalClicks: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    totalCommission: { type: Number, default: 0 },
    pendingCommission: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 }
  },
  
  // Marketing assets access
  assetsAccess: {
    logos: { type: Boolean, default: false },
    templates: { type: Boolean, default: false },
    photos: { type: Boolean, default: false },
    videos: { type: Boolean, default: false }
  },
  
  // Timestamps
  appliedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  approvedBy: { type: String },
  lastActivityAt: { type: Date },
  
  // Application notes
  applicationNotes: { type: String },
  adminNotes: { type: String }
};

/**
 * Affiliate Click Schema
 */
const AffiliateClickSchema = {
  clickId: { type: String, required: true, unique: true },
  creatorId: { type: String, required: true, index: true },
  
  // Tracking
  trackingId: { type: String },
  promoCode: { type: String },
  
  // Click details
  clickedAt: { type: Date, default: Date.now },
  ipAddress: { type: String },
  userAgent: { type: String },
  referrerUrl: { type: String },
  landingPage: { type: String },
  country: { type: String },
  deviceType: { type: String, enum: ['desktop', 'mobile', 'tablet'] },
  browser: { type: String },
  os: { type: String },
  
  // Conversion tracking
  converted: { type: Boolean, default: false },
  bookingId: { type: String },
  convertedAt: { type: Date },
  
  // Cookie tracking
  cookieId: { type: String },
  attributed: { type: Boolean, default: false }
};

/**
 * Affiliate Booking Schema
 */
const AffiliateBookingSchema = {
  affiliateBookingId: { type: String, required: true, unique: true },
  creatorId: { type: String, required: true, index: true },
  bookingId: { type: String, required: true },
  
  // Attribution
  clickId: { type: String },
  trackingId: { type: String },
  promoCode: { type: String },
  
  // Booking details
  customerId: { type: String },
  bookingType: { type: String, enum: ['flight', 'hotel', 'car', 'insurance', 'package'] },
  bookingDate: { type: Date, default: Date.now },
  
  // Financial
  bookingAmount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  commissionRate: { type: Number, required: true },
  commissionAmount: { type: Number, required: true },
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'cancelled', 'paid', 'refunded'],
    default: 'pending'
  },
  
  // Payout tracking
  payoutId: { type: String },
  paidAt: { type: Date },
  paidAmount: { type: Number },
  
  // Refund tracking
  refundedAt: { type: Date },
  refundAmount: { type: Number },
  
  // Fraud detection
  fraudScore: { type: Number, default: 0 },
  flagged: { type: Boolean, default: false },
  flagReason: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
};

/**
 * Payout Record Schema
 */
const PayoutRecordSchema = {
  payoutId: { type: String, required: true, unique: true },
  creatorId: { type: String, required: true, index: true },
  
  // Period
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  
  // Amounts
  totalBookings: { type: Number, default: 0 },
  totalCommission: { type: Number, default: 0 },
  adjustments: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  
  // Payment
  payoutMethod: { type: String, required: true },
  payoutStatus: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  transactionId: { type: String },
  paidAt: { type: Date },
  
  // Associated bookings
  bookingIds: [{ type: String }],
  
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
  notes: { type: String }
};

/**
 * Creator Class
 */
class Creator {
  constructor(data = {}) {
    this.creatorId = data.creatorId || crypto.randomUUID();
    this.email = data.email;
    this.name = data.name;
    this.handle = data.handle;
    this.platform = data.platform;
    this.platformUrl = data.platformUrl || '';
    this.followerCount = data.followerCount || 0;
    this.category = data.category || 'travel';
    this.bio = data.bio || '';
    this.avatarUrl = data.avatarUrl || '';
    this.status = data.status || 'pending';
    this.tier = data.tier || 'newbie';
    this.commissionRate = data.commissionRate || COMMISSION_RATES.STANDARD;
    this.customRate = data.customRate || null;
    this.trackingId = data.trackingId || this.generateTrackingId();
    this.promoCode = data.promoCode || this.generatePromoCode();
    this.payoutMethod = data.payoutMethod || 'paypal';
    this.payoutDetails = data.payoutDetails || {};
    this.payoutThreshold = data.payoutThreshold || 50;
    this.stats = data.stats || {
      totalClicks: 0,
      totalBookings: 0,
      totalRevenue: 0,
      totalCommission: 0,
      pendingCommission: 0,
      conversionRate: 0
    };
    this.assetsAccess = data.assetsAccess || {
      logos: false,
      templates: false,
      photos: false,
      videos: false
    };
    this.appliedAt = data.appliedAt || new Date();
    this.approvedAt = data.approvedAt || null;
    this.approvedBy = data.approvedBy || null;
    this.lastActivityAt = data.lastActivityAt || null;
    this.applicationNotes = data.applicationNotes || '';
    this.adminNotes = data.adminNotes || '';
  }
  
  generateTrackingId() {
    return 'nv' + Math.random().toString(36).substring(2, 10);
  }
  
  generatePromoCode() {
    const prefix = this.handle?.substring(0, 4).toUpperCase() || 'NV';
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${suffix}`;
  }
  
  /**
   * Calculate effective commission rate
   */
  getEffectiveRate() {
    return this.customRate || this.commissionRate || COMMISSION_RATES.STANDARD;
  }
  
  /**
   * Check if eligible for tier upgrade
   */
  checkTierUpgrade() {
    const tiers = Object.entries(INFLUENCER_TIERS);
    
    for (const [tierKey, tierData] of tiers) {
      if (this.tier !== tierKey.toLowerCase() &&
          this.followerCount >= tierData.minFollowers &&
          this.stats.totalBookings >= tierData.minBookings) {
        return tierKey.toLowerCase();
      }
    }
    
    return null;
  }
  
  /**
   * Update stats after new booking
   */
  updateStats(bookingAmount, commissionAmount) {
    this.stats.totalBookings += 1;
    this.stats.totalRevenue += bookingAmount;
    this.stats.totalCommission += commissionAmount;
    this.stats.pendingCommission += commissionAmount;
    
    // Recalculate conversion rate
    if (this.stats.totalClicks > 0) {
      this.stats.conversionRate = (this.stats.totalBookings / this.stats.totalClicks) * 100;
    }
    
    this.lastActivityAt = new Date();
  }
  
  /**
   * Approve application
   */
  approve(adminId) {
    this.status = 'active';
    this.approvedAt = new Date();
    this.approvedBy = adminId;
    this.assetsAccess = {
      logos: true,
      templates: true,
      photos: true,
      videos: false
    };
  }
  
  /**
   * Generate tracking links
   */
  generateTrackingLinks(baseUrl = 'https://nexvoy.com') {
    return {
      base: `${baseUrl}/r/${this.trackingId}`,
      flights: `${baseUrl}/flights?ref=${this.trackingId}`,
      hotels: `${baseUrl}/hotels?ref=${this.trackingId}`,
      cars: `${baseUrl}/cars?ref=${this.trackingId}`,
      deals: `${baseUrl}/deals?ref=${this.trackingId}`
    };
  }
  
  toJSON() {
    return {
      creatorId: this.creatorId,
      email: this.email,
      name: this.name,
      handle: this.handle,
      platform: this.platform,
      platformUrl: this.platformUrl,
      followerCount: this.followerCount,
      category: this.category,
      bio: this.bio,
      avatarUrl: this.avatarUrl,
      status: this.status,
      tier: this.tier,
      commissionRate: this.commissionRate,
      customRate: this.customRate,
      trackingId: this.trackingId,
      promoCode: this.promoCode,
      payoutMethod: this.payoutMethod,
      payoutDetails: this.payoutDetails,
      payoutThreshold: this.payoutThreshold,
      stats: this.stats,
      assetsAccess: this.assetsAccess,
      appliedAt: this.appliedAt,
      approvedAt: this.approvedAt,
      approvedBy: this.approvedBy,
      lastActivityAt: this.lastActivityAt,
      applicationNotes: this.applicationNotes,
      adminNotes: this.adminNotes
    };
  }
}

/**
 * Affiliate Click Class
 */
class AffiliateClick {
  constructor(data = {}) {
    this.clickId = data.clickId || crypto.randomUUID();
    this.creatorId = data.creatorId;
    this.trackingId = data.trackingId;
    this.promoCode = data.promoCode || null;
    this.clickedAt = data.clickedAt || new Date();
    this.ipAddress = data.ipAddress;
    this.userAgent = data.userAgent;
    this.referrerUrl = data.referrerUrl;
    this.landingPage = data.landingPage;
    this.country = data.country;
    this.deviceType = data.deviceType;
    this.browser = data.browser;
    this.os = data.os;
    this.converted = data.converted || false;
    this.bookingId = data.bookingId || null;
    this.convertedAt = data.convertedAt || null;
    this.cookieId = data.cookieId || null;
    this.attributed = data.attributed || false;
  }
  
  toJSON() {
    return {
      clickId: this.clickId,
      creatorId: this.creatorId,
      trackingId: this.trackingId,
      promoCode: this.promoCode,
      clickedAt: this.clickedAt,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      referrerUrl: this.referrerUrl,
      landingPage: this.landingPage,
      country: this.country,
      deviceType: this.deviceType,
      browser: this.browser,
      os: this.os,
      converted: this.converted,
      bookingId: this.bookingId,
      convertedAt: this.convertedAt,
      cookieId: this.cookieId,
      attributed: this.attributed
    };
  }
}

/**
 * Affiliate Booking Class
 */
class AffiliateBooking {
  constructor(data = {}) {
    this.affiliateBookingId = data.affiliateBookingId || crypto.randomUUID();
    this.creatorId = data.creatorId;
    this.bookingId = data.bookingId;
    this.clickId = data.clickId || null;
    this.trackingId = data.trackingId;
    this.promoCode = data.promoCode || null;
    this.customerId = data.customerId;
    this.bookingType = data.bookingType;
    this.bookingDate = data.bookingDate || new Date();
    this.bookingAmount = data.bookingAmount;
    this.currency = data.currency || 'USD';
    this.commissionRate = data.commissionRate;
    this.commissionAmount = data.commissionAmount;
    this.status = data.status || 'pending';
    this.payoutId = data.payoutId || null;
    this.paidAt = data.paidAt || null;
    this.paidAmount = data.paidAmount || null;
    this.refundedAt = data.refundedAt || null;
    this.refundAmount = data.refundAmount || null;
    this.fraudScore = data.fraudScore || 0;
    this.flagged = data.flagged || false;
    this.flagReason = data.flagReason || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }
  
  /**
   * Confirm booking (after payment)
   */
  confirm() {
    this.status = 'confirmed';
    this.updatedAt = new Date();
  }
  
  /**
   * Mark as paid
   */
  markPaid(payoutId) {
    this.status = 'paid';
    this.payoutId = payoutId;
    this.paidAt = new Date();
    this.paidAmount = this.commissionAmount;
    this.updatedAt = new Date();
  }
  
  /**
   * Process refund
   */
  processRefund(amount) {
    this.refundAmount = amount;
    this.refundedAt = new Date();
    
    if (amount >= this.commissionAmount) {
      this.status = 'refunded';
    }
    
    this.updatedAt = new Date();
  }
  
  toJSON() {
    return {
      affiliateBookingId: this.affiliateBookingId,
      creatorId: this.creatorId,
      bookingId: this.bookingId,
      clickId: this.clickId,
      trackingId: this.trackingId,
      promoCode: this.promoCode,
      customerId: this.customerId,
      bookingType: this.bookingType,
      bookingDate: this.bookingDate,
      bookingAmount: this.bookingAmount,
      currency: this.currency,
      commissionRate: this.commissionRate,
      commissionAmount: this.commissionAmount,
      status: this.status,
      payoutId: this.payoutId,
      paidAt: this.paidAt,
      paidAmount: this.paidAmount,
      refundedAt: this.refundedAt,
      refundAmount: this.refundAmount,
      fraudScore: this.fraudScore,
      flagged: this.flagged,
      flagReason: this.flagReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Affiliate Repository
 */
class AffiliateRepository {
  constructor(database = null) {
    this.db = database;
    this.creators = new Map();
    this.clicks = new Map();
    this.bookings = new Map();
    this.payouts = new Map();
  }
  
  /**
   * Apply to become creator
   */
  async apply(data) {
    const creator = new Creator(data);
    this.creators.set(creator.creatorId, creator);
    
    if (this.db) {
      await this.db.collection('creators').insertOne(creator.toJSON());
    }
    
    return creator;
  }
  
  /**
   * Approve creator application
   */
  async approve(creatorId, adminId) {
    const creator = this.creators.get(creatorId);
    if (!creator) return null;
    
    creator.approve(adminId);
    
    if (this.db) {
      await this.db.collection('creators').updateOne(
        { creatorId },
        { $set: { 
          status: creator.status, 
          approvedAt: creator.approvedAt, 
          approvedBy: creator.approvedBy,
          assetsAccess: creator.assetsAccess
        }}
      );
    }
    
    return creator;
  }
  
  /**
   * Record click
   */
  async recordClick(data) {
    const click = new AffiliateClick(data);
    this.clicks.set(click.clickId, click);
    
    // Update creator stats
    const creator = await this.getCreatorByTrackingId(click.trackingId);
    if (creator) {
      creator.stats.totalClicks += 1;
    }
    
    if (this.db) {
      await this.db.collection('affiliate_clicks').insertOne(click.toJSON());
    }
    
    return click;
  }
  
  /**
   * Record booking attribution
   */
  async recordBooking(creatorId, bookingData) {
    const creator = this.creators.get(creatorId);
    if (!creator) throw new Error('Creator not found');
    
    const commissionRate = creator.getEffectiveRate();
    const commissionAmount = bookingData.bookingAmount * commissionRate;
    
    const affiliateBooking = new AffiliateBooking({
      creatorId,
      ...bookingData,
      commissionRate,
      commissionAmount
    });
    
    this.bookings.set(affiliateBooking.affiliateBookingId, affiliateBooking);
    
    // Update creator stats
    creator.updateStats(bookingData.bookingAmount, commissionAmount);
    
    if (this.db) {
      await this.db.collection('affiliate_bookings').insertOne(affiliateBooking.toJSON());
      await this.db.collection('creators').updateOne(
        { creatorId },
        { $set: { stats: creator.stats } }
      );
    }
    
    return affiliateBooking;
  }
  
  /**
   * Get creator by ID
   */
  async getCreator(creatorId) {
    return this.creators.get(creatorId) || null;
  }
  
  /**
   * Get creator by tracking ID
   */
  async getCreatorByTrackingId(trackingId) {
    for (const creator of this.creators.values()) {
      if (creator.trackingId === trackingId) {
        return creator;
      }
    }
    return null;
  }
  
  /**
   * Get creator by promo code
   */
  async getCreatorByPromoCode(promoCode) {
    for (const creator of this.creators.values()) {
      if (creator.promoCode === promoCode) {
        return creator;
      }
    }
    return null;
  }
  
  /**
   * Get creator stats
   */
  async getCreatorStats(creatorId, period = '30d') {
    const creator = this.creators.get(creatorId);
    if (!creator) return null;
    
    // Filter bookings by period
    const days = parseInt(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const periodBookings = Array.from(this.bookings.values())
      .filter(b => b.creatorId === creatorId && b.bookingDate >= cutoff);
    
    const periodClicks = Array.from(this.clicks.values())
      .filter(c => c.creatorId === creatorId && c.clickedAt >= cutoff);
    
    return {
      creatorId,
      period,
      clicks: periodClicks.length,
      bookings: periodBookings.length,
      revenue: periodBookings.reduce((sum, b) => sum + b.bookingAmount, 0),
      commission: periodBookings.reduce((sum, b) => sum + b.commissionAmount, 0),
      conversionRate: periodClicks.length > 0 
        ? (periodBookings.length / periodClicks.length) * 100 
        : 0,
      lifetime: creator.stats
    };
  }
  
  /**
   * Get pending payouts
   */
  async getPendingPayouts(creatorId) {
    return Array.from(this.bookings.values())
      .filter(b => b.creatorId === creatorId && b.status === 'confirmed')
      .reduce((sum, b) => sum + b.commissionAmount, 0);
  }
  
  /**
   * Create payout
   */
  async createPayout(creatorId, periodStart, periodEnd) {
    const pendingBookings = Array.from(this.bookings.values())
      .filter(b => 
        b.creatorId === creatorId && 
        b.status === 'confirmed' &&
        b.bookingDate >= periodStart &&
        b.bookingDate <= periodEnd
      );
    
    if (pendingBookings.length === 0) return null;
    
    const totalCommission = pendingBookings.reduce((sum, b) => sum + b.commissionAmount, 0);
    
    const payout = {
      payoutId: crypto.randomUUID(),
      creatorId,
      periodStart,
      periodEnd,
      totalBookings: pendingBookings.length,
      totalCommission,
      adjustments: 0,
      finalAmount: totalCommission,
      currency: 'USD',
      payoutMethod: this.creators.get(creatorId)?.payoutMethod || 'paypal',
      payoutStatus: 'pending',
      bookingIds: pendingBookings.map(b => b.affiliateBookingId),
      createdAt: new Date()
    };
    
    this.payouts.set(payout.payoutId, payout);
    
    // Update bookings
    pendingBookings.forEach(b => b.markPaid(payout.payoutId));
    
    if (this.db) {
      await this.db.collection('affiliate_payouts').insertOne(payout);
    }
    
    return payout;
  }
  
  /**
   * Get leaderboard
   */
  async getLeaderboard(limit = 10) {
    return Array.from(this.creators.values())
      .filter(c => c.status === 'active')
      .sort((a, b) => b.stats.totalCommission - a.stats.totalCommission)
      .slice(0, limit)
      .map((creator, index) => ({
        rank: index + 1,
        creatorId: creator.creatorId,
        name: creator.name,
        handle: creator.handle,
        platform: creator.platform,
        tier: creator.tier,
        totalCommission: creator.stats.totalCommission,
        totalBookings: creator.stats.totalBookings,
        conversionRate: creator.stats.conversionRate
      }));
  }
  
  /**
   * Detect fraud
   */
  async detectFraud(affiliateBookingId) {
    const booking = this.bookings.get(affiliateBookingId);
    if (!booking) return null;
    
    let fraudScore = 0;
    const flags = [];
    
    // Check for multiple bookings from same customer
    const customerBookings = Array.from(this.bookings.values())
      .filter(b => b.customerId === booking.customerId && b.creatorId === booking.creatorId);
    
    if (customerBookings.length > 3) {
      fraudScore += 30;
      flags.push('Multiple bookings from same customer');
    }
    
    // Check for unusually high conversion rate
    const creator = this.creators.get(booking.creatorId);
    if (creator && creator.stats.conversionRate > 10) {
      fraudScore += 25;
      flags.push('Unusually high conversion rate');
    }
    
    // Check for same IP bookings
    const click = this.clicks.get(booking.clickId);
    if (click) {
      const sameIpBookings = Array.from(this.bookings.values())
        .filter(b => {
          const c = this.clicks.get(b.clickId);
          return c && c.ipAddress === click.ipAddress && b.creatorId === booking.creatorId;
        });
      
      if (sameIpBookings.length > 2) {
        fraudScore += 40;
        flags.push('Multiple bookings from same IP');
      }
    }
    
    booking.fraudScore = fraudScore;
    booking.flagged = fraudScore >= 50;
    booking.flagReason = flags.join(', ');
    
    return booking;
  }
}

module.exports = {
  COMMISSION_RATES,
  INFLUENCER_TIERS,
  Creator,
  CreatorSchema,
  AffiliateClick,
  AffiliateClickSchema,
  AffiliateBooking,
  AffiliateBookingSchema,
  PayoutRecordSchema,
  AffiliateRepository
};