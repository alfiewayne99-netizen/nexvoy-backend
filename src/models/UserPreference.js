/**
 * UserPreference Model
 * Mongoose schema for storing user preferences and learning
 */

const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Flight preferences
  preferredAirlines: [{
    type: String,
    trim: true
  }],
  seatPreference: {
    type: String,
    enum: ['window', 'aisle', 'middle', null],
    default: null
  },
  cabinClass: {
    type: String,
    enum: ['economy', 'premium_economy', 'business', 'first', null],
    default: null
  },
  maxLayover: {
    type: Number, // in hours
    default: null
  },
  directFlightsOnly: {
    type: Boolean,
    default: false
  },
  
  // Hotel preferences
  preferredHotelChains: [{
    type: String,
    trim: true
  }],
  roomType: {
    type: String,
    enum: ['standard', 'deluxe', 'suite', 'villa', null],
    default: null
  },
  hotelAmenities: [{
    type: String,
    enum: ['wifi', 'breakfast', 'pool', 'gym', 'spa', 'parking', 'pet_friendly', 'airport_shuttle']
  }],
  minHotelRating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  
  // Car rental preferences
  preferredCarTypes: [{
    type: String,
    enum: ['economy', 'compact', 'mid_size', 'full_size', 'suv', 'luxury', 'van']
  }],
  transmission: {
    type: String,
    enum: ['automatic', 'manual', null],
    default: 'automatic'
  },
  
  // General travel preferences
  budgetRange: {
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    currency: { type: String, default: 'USD' }
  },
  travelStyle: {
    type: String,
    enum: ['luxury', 'budget', 'business', 'family', 'adventure', 'relaxation', null],
    default: null
  },
  dietaryRestrictions: [{
    type: String,
    enum: ['vegetarian', 'vegan', 'gluten_free', 'halal', 'kosher', 'allergies']
  }],
  accessibilityNeeds: [{
    type: String,
    enum: ['wheelchair', 'mobility_aid', 'visual_impairment', 'hearing_impairment']
  }],
  
  // Learning from behavior
  pastDestinations: [{
    destination: String,
    visitCount: { type: Number, default: 1 },
    lastVisited: Date,
    rating: { type: Number, min: 1, max: 5 }
  }],
  
  // Booking patterns
  bookingPatterns: {
    avgAdvanceBookingDays: { type: Number, default: null },
    preferredBookingTime: { type: String, enum: ['morning', 'afternoon', 'evening', 'night', null], default: null },
    tripDurationPreference: {
      min: { type: Number, default: null },
      max: { type: Number, default: null }
    },
    weekendTraveler: { type: Boolean, default: null }
  },
  
  // Notification preferences
  notifications: {
    priceAlerts: { type: Boolean, default: true },
    dealAlerts: { type: Boolean, default: true },
    bookingReminders: { type: Boolean, default: true },
    emailFrequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'never'], default: 'weekly' }
  },
  
  // Communication preferences
  communicationStyle: {
    type: String,
    enum: ['concise', 'detailed', 'casual', 'formal'],
    default: 'detailed'
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Learning metadata
  searchCount: { type: Number, default: 0 },
  bookingCount: { type: Number, default: 0 },
  lastInteraction: { type: Date, default: null }
}, {
  timestamps: true
});

// Indexes for common queries
userPreferenceSchema.index({ userId: 1 });
userPreferenceSchema.index({ 'pastDestinations.destination': 1 });
userPreferenceSchema.index({ updatedAt: -1 });

/**
 * Update preferences from a booking
 * @param {Object} bookingData 
 */
userPreferenceSchema.methods.updateFromBooking = async function(bookingData) {
  // Update booking count
  this.bookingCount += 1;
  this.lastInteraction = new Date();
  
  // Update destination history
  if (bookingData.destination) {
    const existingDest = this.pastDestinations.find(
      d => d.destination.toLowerCase() === bookingData.destination.toLowerCase()
    );
    
    if (existingDest) {
      existingDest.visitCount += 1;
      existingDest.lastVisited = new Date();
    } else {
      this.pastDestinations.push({
        destination: bookingData.destination,
        visitCount: 1,
        lastVisited: new Date()
      });
    }
  }
  
  // Learn from booking patterns
  if (bookingData.advanceBookingDays) {
    const current = this.bookingPatterns.avgAdvanceBookingDays;
    const newValue = bookingData.advanceBookingDays;
    this.bookingPatterns.avgAdvanceBookingDays = current 
      ? Math.round((current + newValue) / 2)
      : newValue;
  }
  
  await this.save();
};

/**
 * Update preferences from a search
 * @param {Object} searchData 
 */
userPreferenceSchema.methods.updateFromSearch = async function(searchData) {
  this.searchCount += 1;
  this.lastInteraction = new Date();
  
  // Infer preferences from search
  if (searchData.cabinClass && !this.cabinClass) {
    this.cabinClass = searchData.cabinClass;
  }
  
  if (searchData.airline && !this.preferredAirlines.includes(searchData.airline)) {
    this.preferredAirlines.push(searchData.airline);
  }
  
  if (searchData.hotelChain && !this.preferredHotelChains.includes(searchData.hotelChain)) {
    this.preferredHotelChains.push(searchData.hotelChain);
  }
  
  await this.save();
};

/**
 * Get personalized recommendations
 * @returns {Object}
 */
userPreferenceSchema.methods.getRecommendations = function() {
  const recommendations = {
    destinations: [],
    airlines: this.preferredAirlines,
    hotelChains: this.preferredHotelChains,
    travelStyle: this.travelStyle
  };
  
  // Suggest destinations based on past visits
  if (this.pastDestinations.length > 0) {
    // Sort by visit count and rating
    const sorted = [...this.pastDestinations]
      .sort((a, b) => (b.visitCount + (b.rating || 0)) - (a.visitCount + (a.rating || 0)))
      .slice(0, 3);
    
    recommendations.destinations = sorted.map(d => ({
      destination: d.destination,
      reason: `You've visited ${d.visitCount} time${d.visitCount > 1 ? 's' : ''}`
    }));
  }
  
  return recommendations;
};

/**
 * Get preference summary for AI context
 * @returns {Object}
 */
userPreferenceSchema.methods.toAIContext = function() {
  return {
    preferredAirlines: this.preferredAirlines,
    seatPreference: this.seatPreference,
    hotelChains: this.preferredHotelChains,
    maxLayover: this.maxLayover,
    budgetRange: this.budgetRange,
    travelStyle: this.travelStyle,
    dietaryRestrictions: this.dietaryRestrictions,
    accessibilityNeeds: this.accessibilityNeeds,
    pastDestinations: this.pastDestinations.map(d => d.destination),
    communicationStyle: this.communicationStyle
  };
};

// Static method to create or update preferences
userPreferenceSchema.statics.upsert = async function(userId, updates) {
  return this.findOneAndUpdate(
    { userId },
    { ...updates, updatedAt: new Date() },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('UserPreference', userPreferenceSchema);
