/**
 * Price Alert Model
 * Handles price alert data and tracking
 */

const crypto = require('crypto');

/**
 * Alert Status Enum
 */
const AlertStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  TRIGGERED: 'triggered',
  EXPIRED: 'expired',
  DELETED: 'deleted'
};

/**
 * Alert Type Enum
 */
const AlertType = {
  FLIGHT: 'flight',
  HOTEL: 'hotel',
  CAR: 'car',
  PACKAGE: 'package'
};

/**
 * Price Alert Schema Definition
 */
const PriceAlertSchema = {
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  
  // Alert type
  type: { 
    type: String, 
    required: true,
    enum: Object.values(AlertType),
    index: true 
  },
  
  // Route/Destination details
  origin: { type: String, required: true, index: true },
  originCode: { type: String },
  destination: { type: String, required: true, index: true },
  destinationCode: { type: String },
  
  // Dates
  departureDate: { type: Date, required: true },
  returnDate: { type: Date },
  flexibleDates: { type: Boolean, default: false },
  dateFlexibility: { type: Number, default: 3 }, // +/- days
  
  // Passengers
  adults: { type: Number, default: 1 },
  children: { type: Number, default: 0 },
  infants: { type: Number, default: 0 },
  
  // Class/Category preferences
  cabinClass: { 
    type: String, 
    enum: ['economy', 'premium_economy', 'business', 'first'],
    default: 'economy'
  },
  
  // Price criteria
  targetPrice: { type: Number, required: true },
  currentPrice: { type: Number },
  originalPrice: { type: Number }, // Price when alert was created
  currency: { type: String, default: 'USD' },
  
  // Alert conditions
  alertWhen: {
    type: { type: String, enum: ['below', 'drop_by_percentage', 'drop_by_amount'], default: 'below' },
    percentage: { type: Number }, // for drop_by_percentage
    amount: { type: Number } // for drop_by_amount
  },
  
  // Notification settings
  notifications: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    emailAddress: { type: String },
    phoneNumber: { type: String }
  },
  
  // Alert status
  status: { 
    type: String, 
    required: true,
    enum: Object.values(AlertStatus),
    default: AlertStatus.ACTIVE,
    index: true 
  },
  
  // Tracking
  priceHistory: [{
    price: { type: Number, required: true },
    checkedAt: { type: Date, default: Date.now },
    source: { type: String } // which OTA/provider
  }],
  
  // Trigger info
  triggeredAt: { type: Date },
  triggeredPrice: { type: Number },
  notificationSentAt: { type: Date },
  notificationSent: { type: Boolean, default: false },
  
  // Expiry
  expiresAt: { type: Date },
  
  // Metadata
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  lastCheckedAt: { type: Date },
  checkCount: { type: Number, default: 0 },
  
  // User preferences
  notes: { type: String },
  tags: [{ type: String }]
};

/**
 * Price Alert Model Class
 */
class PriceAlert {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.userId = data.userId;
    
    this.type = data.type || AlertType.FLIGHT;
    this.origin = data.origin;
    this.originCode = data.originCode;
    this.destination = data.destination;
    this.destinationCode = data.destinationCode;
    
    this.departureDate = data.departureDate ? new Date(data.departureDate) : null;
    this.returnDate = data.returnDate ? new Date(data.returnDate) : null;
    this.flexibleDates = data.flexibleDates || false;
    this.dateFlexibility = data.dateFlexibility || 3;
    
    this.adults = data.adults || 1;
    this.children = data.children || 0;
    this.infants = data.infants || 0;
    
    this.cabinClass = data.cabinClass || 'economy';
    
    this.targetPrice = data.targetPrice;
    this.currentPrice = data.currentPrice || null;
    this.originalPrice = data.originalPrice || data.targetPrice;
    this.currency = data.currency || 'USD';
    
    this.alertWhen = {
      type: 'below',
      percentage: null,
      amount: null,
      ...data.alertWhen
    };
    
    this.notifications = {
      email: true,
      push: false,
      sms: false,
      emailAddress: data.notifications?.emailAddress || data.email,
      phoneNumber: data.notifications?.phoneNumber || data.phone,
      ...data.notifications
    };
    
    this.status = data.status || AlertStatus.ACTIVE;
    
    this.priceHistory = data.priceHistory || [];
    
    this.triggeredAt = data.triggeredAt ? new Date(data.triggeredAt) : null;
    this.triggeredPrice = data.triggeredPrice || null;
    this.notificationSentAt = data.notificationSentAt ? new Date(data.notificationSentAt) : null;
    this.notificationSent = data.notificationSent || false;
    
    this.expiresAt = data.expiresAt ? new Date(data.expiresAt) : this.calculateExpiry();
    
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    this.lastCheckedAt = data.lastCheckedAt ? new Date(data.lastCheckedAt) : null;
    this.checkCount = data.checkCount || 0;
    
    this.notes = data.notes || '';
    this.tags = data.tags || [];
  }
  
  /**
   * Calculate default expiry (30 days from creation)
   */
  calculateExpiry() {
    const expiry = new Date(this.createdAt || Date.now());
    expiry.setDate(expiry.getDate() + 30);
    return expiry;
  }
  
  /**
   * Check if price meets alert criteria
   */
  checkPrice(currentPrice) {
    this.currentPrice = currentPrice;
    this.priceHistory.push({
      price: currentPrice,
      checkedAt: new Date(),
      source: 'price_check'
    });
    this.checkCount++;
    this.lastCheckedAt = new Date();
    
    const { type, percentage, amount } = this.alertWhen;
    
    let shouldTrigger = false;
    
    switch (type) {
      case 'below':
        shouldTrigger = currentPrice <= this.targetPrice;
        break;
      case 'drop_by_percentage':
        if (this.originalPrice && percentage) {
          const dropPercent = ((this.originalPrice - currentPrice) / this.originalPrice) * 100;
          shouldTrigger = dropPercent >= percentage;
        }
        break;
      case 'drop_by_amount':
        if (this.originalPrice && amount) {
          const dropAmount = this.originalPrice - currentPrice;
          shouldTrigger = dropAmount >= amount;
        }
        break;
    }
    
    if (shouldTrigger && this.status === AlertStatus.ACTIVE) {
      this.trigger(currentPrice);
    }
    
    this.updatedAt = new Date();
    return shouldTrigger;
  }
  
  /**
   * Trigger the alert
   */
  trigger(price) {
    this.status = AlertStatus.TRIGGERED;
    this.triggeredAt = new Date();
    this.triggeredPrice = price;
    return this;
  }
  
  /**
   * Mark notification as sent
   */
  markNotificationSent() {
    this.notificationSent = true;
    this.notificationSentAt = new Date();
    this.updatedAt = new Date();
    return this;
  }
  
  /**
   * Pause the alert
   */
  pause() {
    this.status = AlertStatus.PAUSED;
    this.updatedAt = new Date();
    return this;
  }
  
  /**
   * Resume the alert
   */
  resume() {
    if (this.status === AlertStatus.PAUSED) {
      this.status = AlertStatus.ACTIVE;
      this.updatedAt = new Date();
    }
    return this;
  }
  
  /**
   * Check if alert has expired
   */
  checkExpiry() {
    if (this.expiresAt && new Date() > this.expiresAt) {
      this.status = AlertStatus.EXPIRED;
      this.updatedAt = new Date();
      return true;
    }
    return false;
  }
  
  /**
   * Delete the alert
   */
  delete() {
    this.status = AlertStatus.DELETED;
    this.updatedAt = new Date();
    return this;
  }
  
  /**
   * Get price trend
   */
  getPriceTrend() {
    if (this.priceHistory.length < 2) return 'stable';
    
    const recent = this.priceHistory.slice(-5);
    const firstPrice = recent[0].price;
    const lastPrice = recent[recent.length - 1].price;
    
    if (lastPrice < firstPrice * 0.95) return 'decreasing';
    if (lastPrice > firstPrice * 1.05) return 'increasing';
    return 'stable';
  }
  
  /**
   * Get lowest price recorded
   */
  getLowestPrice() {
    if (this.priceHistory.length === 0) return null;
    return Math.min(...this.priceHistory.map(h => h.price));
  }
  
  /**
   * Get highest price recorded
   */
  getHighestPrice() {
    if (this.priceHistory.length === 0) return null;
    return Math.max(...this.priceHistory.map(h => h.price));
  }
  
  /**
   * Get average price
   */
  getAveragePrice() {
    if (this.priceHistory.length === 0) return null;
    const sum = this.priceHistory.reduce((acc, h) => acc + h.price, 0);
    return sum / this.priceHistory.length;
  }
  
  /**
   * Get price change percentage
   */
  getPriceChangePercentage() {
    if (!this.originalPrice || !this.currentPrice) return 0;
    return ((this.currentPrice - this.originalPrice) / this.originalPrice) * 100;
  }
  
  /**
   * Validate alert data
   */
  validate() {
    const errors = [];
    
    if (!this.userId) errors.push('User ID is required');
    if (!this.type) errors.push('Alert type is required');
    if (!this.origin) errors.push('Origin is required');
    if (!this.destination) errors.push('Destination is required');
    if (!this.departureDate) errors.push('Departure date is required');
    if (!this.targetPrice || this.targetPrice <= 0) errors.push('Valid target price is required');
    
    return errors;
  }
  
  /**
   * Get display summary
   */
  getSummary() {
    return {
      id: this.id,
      type: this.type,
      route: `${this.origin} → ${this.destination}`,
      departureDate: this.departureDate,
      targetPrice: this.targetPrice,
      currentPrice: this.currentPrice,
      currency: this.currency,
      status: this.status,
      priceChange: this.getPriceChangePercentage(),
      trend: this.getPriceTrend(),
      createdAt: this.createdAt
    };
  }
  
  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      type: this.type,
      origin: this.origin,
      originCode: this.originCode,
      destination: this.destination,
      destinationCode: this.destinationCode,
      departureDate: this.departureDate,
      returnDate: this.returnDate,
      flexibleDates: this.flexibleDates,
      dateFlexibility: this.dateFlexibility,
      adults: this.adults,
      children: this.children,
      infants: this.infants,
      cabinClass: this.cabinClass,
      targetPrice: this.targetPrice,
      currentPrice: this.currentPrice,
      originalPrice: this.originalPrice,
      currency: this.currency,
      alertWhen: this.alertWhen,
      notifications: this.notifications,
      status: this.status,
      priceHistory: this.priceHistory,
      triggeredAt: this.triggeredAt,
      triggeredPrice: this.triggeredPrice,
      notificationSentAt: this.notificationSentAt,
      notificationSent: this.notificationSent,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastCheckedAt: this.lastCheckedAt,
      checkCount: this.checkCount,
      notes: this.notes,
      tags: this.tags
    };
  }
}

/**
 * Price Alert Repository
 */
class PriceAlertRepository {
  constructor(database = null) {
    this.db = database;
    this.alerts = new Map();
    this.alertsByUser = new Map();
    this.activeAlerts = new Set();
  }
  
  async create(alertData) {
    const alert = new PriceAlert(alertData);
    const errors = alert.validate();
    
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    this.alerts.set(alert.id, alert);
    
    if (!this.alertsByUser.has(alert.userId)) {
      this.alertsByUser.set(alert.userId, new Set());
    }
    this.alertsByUser.get(alert.userId).add(alert.id);
    
    if (alert.status === AlertStatus.ACTIVE) {
      this.activeAlerts.add(alert.id);
    }
    
    if (this.db) {
      try {
        await this.db.collection('priceAlerts').insertOne(alert.toJSON());
      } catch (error) {
        console.error('Failed to store alert in MongoDB:', error);
      }
    }
    
    return alert;
  }
  
  async findById(id) {
    if (this.alerts.has(id)) {
      return this.alerts.get(id);
    }
    
    if (this.db) {
      const data = await this.db.collection('priceAlerts').findOne({ id });
      if (data) return new PriceAlert(data);
    }
    
    return null;
  }
  
  async findByUser(userId, options = {}) {
    const { status, type, limit = 50, offset = 0 } = options;
    
    const alertIds = this.alertsByUser.get(userId);
    if (!alertIds) return [];
    
    let alerts = Array.from(alertIds)
      .map(id => this.alerts.get(id))
      .filter(a => a !== undefined && a.status !== AlertStatus.DELETED);
    
    if (status) {
      alerts = alerts.filter(a => a.status === status);
    }
    if (type) {
      alerts = alerts.filter(a => a.type === type);
    }
    
    // Sort by created date descending
    alerts.sort((a, b) => b.createdAt - a.createdAt);
    
    return alerts.slice(offset, offset + limit);
  }
  
  async findActiveAlerts() {
    const activeAlerts = [];
    for (const id of this.activeAlerts) {
      const alert = this.alerts.get(id);
      if (alert && alert.status === AlertStatus.ACTIVE && !alert.checkExpiry()) {
        activeAlerts.push(alert);
      }
    }
    return activeAlerts;
  }
  
  async findAlertsForRoute(origin, destination, options = {}) {
    const { type, departureDate } = options;
    
    const matchingAlerts = [];
    
    for (const alert of this.alerts.values()) {
      if (alert.status !== AlertStatus.ACTIVE) continue;
      if (alert.origin !== origin) continue;
      if (alert.destination !== destination) continue;
      if (type && alert.type !== type) continue;
      
      if (departureDate) {
        const alertDate = new Date(alert.departureDate);
        const searchDate = new Date(departureDate);
        
        if (alert.flexibleDates) {
          const diffDays = Math.abs(alertDate - searchDate) / (1000 * 60 * 60 * 24);
          if (diffDays > alert.dateFlexibility) continue;
        } else {
          if (alertDate.toDateString() !== searchDate.toDateString()) continue;
        }
      }
      
      matchingAlerts.push(alert);
    }
    
    return matchingAlerts;
  }
  
  async update(id, updates) {
    const alert = await this.findById(id);
    if (!alert) return null;
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'userId' && key !== 'createdAt') {
        alert[key] = updates[key];
      }
    });
    
    alert.updatedAt = new Date();
    
    // Update active alerts tracking
    if (updates.status) {
      if (updates.status === AlertStatus.ACTIVE) {
        this.activeAlerts.add(id);
      } else {
        this.activeAlerts.delete(id);
      }
    }
    
    if (this.db) {
      await this.db.collection('priceAlerts').updateOne(
        { id },
        { $set: updates, $currentDate: { updatedAt: true } }
      );
    }
    
    return alert;
  }
  
  async delete(id) {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.delete();
      this.activeAlerts.delete(id);
      
      if (this.db) {
        await this.db.collection('priceAlerts').updateOne(
          { id },
          { $set: { status: AlertStatus.DELETED, updatedAt: new Date() } }
        );
      }
    }
    return true;
  }
  
  async getStats(userId) {
    const alerts = await this.findByUser(userId);
    
    return {
      total: alerts.length,
      active: alerts.filter(a => a.status === AlertStatus.ACTIVE).length,
      triggered: alerts.filter(a => a.status === AlertStatus.TRIGGERED).length,
      paused: alerts.filter(a => a.status === AlertStatus.PAUSED).length,
      expired: alerts.filter(a => a.status === AlertStatus.EXPIRED).length,
      byType: alerts.reduce((acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

module.exports = {
  PriceAlert,
  PriceAlertRepository,
  PriceAlertSchema,
  AlertStatus,
  AlertType
};
