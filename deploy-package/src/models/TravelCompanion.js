/**
 * TravelCompanion Model for Nexvoy
 * Manages travel companion matching, group trips, and expense splitting
 */

const crypto = require('crypto');

/**
 * User Profile for Companion Matching
 */
const TravelerProfileSchema = {
  userId: { type: String, required: true, unique: true },
  
  // Travel style
  travelStyle: {
    type: [{ type: String, enum: ['adventure', 'relaxation', 'cultural', 'foodie', 'nightlife', 'nature', 'shopping', 'budget', 'luxury', 'backpacking'] }],
    default: []
  },
  
  // Activity preferences
  activityLevel: { type: String, enum: ['relaxed', 'moderate', 'active', 'very_active'] },
  earlyRiser: { type: Boolean, default: false },
  nightOwl: { type: Boolean, default: false },
  
  // Social preferences
  socialStyle: { type: String, enum: ['introvert', 'ambivert', 'extrovert'] },
  groupSizePreference: { type: String, enum: ['solo', 'pair', 'small_group', 'large_group'] },
  
  // Accommodation preferences
  accommodationPreference: { type: String, enum: ['hostel', 'hotel', 'resort', 'airbnb', 'camping'] },
  budgetLevel: { type: String, enum: ['budget', 'moderate', 'comfortable', 'luxury'] },
  
  // Planning style
  planningStyle: { type: String, enum: ['planner', 'spontaneous', 'flexible'] },
  
  // Interests
  interests: [{ type: String }],
  languages: [{ type: String }],
  
  // Bio
  bio: { type: String, maxLength: 500 },
  homeBase: { type: String }, // City/country
  
  // Verification
  verifiedTraveler: { type: Boolean, default: false },
  verifiedAt: { type: Date },
  
  // Stats
  tripsCompleted: { type: Number, default: 0 },
  companionMatches: { type: Number, default: 0 },
  rating: { type: Number, default: 5, min: 1, max: 5 },
  reviewCount: { type: Number, default: 0 },
  
  // Availability
  availableFrom: { type: Date },
  availableTo: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
};

/**
 * Trip/Meetup Posting
 */
const TripPostSchema = {
  id: { type: String, required: true, unique: true },
  creatorId: { type: String, required: true, index: true },
  
  // Trip details
  type: { type: String, enum: ['companion_search', 'meetup', 'group_trip'], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  
  // Destination
  destination: {
    country: { type: String, required: true },
    city: { type: String },
    specificLocation: { type: String }
  },
  
  // Dates
  startDate: { type: Date },
  endDate: { type: Date },
  flexibleDates: { type: Boolean, default: false },
  
  // Group details
  maxCompanions: { type: Number, default: 1 },
  currentCompanions: { type: Number, default: 0 },
  companions: [{ 
    userId: { type: String },
    joinedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
  }],
  
  // Preferences
  genderPreference: { type: String, enum: ['any', 'same_gender', 'male_only', 'female_only'] },
  ageRange: {
    min: { type: Number },
    max: { type: Number }
  },
  
  // Budget
  budgetEstimate: {
    currency: { type: String, default: 'USD' },
    min: { type: Number },
    max: { type: Number }
  },
  costSharing: { type: Boolean, default: true },
  
  // Status
  status: { type: String, enum: ['open', 'filled', 'cancelled', 'completed'], default: 'open' },
  
  // Applications
  applications: [{
    userId: { type: String },
    message: { type: String },
    appliedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
};

/**
 * Expense for Splitting
 */
const ExpenseSchema = {
  id: { type: String, required: true, unique: true },
  tripId: { type: String, required: true, index: true },
  
  // Expense details
  description: { type: String, required: true },
  category: { type: String, enum: ['accommodation', 'food', 'transport', 'activities', 'shopping', 'other'] },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  
  // Who paid
  paidBy: { type: String, required: true }, // userId
  paidAt: { type: Date, default: Date.now },
  
  // Split details
  splitType: { type: String, enum: ['equal', 'percentage', 'amount'], default: 'equal' },
  splits: [{
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    percentage: { type: Number },
    settled: { type: Boolean, default: false },
    settledAt: { type: Date }
  }],
  
  // Receipt
  receiptUrl: { type: String },
  
  createdAt: { type: Date, default: Date.now }
};

/**
 * Traveler Profile Class
 */
class TravelerProfile {
  constructor(data = {}) {
    this.userId = data.userId;
    
    this.travelStyle = data.travelStyle || [];
    this.activityLevel = data.activityLevel || 'moderate';
    this.earlyRiser = data.earlyRiser || false;
    this.nightOwl = data.nightOwl || false;
    
    this.socialStyle = data.socialStyle || 'ambivert';
    this.groupSizePreference = data.groupSizePreference || 'small_group';
    
    this.accommodationPreference = data.accommodationPreference || 'hotel';
    this.budgetLevel = data.budgetLevel || 'moderate';
    
    this.planningStyle = data.planningStyle || 'flexible';
    
    this.interests = data.interests || [];
    this.languages = data.languages || [];
    
    this.bio = data.bio || '';
    this.homeBase = data.homeBase || '';
    
    this.verifiedTraveler = data.verifiedTraveler || false;
    this.verifiedAt = data.verifiedAt ? new Date(data.verifiedAt) : null;
    
    this.tripsCompleted = data.tripsCompleted || 0;
    this.companionMatches = data.companionMatches || 0;
    this.rating = data.rating || 5;
    this.reviewCount = data.reviewCount || 0;
    
    this.availableFrom = data.availableFrom ? new Date(data.availableFrom) : null;
    this.availableTo = data.availableTo ? new Date(data.availableTo) : null;
    
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }
  
  /**
   * Calculate compatibility score with another profile
   */
  calculateCompatibility(other) {
    let score = 0;
    let maxScore = 0;
    
    // Travel style overlap (max 30 points)
    const styleOverlap = this.travelStyle.filter(s => other.travelStyle.includes(s)).length;
    score += (styleOverlap / Math.max(this.travelStyle.length, other.travelStyle.length, 1)) * 30;
    maxScore += 30;
    
    // Activity level (max 15 points)
    const activityDiff = Math.abs(
      ['relaxed', 'moderate', 'active', 'very_active'].indexOf(this.activityLevel) -
      ['relaxed', 'moderate', 'active', 'very_active'].indexOf(other.activityLevel)
    );
    score += (3 - activityDiff) / 3 * 15;
    maxScore += 15;
    
    // Social style (max 15 points)
    const socialDiff = Math.abs(
      ['introvert', 'ambivert', 'extrovert'].indexOf(this.socialStyle) -
      ['introvert', 'ambivert', 'extrovert'].indexOf(other.socialStyle)
    );
    score += (2 - socialDiff) / 2 * 15;
    maxScore += 15;
    
    // Budget level match (max 20 points)
    const budgetDiff = Math.abs(
      ['budget', 'moderate', 'comfortable', 'luxury'].indexOf(this.budgetLevel) -
      ['budget', 'moderate', 'comfortable', 'luxury'].indexOf(other.budgetLevel)
    );
    score += (3 - budgetDiff) / 3 * 20;
    maxScore += 20;
    
    // Planning style (max 10 points)
    if (this.planningStyle === other.planningStyle) score += 10;
    maxScore += 10;
    
    // Interests overlap (max 10 points)
    const interestOverlap = this.interests.filter(i => other.interests.includes(i)).length;
    score += (interestOverlap / Math.max(this.interests.length, other.interests.length, 1)) * 10;
    maxScore += 10;
    
    return Math.round((score / maxScore) * 100);
  }
  
  /**
   * Mark as verified traveler
   */
  verify() {
    this.verifiedTraveler = true;
    this.verifiedAt = new Date();
    this.updatedAt = new Date();
  }
  
  toJSON() {
    return {
      userId: this.userId,
      travelStyle: this.travelStyle,
      activityLevel: this.activityLevel,
      earlyRiser: this.earlyRiser,
      nightOwl: this.nightOwl,
      socialStyle: this.socialStyle,
      groupSizePreference: this.groupSizePreference,
      accommodationPreference: this.accommodationPreference,
      budgetLevel: this.budgetLevel,
      planningStyle: this.planningStyle,
      interests: this.interests,
      languages: this.languages,
      bio: this.bio,
      homeBase: this.homeBase,
      verifiedTraveler: this.verifiedTraveler,
      verifiedAt: this.verifiedAt,
      tripsCompleted: this.tripsCompleted,
      companionMatches: this.companionMatches,
      rating: this.rating,
      reviewCount: this.reviewCount,
      availableFrom: this.availableFrom,
      availableTo: this.availableTo,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Trip Posting Class
 */
class TripPost {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.creatorId = data.creatorId;
    
    this.type = data.type;
    this.title = data.title;
    this.description = data.description;
    
    this.destination = {
      country: data.destination?.country,
      city: data.destination?.city,
      specificLocation: data.destination?.specificLocation
    };
    
    this.startDate = data.startDate ? new Date(data.startDate) : null;
    this.endDate = data.endDate ? new Date(data.endDate) : null;
    this.flexibleDates = data.flexibleDates || false;
    
    this.maxCompanions = data.maxCompanions || 1;
    this.currentCompanions = data.currentCompanions || 0;
    this.companions = data.companions || [];
    
    this.genderPreference = data.genderPreference || 'any';
    this.ageRange = data.ageRange || {};
    
    this.budgetEstimate = data.budgetEstimate || { currency: 'USD' };
    this.costSharing = data.costSharing !== false;
    
    this.status = data.status || 'open';
    this.applications = data.applications || [];
    
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }
  
  /**
   * Apply to join trip
   */
  apply(userId, message) {
    // Check if already applied
    const existing = this.applications.find(a => a.userId === userId);
    if (existing) {
      throw new Error('Already applied to this trip');
    }
    
    this.applications.push({
      userId,
      message,
      appliedAt: new Date(),
      status: 'pending'
    });
    
    this.updatedAt = new Date();
  }
  
  /**
   * Accept application
   */
  acceptApplication(userId) {
    const application = this.applications.find(a => a.userId === userId);
    if (!application) throw new Error('Application not found');
    
    application.status = 'accepted';
    
    this.companions.push({
      userId,
      joinedAt: new Date(),
      status: 'approved'
    });
    
    this.currentCompanions++;
    
    if (this.currentCompanions >= this.maxCompanions) {
      this.status = 'filled';
    }
    
    this.updatedAt = new Date();
  }
  
  /**
   * Decline application
   */
  declineApplication(userId) {
    const application = this.applications.find(a => a.userId === userId);
    if (!application) throw new Error('Application not found');
    
    application.status = 'declined';
    this.updatedAt = new Date();
  }
  
  toJSON() {
    return {
      id: this.id,
      creatorId: this.creatorId,
      type: this.type,
      title: this.title,
      description: this.description,
      destination: this.destination,
      startDate: this.startDate,
      endDate: this.endDate,
      flexibleDates: this.flexibleDates,
      maxCompanions: this.maxCompanions,
      currentCompanions: this.currentCompanions,
      companions: this.companions,
      genderPreference: this.genderPreference,
      ageRange: this.ageRange,
      budgetEstimate: this.budgetEstimate,
      costSharing: this.costSharing,
      status: this.status,
      applicationCount: this.applications.length,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Expense Class
 */
class Expense {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.tripId = data.tripId;
    
    this.description = data.description;
    this.category = data.category;
    this.amount = data.amount;
    this.currency = data.currency || 'USD';
    
    this.paidBy = data.paidBy;
    this.paidAt = data.paidAt ? new Date(data.paidAt) : new Date();
    
    this.splitType = data.splitType || 'equal';
    this.splits = data.splits || [];
    
    this.receiptUrl = data.receiptUrl || null;
    
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
  }
  
  /**
   * Calculate equal splits
   */
  calculateEqualSplits(userIds) {
    const splitAmount = this.amount / userIds.length;
    this.splits = userIds.map(userId => ({
      userId,
      amount: parseFloat(splitAmount.toFixed(2)),
      settled: userId === this.paidBy, // Auto-settle for payer
      settledAt: userId === this.paidBy ? new Date() : null
    }));
  }
  
  /**
   * Mark split as settled
   */
  settle(userId) {
    const split = this.splits.find(s => s.userId === userId);
    if (split) {
      split.settled = true;
      split.settledAt = new Date();
    }
  }
  
  /**
   * Get unsettled amount
   */
  getUnsettledAmount() {
    return this.splits
      .filter(s => !s.settled)
      .reduce((sum, s) => sum + s.amount, 0);
  }
  
  toJSON() {
    return {
      id: this.id,
      tripId: this.tripId,
      description: this.description,
      category: this.category,
      amount: this.amount,
      currency: this.currency,
      paidBy: this.paidBy,
      paidAt: this.paidAt,
      splitType: this.splitType,
      splits: this.splits,
      receiptUrl: this.receiptUrl,
      createdAt: this.createdAt,
      settledAmount: this.amount - this.getUnsettledAmount()
    };
  }
}

/**
 * Travel Companion Repository
 */
class TravelCompanionRepository {
  constructor(database = null) {
    this.db = database;
    this.profiles = new Map();
    this.tripPosts = new Map();
    this.expenses = new Map();
  }
  
  async createProfile(profileData) {
    const profile = new TravelerProfile(profileData);
    this.profiles.set(profile.userId, profile);
    
    if (this.db) {
      await this.db.collection('travelerProfiles').insertOne(profile.toJSON());
    }
    
    return profile;
  }
  
  async findProfile(userId) {
    if (this.profiles.has(userId)) {
      return this.profiles.get(userId);
    }
    
    if (this.db) {
      const data = await this.db.collection('travelerProfiles').findOne({ userId });
      if (data) {
        const profile = new TravelerProfile(data);
        this.profiles.set(userId, profile);
        return profile;
      }
    }
    
    return null;
  }
  
  async findMatches(userId, options = {}) {
    const userProfile = await this.findProfile(userId);
    if (!userProfile) return [];
    
    const { destination, limit = 10 } = options;
    
    // Get all other profiles
    const allProfiles = Array.from(this.profiles.values())
      .filter(p => p.userId !== userId)
      .filter(p => {
        // Filter by availability if provided
        if (!destination) return true;
        // Could add destination matching logic here
        return true;
      });
    
    // Calculate compatibility scores
    const matches = allProfiles.map(profile => ({
      profile: profile.toJSON(),
      compatibilityScore: userProfile.calculateCompatibility(profile)
    }));
    
    // Sort by compatibility
    matches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    
    return matches.slice(0, limit);
  }
  
  async createTripPost(postData) {
    const post = new TripPost(postData);
    this.tripPosts.set(post.id, post);
    
    if (this.db) {
      await this.db.collection('tripPosts').insertOne(post.toJSON());
    }
    
    return post;
  }
  
  async findTripPosts(options = {}) {
    const { destination, type, status = 'open', limit = 20, offset = 0 } = options;
    
    let posts = Array.from(this.tripPosts.values())
      .filter(p => !status || p.status === status);
    
    if (destination) {
      posts = posts.filter(p => 
        p.destination.country.toLowerCase().includes(destination.toLowerCase()) ||
        p.destination.city?.toLowerCase().includes(destination.toLowerCase())
      );
    }
    
    if (type) {
      posts = posts.filter(p => p.type === type);
    }
    
    posts.sort((a, b) => b.createdAt - a.createdAt);
    
    const total = posts.length;
    posts = posts.slice(offset, offset + limit);
    
    return { posts, total };
  }
  
  async findTripById(id) {
    return this.tripPosts.get(id) || null;
  }
  
  async createExpense(expenseData) {
    const expense = new Expense(expenseData);
    this.expenses.set(expense.id, expense);
    
    if (this.db) {
      await this.db.collection('expenses').insertOne(expense.toJSON());
    }
    
    return expense;
  }
  
  async findExpensesByTrip(tripId) {
    return Array.from(this.expenses.values())
      .filter(e => e.tripId === tripId);
  }
  
  async getTripBalance(tripId) {
    const expenses = await this.findExpensesByTrip(tripId);
    const balances = {};
    
    expenses.forEach(expense => {
      // Credit for payer
      if (!balances[expense.paidBy]) balances[expense.paidBy] = 0;
      balances[expense.paidBy] += expense.amount;
      
      // Debit for each participant
      expense.splits.forEach(split => {
        if (!balances[split.userId]) balances[split.userId] = 0;
        balances[split.userId] -= split.amount;
      });
    });
    
    return balances;
  }
}

module.exports = {
  TravelerProfile,
  TripPost,
  Expense,
  TravelCompanionRepository,
  TravelerProfileSchema,
  TripPostSchema,
  ExpenseSchema
};
