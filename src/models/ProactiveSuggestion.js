const mongoose = require('mongoose');

/**
 * ProactiveSuggestion Schema
 * Stores AI-generated proactive suggestions for users
 */
const proactiveSuggestionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // Suggestion type and category
  type: {
    type: String,
    required: true,
    enum: ['price_drop', 'weather_alert', 'passport_expiry', 'visa_required', 
           'deal_alert', 'seasonal_suggestion', 'rebooking_opportunity',
           'loyalty_milestone', 'travel_reminder', 'safety_alert']
  },
  
  // Priority level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Suggestion content
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  
  // Associated data
  data: {
    // For price drops
    route: {
      origin: String,
      destination: String,
      originalPrice: Number,
      currentPrice: Number,
      currency: { type: String, default: 'USD' },
      percentChange: Number
    },
    
    // For weather alerts
    weather: {
      destination: String,
      condition: String,
      temperature: Number,
      alerts: [String],
      dates: {
        start: Date,
        end: Date
      }
    },
    
    // For passport/visa
    document: {
      type: { type: String, enum: ['passport', 'visa', 'esta', 'eta'] },
      expiryDate: Date,
      daysUntilExpiry: Number,
      country: String
    },
    
    // For deals
    deal: {
      destination: String,
      discount: Number,
      validUntil: Date,
      bookingUrl: String,
      imageUrl: String
    }
  },
  
  // Action buttons
  actions: [{
    label: String,
    type: { type: String, enum: ['book', 'search', 'dismiss', 'remind_later', 'view_details'] },
    url: String,
    payload: mongoose.Schema.Types.Mixed
  }],
  
  // Timing
  triggeredAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: Date,
  
  // User interaction
  status: {
    type: String,
    enum: ['unread', 'read', 'dismissed', 'acted_upon'],
    default: 'unread'
  },
  readAt: Date,
  dismissedAt: Date,
  actedUponAt: Date,
  
  // Notification tracking
  notificationsSent: [{
    channel: { type: String, enum: ['push', 'email', 'in_app'] },
    sentAt: { type: Date, default: Date.now },
    openedAt: Date
  }],
  
  // AI generation metadata
  aiMetadata: {
    model: String,
    confidence: Number,
    reasoning: String
  }
}, {
  timestamps: true
});

// Indexes
proactiveSuggestionSchema.index({ userId: 1, status: 1 });
proactiveSuggestionSchema.index({ userId: 1, type: 1 });
proactiveSuggestionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
proactiveSuggestionSchema.index({ triggeredAt: -1 });

// Mark as read
proactiveSuggestionSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

// Mark as dismissed
proactiveSuggestionSchema.methods.dismiss = function() {
  this.status = 'dismissed';
  this.dismissedAt = new Date();
  return this.save();
};

// Mark as acted upon
proactiveSuggestionSchema.methods.markActedUpon = function() {
  this.status = 'acted_upon';
  this.actedUponAt = new Date();
  return this.save();
};

// Static methods
proactiveSuggestionSchema.statics.getUnreadForUser = function(userId, limit = 10) {
  return this.find({ 
    userId, 
    status: { $in: ['unread', 'read'] },
    expiresAt: { $gt: new Date() }
  })
  .sort({ priority: -1, triggeredAt: -1 })
  .limit(limit);
};

proactiveSuggestionSchema.statics.getHighPriority = function(userId) {
  return this.find({
    userId,
    status: 'unread',
    priority: { $in: ['high', 'urgent'] },
    expiresAt: { $gt: new Date() }
  }).sort({ triggeredAt: -1 });
};

module.exports = mongoose.model('ProactiveSuggestion', proactiveSuggestionSchema);
