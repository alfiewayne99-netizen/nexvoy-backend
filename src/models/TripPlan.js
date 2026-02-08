const mongoose = require('mongoose');

/**
 * TripPlan Schema
 * Stores AI-generated trip plans
 */
const tripPlanSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // Plan metadata
  name: {
    type: String,
    required: true
  },
  description: String,
  
  // Trip parameters
  parameters: {
    origin: String,
    destinations: [{
      city: String,
      country: String,
      duration: Number, // days
      order: Number
    }],
    startDate: Date,
    endDate: Date,
    duration: Number, // total days
    travelers: {
      adults: { type: Number, default: 1 },
      children: { type: Number, default: 0 },
      infants: { type: Number, default: 0 }
    },
    budget: {
      total: Number,
      currency: { type: String, default: 'USD' },
      breakdown: {
        flights: Number,
        accommodation: Number,
        activities: Number,
        food: Number,
        transport: Number,
        miscellaneous: Number
      }
    },
    tripType: {
      type: String,
      enum: ['leisure', 'business', 'bleisure', 'adventure', 'family', 'romantic', 'solo']
    },
    preferences: {
      pace: { type: String, enum: ['relaxed', 'moderate', 'fast'], default: 'moderate' },
      interests: [String],
      accommodationType: [String],
      dietaryRestrictions: [String],
      accessibilityNeeds: [String]
    }
  },
  
  // Daily itinerary
  itinerary: [{
    day: Number,
    date: Date,
    destination: String,
    
    // Day overview
    summary: String,
    highlights: [String],
    
    // Activities
    activities: [{
      time: String,
      title: String,
      description: String,
      type: { type: String, enum: ['flight', 'transport', 'accommodation', 'sightseeing', 
                                     'dining', 'activity', 'relaxation', 'business', 'free_time'] },
      duration: String,
      cost: {
        amount: Number,
        currency: { type: String, default: 'USD' }
      },
      bookingRequired: { type: Boolean, default: false },
      bookingUrl: String,
      location: {
        name: String,
        address: String,
        coordinates: {
          lat: Number,
          lng: Number
        }
      },
      tips: String,
      alternatives: [{
        title: String,
        reason: String
      }]
    }],
    
    // Day totals
    estimatedCost: {
      amount: Number,
      currency: { type: String, default: 'USD' }
    },
    
    // Meals
    meals: {
      breakfast: { included: Boolean, recommendation: String },
      lunch: { included: Boolean, recommendation: String },
      dinner: { included: Boolean, recommendation: String }
    },
    
    // Transport for the day
    transport: [{
      mode: { type: String, enum: ['flight', 'train', 'bus', 'car', 'taxi', 'walk', 'ferry'] },
      from: String,
      to: String,
      duration: String,
      cost: Number,
      bookingReference: String
    }]
  }],
  
  // Booking links
  bookings: {
    flights: [{
      segment: String,
      provider: String,
      url: String,
      estimatedPrice: Number
    }],
    hotels: [{
      name: String,
      location: String,
      provider: String,
      url: String,
      estimatedPrice: Number
    }],
    activities: [{
      name: String,
      provider: String,
      url: String,
      estimatedPrice: Number
    }]
  },
  
  // AI insights
  insights: {
    bestTimeToVisit: String,
    weatherExpectations: String,
    culturalTips: [String],
    moneySavingTips: [String],
    packingSuggestions: [String],
    localCustoms: [String],
    emergencyContacts: [{
      name: String,
      number: String
    }]
  },
  
  // Status and versioning
  status: {
    type: String,
    enum: ['draft', 'active', 'booked', 'completed', 'archived'],
    default: 'draft'
  },
  version: { type: Number, default: 1 },
  parentPlanId: { type: String, default: null }, // for forked plans
  
  // User feedback
  rating: { type: Number, min: 1, max: 5 },
  feedback: String,
  
  // Sharing
  isPublic: { type: Boolean, default: false },
  shareUrl: String,
  forks: [{ type: String }], // userIds who forked
  
  // AI metadata
  aiMetadata: {
    model: String,
    generatedAt: { type: Date, default: Date.now },
    confidence: Number,
    personalizationScore: Number
  }
}, {
  timestamps: true
});

// Indexes
tripPlanSchema.index({ userId: 1, status: 1 });
tripPlanSchema.index({ userId: 1, createdAt: -1 });
tripPlanSchema.index({ 'parameters.destinations.city': 1 });
tripPlanSchema.index({ isPublic: 1, rating: -1 });

// Instance methods
tripPlanSchema.methods.fork = function(newUserId, newName) {
  const forked = new this.constructor({
    ...this.toObject(),
    _id: new mongoose.Types.ObjectId(),
    userId: newUserId,
    name: newName || `${this.name} (Copy)`,
    status: 'draft',
    parentPlanId: this._id.toString(),
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  // Clear user-specific data
  forked.rating = undefined;
  forked.feedback = undefined;
  forked.forks = [];
  
  return forked;
};

tripPlanSchema.methods.calculateTotalCost = function() {
  return this.itinerary.reduce((total, day) => {
    return total + (day.estimatedCost?.amount || 0);
  }, 0);
};

tripPlanSchema.methods.getDayByDate = function(date) {
  const targetDate = new Date(date);
  return this.itinerary.find(day => {
    const dayDate = new Date(day.date);
    return dayDate.toDateString() === targetDate.toDateString();
  });
};

// Static methods
tripPlanSchema.statics.findByDestination = function(destination) {
  return this.find({
    isPublic: true,
    'parameters.destinations.city': { $regex: new RegExp(destination, 'i') }
  }).sort({ rating: -1 }).limit(10);
};

tripPlanSchema.statics.findByBudget = function(min, max, currency = 'USD') {
  return this.find({
    isPublic: true,
    'parameters.budget.total': { $gte: min, $lte: max },
    'parameters.budget.currency': currency
  }).sort({ rating: -1 }).limit(10);
};

module.exports = mongoose.model('TripPlan', tripPlanSchema);
