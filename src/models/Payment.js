/**
 * Payment Model for Nexvoy
 * Handles payment records and transaction history
 */

const crypto = require('crypto');

/**
 * Payment Status Enum
 */
const PaymentStatus = {
  PENDING: 'pending',
  AUTHORIZED: 'authorized',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
  DISPUTED: 'disputed',
  CHARGEBACK: 'chargeback'
};

/**
 * Payment Method Enum
 */
const PaymentMethod = {
  STRIPE: 'stripe',
  PAYPAL: 'paypal',
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  APPLE_PAY: 'apple_pay',
  GOOGLE_PAY: 'google_pay',
  KLARNA: 'klarna',
  AFFIRM: 'affirm'
};

/**
 * Payment Schema Definition
 */
const PaymentSchema = {
  id: { type: String, required: true, unique: true },
  bookingId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  
  // Payment details
  amount: { type: Number, required: true },
  currency: { type: String, required: true, default: 'USD' },
  status: { 
    type: String, 
    required: true, 
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PENDING,
    index: true 
  },
  
  // Payment method
  method: { 
    type: String, 
    required: true,
    enum: Object.values(PaymentMethod)
  },
  
  // Provider-specific IDs
  stripePaymentIntentId: { type: String },
  stripeCustomerId: { type: String },
  stripeChargeId: { type: String },
  stripeSetupIntentId: { type: String },
  
  paypalOrderId: { type: String },
  paypalPayerId: { type: String },
  paypalCaptureId: { type: String },
  
  // Card details (for card payments)
  cardDetails: {
    brand: { type: String }, // visa, mastercard, amex, etc.
    lastFourDigits: { type: String },
    expiryMonth: { type: String },
    expiryYear: { type: String },
    country: { type: String },
    fingerprint: { type: String } // Card fingerprint for tracking
  },
  
  // 3D Secure / SCA
  threeDSecure: {
    required: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
    version: { type: String }, // 1.0, 2.0
    authenticated: { type: Boolean, default: false }
  },
  
  // Billing information
  billingAddress: {
    firstName: { type: String },
    lastName: { type: String },
    company: { type: String },
    address1: { type: String },
    address2: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String },
    phone: { type: String }
  },
  
  // Billing email
  billingEmail: { type: String },
  
  // Payment description
  description: { type: String },
  statementDescriptor: { type: String }, // What appears on customer's statement
  
  // Metadata for tracking
  metadata: {
    ipAddress: { type: String },
    userAgent: { type: String },
    referrer: { type: String },
    deviceType: { type: String },
    geoLocation: {
      country: { type: String },
      city: { type: String },
      latitude: { type: Number },
      longitude: { type: Number }
    },
    customFields: { type: Object }
  },
  
  // Error information
  errorMessage: { type: String },
  errorCode: { type: String },
  declineCode: { type: String }, // Stripe decline code
  
  // Risk assessment
  riskAssessment: {
    score: { type: Number }, // 0-100
    level: { type: String, enum: ['low', 'medium', 'high'] },
    reason: { type: String },
    flagged: { type: Boolean, default: false }
  },
  
  // Receipts and invoices
  receiptUrl: { type: String },
  receiptNumber: { type: String },
  invoiceId: { type: String },
  invoiceUrl: { type: String },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now, index: true },
  authorizedAt: { type: Date },
  capturedAt: { type: Date },
  completedAt: { type: Date },
  failedAt: { type: Date },
  cancelledAt: { type: Date },
  refundedAt: { type: Date },
  
  // Refund information
  refundDetails: {
    amount: { type: Number, default: 0 },
    reason: { type: String },
    status: { 
      type: String, 
      enum: ['none', 'pending', 'completed', 'failed'],
      default: 'none'
    }
  },
  
  // Partial refund tracking
  partialRefunds: [{
    id: { type: String },
    amount: { type: Number },
    reason: { type: String },
    createdAt: { type: Date }
  }],
  
  // Webhook events log
  webhookEvents: [{
    id: { type: String },
    type: { type: String },
    receivedAt: { type: Date },
    data: { type: Object }
  }],
  
  // Retry information
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  nextRetryAt: { type: Date }
};

/**
 * Payment Model Class
 */
class Payment {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.bookingId = data.bookingId;
    this.userId = data.userId;
    
    this.amount = data.amount;
    this.currency = data.currency || 'USD';
    this.status = data.status || PaymentStatus.PENDING;
    this.method = data.method;
    
    // Provider IDs
    this.stripePaymentIntentId = data.stripePaymentIntentId || null;
    this.stripeCustomerId = data.stripeCustomerId || null;
    this.stripeChargeId = data.stripeChargeId || null;
    this.stripeSetupIntentId = data.stripeSetupIntentId || null;
    
    this.paypalOrderId = data.paypalOrderId || null;
    this.paypalPayerId = data.paypalPayerId || null;
    this.paypalCaptureId = data.paypalCaptureId || null;
    
    // Card details
    this.cardDetails = data.cardDetails || null;
    
    // 3D Secure
    this.threeDSecure = {
      required: false,
      completed: false,
      version: null,
      authenticated: false,
      ...data.threeDSecure
    };
    
    // Billing
    this.billingAddress = data.billingAddress || null;
    this.billingEmail = data.billingEmail || null;
    
    // Description
    this.description = data.description || '';
    this.statementDescriptor = data.statementDescriptor || 'NEXVOY';
    
    // Metadata
    this.metadata = data.metadata || {};
    
    // Error
    this.errorMessage = data.errorMessage || null;
    this.errorCode = data.errorCode || null;
    this.declineCode = data.declineCode || null;
    
    // Risk
    this.riskAssessment = {
      score: 0,
      level: 'low',
      reason: null,
      flagged: false,
      ...data.riskAssessment
    };
    
    // Receipts
    this.receiptUrl = data.receiptUrl || null;
    this.receiptNumber = data.receiptNumber || null;
    this.invoiceId = data.invoiceId || null;
    this.invoiceUrl = data.invoiceUrl || null;
    
    // Timestamps
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.authorizedAt = data.authorizedAt ? new Date(data.authorizedAt) : null;
    this.capturedAt = data.capturedAt ? new Date(data.capturedAt) : null;
    this.completedAt = data.completedAt ? new Date(data.completedAt) : null;
    this.failedAt = data.failedAt ? new Date(data.failedAt) : null;
    this.cancelledAt = data.cancelledAt ? new Date(data.cancelledAt) : null;
    this.refundedAt = data.refundedAt ? new Date(data.refundedAt) : null;
    
    // Refunds
    this.refundDetails = {
      amount: 0,
      reason: null,
      status: 'none',
      ...data.refundDetails
    };
    this.partialRefunds = data.partialRefunds || [];
    
    // Webhooks
    this.webhookEvents = data.webhookEvents || [];
    
    // Retry
    this.retryCount = data.retryCount || 0;
    this.maxRetries = data.maxRetries || 3;
    this.nextRetryAt = data.nextRetryAt ? new Date(data.nextRetryAt) : null;
  }
  
  /**
   * Authorize the payment (funds held but not captured)
   */
  authorize(providerData = {}) {
    this.status = PaymentStatus.AUTHORIZED;
    this.authorizedAt = new Date();
    
    // Update provider-specific IDs
    if (providerData.stripeChargeId) {
      this.stripeChargeId = providerData.stripeChargeId;
    }
    if (providerData.paypalCaptureId) {
      this.paypalCaptureId = providerData.paypalCaptureId;
    }
    
    return this;
  }
  
  /**
   * Capture the payment (finalize and collect funds)
   */
  capture(providerData = {}) {
    this.status = PaymentStatus.COMPLETED;
    this.capturedAt = new Date();
    this.completedAt = new Date();
    
    // Update provider-specific IDs
    if (providerData.stripeChargeId) {
      this.stripeChargeId = providerData.stripeChargeId;
    }
    if (providerData.paypalCaptureId) {
      this.paypalCaptureId = providerData.paypalCaptureId;
    }
    if (providerData.receiptUrl) {
      this.receiptUrl = providerData.receiptUrl;
    }
    if (providerData.receiptNumber) {
      this.receiptNumber = providerData.receiptNumber;
    }
    
    return this;
  }
  
  /**
   * Mark payment as completed (for non-authorized payments)
   */
  complete(providerData = {}) {
    this.status = PaymentStatus.COMPLETED;
    this.completedAt = new Date();
    
    if (providerData.receiptUrl) {
      this.receiptUrl = providerData.receiptUrl;
    }
    if (providerData.receiptNumber) {
      this.receiptNumber = providerData.receiptNumber;
    }
    
    return this;
  }
  
  /**
   * Mark payment as failed
   */
  fail(errorMessage, errorCode = null, declineCode = null) {
    this.status = PaymentStatus.FAILED;
    this.failedAt = new Date();
    this.errorMessage = errorMessage;
    this.errorCode = errorCode;
    this.declineCode = declineCode;
    
    return this;
  }
  
  /**
   * Mark payment as cancelled
   */
  cancel(reason = null) {
    this.status = PaymentStatus.CANCELLED;
    this.cancelledAt = new Date();
    this.errorMessage = reason;
    
    return this;
  }
  
  /**
   * Process full refund
   */
  refund(reason = 'requested_by_customer') {
    this.status = PaymentStatus.REFUNDED;
    this.refundedAt = new Date();
    this.refundDetails = {
      amount: this.amount,
      reason: reason,
      status: 'completed'
    };
    
    return this;
  }
  
  /**
   * Process partial refund
   */
  partialRefund(amount, reason = 'requested_by_customer') {
    const totalRefunded = this.getTotalRefunded() + amount;
    
    if (totalRefunded >= this.amount) {
      return this.refund(reason);
    }
    
    const refundId = crypto.randomUUID();
    this.partialRefunds.push({
      id: refundId,
      amount: amount,
      reason: reason,
      createdAt: new Date()
    });
    
    this.status = PaymentStatus.PARTIALLY_REFUNDED;
    this.refundDetails = {
      amount: totalRefunded,
      reason: reason,
      status: 'completed'
    };
    
    return this;
  }
  
  /**
   * Get total refunded amount
   */
  getTotalRefunded() {
    if (this.status === PaymentStatus.REFUNDED) {
      return this.amount;
    }
    return this.partialRefunds.reduce((sum, r) => sum + r.amount, 0);
  }
  
  /**
   * Check if payment can be refunded
   */
  canRefund() {
    return [
      PaymentStatus.COMPLETED,
      PaymentStatus.PARTIALLY_REFUNDED
    ].includes(this.status);
  }
  
  /**
   * Check if payment requires 3D Secure
   */
  requires3DSecure() {
    return this.threeDSecure.required && !this.threeDSecure.completed;
  }
  
  /**
   * Complete 3D Secure authentication
   */
  complete3DSecure(authenticated = true) {
    this.threeDSecure.completed = true;
    this.threeDSecure.authenticated = authenticated;
    return this;
  }
  
  /**
   * Record webhook event
   */
  recordWebhookEvent(eventType, eventData) {
    this.webhookEvents.push({
      id: crypto.randomUUID(),
      type: eventType,
      receivedAt: new Date(),
      data: eventData
    });
    return this;
  }
  
  /**
   * Update risk assessment
   */
  updateRiskAssessment(score, level, reason = null) {
    this.riskAssessment = {
      score,
      level,
      reason,
      flagged: level === 'high'
    };
    return this;
  }
  
  /**
   * Mark for retry
   */
  markForRetry() {
    this.retryCount++;
    this.nextRetryAt = new Date(Date.now() + (this.retryCount * 5 * 60 * 1000)); // 5 min intervals
    return this;
  }
  
  /**
   * Check if payment can be retried
   */
  canRetry() {
    return this.retryCount < this.maxRetries && 
           this.status === PaymentStatus.FAILED;
  }
  
  /**
   * Validate payment data
   */
  validate() {
    const errors = [];
    
    if (!this.bookingId) errors.push('Booking ID is required');
    if (!this.userId) errors.push('User ID is required');
    if (!this.amount || this.amount <= 0) errors.push('Valid amount is required');
    if (!this.currency) errors.push('Currency is required');
    if (!this.method) errors.push('Payment method is required');
    
    return errors;
  }
  
  /**
   * Get display summary
   */
  getSummary() {
    return {
      id: this.id,
      bookingId: this.bookingId,
      amount: this.amount,
      currency: this.currency,
      status: this.status,
      method: this.method,
      createdAt: this.createdAt,
      canRefund: this.canRefund(),
      refundedAmount: this.getTotalRefunded()
    };
  }
  
  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      bookingId: this.bookingId,
      userId: this.userId,
      amount: this.amount,
      currency: this.currency,
      status: this.status,
      method: this.method,
      stripePaymentIntentId: this.stripePaymentIntentId,
      stripeCustomerId: this.stripeCustomerId,
      stripeChargeId: this.stripeChargeId,
      paypalOrderId: this.paypalOrderId,
      paypalCaptureId: this.paypalCaptureId,
      cardDetails: this.cardDetails,
      threeDSecure: this.threeDSecure,
      billingAddress: this.billingAddress,
      billingEmail: this.billingEmail,
      description: this.description,
      statementDescriptor: this.statementDescriptor,
      metadata: this.metadata,
      errorMessage: this.errorMessage,
      errorCode: this.errorCode,
      declineCode: this.declineCode,
      riskAssessment: this.riskAssessment,
      receiptUrl: this.receiptUrl,
      receiptNumber: this.receiptNumber,
      createdAt: this.createdAt,
      authorizedAt: this.authorizedAt,
      capturedAt: this.capturedAt,
      completedAt: this.completedAt,
      failedAt: this.failedAt,
      cancelledAt: this.cancelledAt,
      refundedAt: this.refundedAt,
      refundDetails: this.refundDetails,
      partialRefunds: this.partialRefunds,
      retryCount: this.retryCount
    };
  }
}

/**
 * Payment Repository
 */
class PaymentRepository {
  constructor(database = null) {
    this.db = database;
    this.payments = new Map();
    this.paymentsByBooking = new Map();
    this.paymentsByUser = new Map();
  }
  
  async create(paymentData) {
    const payment = new Payment(paymentData);
    const errors = payment.validate();
    
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    this.payments.set(payment.id, payment);
    
    // Index by booking
    this.paymentsByBooking.set(payment.bookingId, payment.id);
    
    // Index by user
    if (!this.paymentsByUser.has(payment.userId)) {
      this.paymentsByUser.set(payment.userId, new Set());
    }
    this.paymentsByUser.get(payment.userId).add(payment.id);
    
    if (this.db) {
      try {
        await this.db.collection('payments').insertOne(payment.toJSON());
      } catch (error) {
        console.error('Failed to store payment in MongoDB:', error);
      }
    }
    
    return payment;
  }
  
  async findById(id) {
    if (this.payments.has(id)) {
      return this.payments.get(id);
    }
    
    if (this.db) {
      const data = await this.db.collection('payments').findOne({ id });
      if (data) {
        return new Payment(data);
      }
    }
    
    return null;
  }
  
  async findByBooking(bookingId) {
    const paymentId = this.paymentsByBooking.get(bookingId);
    if (paymentId) {
      return this.findById(paymentId);
    }
    
    if (this.db) {
      const data = await this.db.collection('payments').findOne({ bookingId });
      if (data) {
        return new Payment(data);
      }
    }
    
    return null;
  }
  
  async findByUser(userId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;
    
    const paymentIds = this.paymentsByUser.get(userId);
    if (!paymentIds) return [];
    
    let payments = Array.from(paymentIds)
      .map(id => this.payments.get(id))
      .filter(p => p !== undefined);
    
    if (status) {
      payments = payments.filter(p => p.status === status);
    }
    
    // Sort by created date descending
    payments.sort((a, b) => b.createdAt - a.createdAt);
    
    return payments.slice(offset, offset + limit);
  }
  
  async update(id, updates) {
    const payment = await this.findById(id);
    if (!payment) return null;
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'bookingId' && key !== 'userId') {
        payment[key] = updates[key];
      }
    });
    
    if (this.db) {
      await this.db.collection('payments').updateOne(
        { id },
        { $set: updates }
      );
    }
    
    return payment;
  }
  
  async findByProviderId(provider, providerId) {
    let query = {};
    
    if (provider === 'stripe') {
      query = { stripePaymentIntentId: providerId };
    } else if (provider === 'paypal') {
      query = { paypalOrderId: providerId };
    }
    
    if (this.db) {
      const data = await this.db.collection('payments').findOne(query);
      if (data) return new Payment(data);
    }
    
    // Search in memory
    for (const payment of this.payments.values()) {
      if (provider === 'stripe' && payment.stripePaymentIntentId === providerId) {
        return payment;
      }
      if (provider === 'paypal' && payment.paypalOrderId === providerId) {
        return payment;
      }
    }
    
    return null;
  }
  
  async getStats(startDate, endDate) {
    const stats = {
      total: 0,
      successful: 0,
      failed: 0,
      refunded: 0,
      revenue: 0,
      refunds: 0,
      byMethod: {}
    };
    
    for (const payment of this.payments.values()) {
      const createdAt = new Date(payment.createdAt);
      if (createdAt >= startDate && createdAt <= endDate) {
        stats.total++;
        stats.byMethod[payment.method] = (stats.byMethod[payment.method] || 0) + 1;
        
        if (payment.status === PaymentStatus.COMPLETED) {
          stats.successful++;
          stats.revenue += payment.amount;
        } else if (payment.status === PaymentStatus.FAILED) {
          stats.failed++;
        }
        
        if (payment.status === PaymentStatus.REFUNDED || 
            payment.status === PaymentStatus.PARTIALLY_REFUNDED) {
          stats.refunded++;
          stats.refunds += payment.getTotalRefunded();
        }
      }
    }
    
    return stats;
  }
}

module.exports = {
  Payment,
  PaymentRepository,
  PaymentSchema,
  PaymentStatus,
  PaymentMethod
};