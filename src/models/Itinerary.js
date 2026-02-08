/**
 * Itinerary Model for Nexvoy
 * Handles trip itinerary data
 */

const crypto = require('crypto');

/**
 * Itinerary Status Enum
 */
const ItineraryStatus = {
  DRAFT: 'draft',
  PLANNED: 'planned',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

/**
 * Activity Type Enum
 */
const ActivityType = {
  FLIGHT: 'flight',
  HOTEL: 'hotel',
  TRANSPORT: 'transport',
  ATTRACTION: 'attraction',
  RESTAURANT: 'restaurant',
  ACTIVITY: 'activity',
  MEETING: 'meeting',
  FREE_TIME: 'free_time',
  NOTE: 'note'
};

/**
 * Itinerary Schema Definition
 */
const ItinerarySchema = {
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  
  // Basic info
  title: { type: String, required: true },
  description: { type: String },
  destination: { type: String, required: true },
  destinationCode: { type: String },
  
  // Trip dates
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  duration: { type: Number }, // calculated
  
  // Status
  status: { 
    type: String, 
    required: true,
    enum: Object.values(ItineraryStatus),
    default: ItineraryStatus.DRAFT
  },
  
  // Cover image
  coverImage: { type: String },
  
  // Travelers
  travelers: [{
    name: { type: String },
    email: { type: String },
    type: { type: String, enum: ['adult', 'child', 'senior'] },
    preferences: { type: Object }
  }],
  
  // Daily planning
  days: [{
    dayNumber: { type: Number, required: true },
    date: { type: Date, required: true },
    title: { type: String },
    notes: { type: String },
    activities: [{
      id: { type: String, required: true },
      type: { 
        type: String, 
        required: true,
        enum: Object.values(ActivityType)
      },
      title: { type: String, required: true },
      description: { type: String },
      
      // Timing
      startTime: { type: String }, // HH:mm format
      endTime: { type: String },
      duration: { type: Number }, // in minutes
      
      // Location
      location: {
        name: { type: String },
        address: { type: String },
        latitude: { type: Number },
        longitude: { type: Number },
        placeId: { type: String }
      },
      
      // Booking info
      booking: {
        bookingId: { type: String },
        confirmationNumber: { type: String },
        provider: { type: String },
        price: { type: Number },
        currency: { type: String },
        status: { type: String }
      },
      
      // Additional details
      images: [{ type: String }],
      notes: { type: String },
      tags: [{ type: String }],
      
      // Metadata
      createdAt: { type: Date, default: Date.now }
    }]
  }],
  
  // Budget tracking
  budget: {
    total: { type: Number },
    currency: { type: String, default: 'USD' },
    categories: {
      accommodation: { type: Number, default: 0 },
      transportation: { type: Number, default: 0 },
      food: { type: Number, default: 0 },
      activities: { type: Number, default: 0 },
      shopping: { type: Number, default: 0 },
      other: { type: Number, default: 0 }
    },
    spent: { type: Number, default: 0 }
  },
  
  // Bookings linked to this itinerary
  bookings: [{
    bookingId: { type: String },
    type: { type: String },
    reference: { type: String }
  }],
  
  // Sharing
  isPublic: { type: Boolean, default: false },
  shareLink: { type: String },
  sharePassword: { type: String },
  sharedWith: [{
    email: { type: String },
    permission: { type: String, enum: ['view', 'edit'] },
    sharedAt: { type: Date }
  }],
  
  // AI suggestions
  aiSuggestions: [{
    type: { type: String },
    title: { type: String },
    description: { type: String },
    dayNumber: { type: Number },
    applied: { type: Boolean, default: false }
  }],
  
  // Metadata
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  lastViewedAt: { type: Date },
  viewCount: { type: Number, default: 0 }
};

/**
 * Itinerary Model Class
 */
class Itinerary {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.userId = data.userId;
    
    this.title = data.title;
    this.description = data.description || '';
    this.destination = data.destination;
    this.destinationCode = data.destinationCode;
    
    this.startDate = data.startDate ? new Date(data.startDate) : null;
    this.endDate = data.endDate ? new Date(data.endDate) : null;
    this.duration = this.calculateDuration();
    
    this.status = data.status || ItineraryStatus.DRAFT;
    this.coverImage = data.coverImage || null;
    
    this.travelers = data.travelers || [];
    this.days = this.initializeDays(data.days || []);
    
    this.budget = {
      total: 0,
      currency: 'USD',
      categories: {
        accommodation: 0,
        transportation: 0,
        food: 0,
        activities: 0,
        shopping: 0,
        other: 0
      },
      spent: 0,
      ...data.budget
    };
    
    this.bookings = data.bookings || [];
    
    this.isPublic = data.isPublic || false;
    this.shareLink = data.shareLink || null;
    this.sharePassword = data.sharePassword || null;
    this.sharedWith = data.sharedWith || [];
    
    this.aiSuggestions = data.aiSuggestions || [];
    
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    this.lastViewedAt = data.lastViewedAt ? new Date(data.lastViewedAt) : null;
    this.viewCount = data.viewCount || 0;
  }
  
  /**
   * Calculate trip duration in days
   */
  calculateDuration() {
    if (!this.startDate || !this.endDate) return 0;
    const diffTime = Math.abs(this.endDate - this.startDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }
  
  /**
   * Initialize days array
   */
  initializeDays(daysData) {
    if (daysData.length > 0) return daysData;
    
    // Auto-generate days if not provided
    if (this.duration > 0) {
      const days = [];
      for (let i = 0; i < this.duration; i++) {
        const date = new Date(this.startDate);
        date.setDate(date.getDate() + i);
        days.push({
          dayNumber: i + 1,
          date: date,
          title: `Day ${i + 1}`,
          notes: '',
          activities: []
        });
      }
      return days;
    }
    return [];
  }
  
  /**
   * Add activity to a day
   */
  addActivity(dayNumber, activityData) {
    const day = this.days.find(d => d.dayNumber === dayNumber);
    if (!day) throw new Error(`Day ${dayNumber} not found`);
    
    const activity = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      ...activityData
    };
    
    day.activities.push(activity);
    day.activities.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    
    this.updateBudget();
    this.updatedAt = new Date();
    
    return activity;
  }
  
  /**
   * Remove activity
   */
  removeActivity(dayNumber, activityId) {
    const day = this.days.find(d => d.dayNumber === dayNumber);
    if (!day) return false;
    
    day.activities = day.activities.filter(a => a.id !== activityId);
    this.updateBudget();
    this.updatedAt = new Date();
    
    return true;
  }
  
  /**
   * Move activity between days
   */
  moveActivity(activityId, fromDay, toDay) {
    const sourceDay = this.days.find(d => d.dayNumber === fromDay);
    const targetDay = this.days.find(d => d.dayNumber === toDay);
    
    if (!sourceDay || !targetDay) return false;
    
    const activityIndex = sourceDay.activities.findIndex(a => a.id === activityId);
    if (activityIndex === -1) return false;
    
    const activity = sourceDay.activities.splice(activityIndex, 1)[0];
    targetDay.activities.push(activity);
    targetDay.activities.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    
    this.updatedAt = new Date();
    return true;
  }
  
  /**
   * Reorder activities within a day
   */
  reorderActivities(dayNumber, newOrder) {
    const day = this.days.find(d => d.dayNumber === dayNumber);
    if (!day) return false;
    
    const activitiesMap = new Map(day.activities.map(a => [a.id, a]));
    day.activities = newOrder.map(id => activitiesMap.get(id)).filter(Boolean);
    
    this.updatedAt = new Date();
    return true;
  }
  
  /**
   * Update budget based on activities
   */
  updateBudget() {
    let totalSpent = 0;
    const categories = {
      accommodation: 0,
      transportation: 0,
      food: 0,
      activities: 0,
      shopping: 0,
      other: 0
    };
    
    this.days.forEach(day => {
      day.activities.forEach(activity => {
        if (activity.booking?.price) {
          totalSpent += activity.booking.price;
          
          // Categorize spending
          switch (activity.type) {
            case 'hotel':
              categories.accommodation += activity.booking.price;
              break;
            case 'flight':
            case 'transport':
              categories.transportation += activity.booking.price;
              break;
            case 'restaurant':
              categories.food += activity.booking.price;
              break;
            case 'attraction':
            case 'activity':
              categories.activities += activity.booking.price;
              break;
            default:
              categories.other += activity.booking.price;
          }
        }
      });
    });
    
    this.budget.spent = totalSpent;
    this.budget.categories = categories;
  }
  
  /**
   * Generate share link
   */
  generateShareLink() {
    const baseUrl = process.env.FRONTEND_URL || 'https://nexvoy.com';
    this.shareLink = `${baseUrl}/itineraries/share/${this.id}`;
    this.isPublic = true;
    return this.shareLink;
  }
  
  /**
   * Add traveler
   */
  addTraveler(travelerData) {
    this.travelers.push({
      ...travelerData,
      preferences: travelerData.preferences || {}
    });
    this.updatedAt = new Date();
  }
  
  /**
   * Add AI suggestion
   */
  addSuggestion(suggestion) {
    this.aiSuggestions.push({
      ...suggestion,
      applied: false
    });
  }
  
  /**
   * Apply AI suggestion
   */
  applySuggestion(suggestionIndex) {
    if (this.aiSuggestions[suggestionIndex]) {
      this.aiSuggestions[suggestionIndex].applied = true;
      this.updatedAt = new Date();
    }
  }
  
  /**
   * Record view
   */
  recordView() {
    this.viewCount++;
    this.lastViewedAt = new Date();
  }
  
  /**
   * Get summary
   */
  getSummary() {
    const totalActivities = this.days.reduce((sum, day) => sum + day.activities.length, 0);
    const bookedActivities = this.days.reduce((sum, day) => 
      sum + day.activities.filter(a => a.booking?.status === 'confirmed').length, 0
    );
    
    return {
      id: this.id,
      title: this.title,
      destination: this.destination,
      startDate: this.startDate,
      endDate: this.endDate,
      duration: this.duration,
      status: this.status,
      coverImage: this.coverImage,
      totalActivities,
      bookedActivities,
      budgetSpent: this.budget.spent,
      budgetTotal: this.budget.total,
      currency: this.budget.currency,
      createdAt: this.createdAt,
      isPublic: this.isPublic
    };
  }
  
  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title,
      description: this.description,
      destination: this.destination,
      destinationCode: this.destinationCode,
      startDate: this.startDate,
      endDate: this.endDate,
      duration: this.duration,
      status: this.status,
      coverImage: this.coverImage,
      travelers: this.travelers,
      days: this.days,
      budget: this.budget,
      bookings: this.bookings,
      isPublic: this.isPublic,
      shareLink: this.shareLink,
      sharePassword: this.sharePassword,
      sharedWith: this.sharedWith,
      aiSuggestions: this.aiSuggestions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastViewedAt: this.lastViewedAt,
      viewCount: this.viewCount
    };
  }
}

/**
 * Itinerary Repository
 */
class ItineraryRepository {
  constructor(database = null) {
    this.db = database;
    this.itineraries = new Map();
    this.itinerariesByUser = new Map();
  }
  
  async create(itineraryData) {
    const itinerary = new Itinerary(itineraryData);
    
    this.itineraries.set(itinerary.id, itinerary);
    
    if (!this.itinerariesByUser.has(itinerary.userId)) {
      this.itinerariesByUser.set(itinerary.userId, new Set());
    }
    this.itinerariesByUser.get(itinerary.userId).add(itinerary.id);
    
    if (this.db) {
      try {
        await this.db.collection('itineraries').insertOne(itinerary.toJSON());
      } catch (error) {
        console.error('Failed to store itinerary in MongoDB:', error);
      }
    }
    
    return itinerary;
  }
  
  async findById(id) {
    if (this.itineraries.has(id)) {
      return this.itineraries.get(id);
    }
    
    if (this.db) {
      const data = await this.db.collection('itineraries').findOne({ id });
      if (data) return new Itinerary(data);
    }
    
    return null;
  }
  
  async findByUser(userId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;
    
    const itineraryIds = this.itinerariesByUser.get(userId);
    if (!itineraryIds) return [];
    
    let itineraries = Array.from(itineraryIds)
      .map(id => this.itineraries.get(id))
      .filter(i => i !== undefined);
    
    if (status) {
      itineraries = itineraries.filter(i => i.status === status);
    }
    
    itineraries.sort((a, b) => b.updatedAt - a.updatedAt);
    
    return itineraries.slice(offset, offset + limit);
  }
  
  async update(id, updates) {
    const itinerary = await this.findById(id);
    if (!itinerary) return null;
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'userId') {
        itinerary[key] = updates[key];
      }
    });
    
    itinerary.updatedAt = new Date();
    
    if (this.db) {
      await this.db.collection('itineraries').updateOne(
        { id },
        { $set: updates, $currentDate: { updatedAt: true } }
      );
    }
    
    return itinerary;
  }
  
  async delete(id) {
    const itinerary = this.itineraries.get(id);
    if (itinerary) {
      this.itineraries.delete(id);
      this.itinerariesByUser.get(itinerary.userId)?.delete(id);
      
      if (this.db) {
        await this.db.collection('itineraries').deleteOne({ id });
      }
    }
    return true;
  }
}

module.exports = {
  Itinerary,
  ItineraryRepository,
  ItinerarySchema,
  ItineraryStatus,
  ActivityType
};
