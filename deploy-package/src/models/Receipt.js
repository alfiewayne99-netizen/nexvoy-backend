/**
 * Receipt Model for Nexvoy
 * Handles receipt and invoice storage
 */

const crypto = require('crypto');

/**
 * Receipt Status Enum
 */
const ReceiptStatus = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  PAID: 'paid',
  VOID: 'void',
  REFUNDED: 'refunded'
};

/**
 * Receipt Type Enum
 */
const ReceiptType = {
  INVOICE: 'invoice',
  RECEIPT: 'receipt',
  CREDIT_NOTE: 'credit_note',
  REFUND_RECEIPT: 'refund_receipt'
};

/**
 * Receipt Schema Definition
 */
const ReceiptSchema = {
  id: { type: String, required: true, unique: true },
  receiptNumber: { type: String, required: true, unique: true },
  
  // Relationships
  paymentId: { type: String, required: true, index: true },
  bookingId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  
  // Receipt type and status
  type: { 
    type: String, 
    required: true, 
    enum: Object.values(ReceiptType),
    default: ReceiptType.RECEIPT 
  },
  status: { 
    type: String, 
    required: true, 
    enum: Object.values(ReceiptStatus),
    default: ReceiptStatus.DRAFT 
  },
  
  // Receipt details
  issueDate: { type: Date, required: true },
  dueDate: { type: Date },
  
  // Seller information (Nexvoy)
  seller: {
    name: { type: String, default: 'Nexvoy Inc.' },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String }
    },
    taxId: { type: String },
    phone: { type: String },
    email: { type: String },
    logo: { type: String }
  },
  
  // Buyer information (customer)
  buyer: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String }
    },
    taxId: { type: String }
  },
  
  // Line items
  items: [{
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 }
  }],
  
  // Financial summary
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  taxes: { type: Number, default: 0 },
  total: { type: Number, required: true },
  currency: { type: String, required: true, default: 'USD' },
  
  // Payment information
  payment: {
    method: { type: String },
    lastFourDigits: { type: String },
    cardBrand: { type: String },
    paidAt: { type: Date },
    transactionId: { type: String }
  },
  
  // Notes and terms
  notes: { type: String },
  termsAndConditions: { type: String },
  
  // PDF generation
  pdfUrl: { type: String },
  pdfGeneratedAt: { type: Date },
  
  // Metadata
  metadata: {
    ipAddress: { type: String },
    userAgent: { type: String },
    customFields: { type: Object }
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  // For refunds/voids
  voidedAt: { type: Date },
  voidReason: { type: String },
  originalReceiptId: { type: String }, // For credit notes
  
  // Stripe references
  stripeInvoiceId: { type: String },
  stripeInvoiceUrl: { type: String }
};

/**
 * Generate unique receipt number
 * Format: RCP-YYYYMMDD-XXXXX
 */
function generateReceiptNumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(10000 + Math.random() * 90000);
  return `RCP-${dateStr}-${random}`;
}

/**
 * Receipt Model Class
 */
class Receipt {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.receiptNumber = data.receiptNumber || generateReceiptNumber();
    
    this.paymentId = data.paymentId;
    this.bookingId = data.bookingId;
    this.userId = data.userId;
    
    this.type = data.type || ReceiptType.RECEIPT;
    this.status = data.status || ReceiptStatus.DRAFT;
    
    this.issueDate = data.issueDate ? new Date(data.issueDate) : new Date();
    this.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    
    this.seller = {
      name: 'Nexvoy Inc.',
      address: {
        street: '123 Travel Street',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
        country: 'USA'
      },
      taxId: 'XX-XXXXXXX',
      phone: '+1 (555) 123-4567',
      email: 'billing@nexvoy.com',
      logo: 'https://nexvoy.com/logo.png',
      ...data.seller
    };
    
    this.buyer = data.buyer || {};
    this.items = data.items || [];
    
    this.subtotal = data.subtotal || 0;
    this.discount = data.discount || 0;
    this.taxes = data.taxes || 0;
    this.total = data.total || 0;
    this.currency = data.currency || 'USD';
    
    this.payment = data.payment || {};
    this.notes = data.notes || '';
    this.termsAndConditions = data.termsAndConditions || '';
    
    this.pdfUrl = data.pdfUrl || null;
    this.pdfGeneratedAt = data.pdfGeneratedAt ? new Date(data.pdfGeneratedAt) : null;
    
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    
    this.voidedAt = data.voidedAt ? new Date(data.voidedAt) : null;
    this.voidReason = data.voidReason || null;
    this.originalReceiptId = data.originalReceiptId || null;
    
    this.stripeInvoiceId = data.stripeInvoiceId || null;
    this.stripeInvoiceUrl = data.stripeInvoiceUrl || null;
  }
  
  /**
   * Calculate totals from line items
   */
  calculateTotals() {
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    this.taxes = this.items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
    this.total = this.subtotal - this.discount + this.taxes;
    return this;
  }
  
  /**
   * Issue the receipt
   */
  issue() {
    this.status = ReceiptStatus.ISSUED;
    this.issueDate = new Date();
    this.updatedAt = new Date();
    return this;
  }
  
  /**
   * Mark as paid
   */
  markPaid(paymentInfo = {}) {
    this.status = ReceiptStatus.PAID;
    this.payment = { ...this.payment, ...paymentInfo, paidAt: new Date() };
    this.updatedAt = new Date();
    return this;
  }
  
  /**
   * Void the receipt
   */
  void(reason) {
    this.status = ReceiptStatus.VOID;
    this.voidedAt = new Date();
    this.voidReason = reason;
    this.updatedAt = new Date();
    return this;
  }
  
  /**
   * Mark as refunded
   */
  markRefunded() {
    this.status = ReceiptStatus.REFUNDED;
    this.updatedAt = new Date();
    return this;
  }
  
  /**
   * Add line item
   */
  addItem(description, quantity, unitPrice, taxRate = 0) {
    const totalPrice = quantity * unitPrice;
    const taxAmount = totalPrice * (taxRate / 100);
    
    this.items.push({
      description,
      quantity,
      unitPrice,
      totalPrice,
      taxRate,
      taxAmount
    });
    
    this.calculateTotals();
    return this;
  }
  
  /**
   * Generate PDF URL
   */
  generatePdfUrl() {
    this.pdfUrl = `${process.env.FRONTEND_URL}/api/receipts/${this.id}/pdf`;
    this.pdfGeneratedAt = new Date();
    return this;
  }
  
  /**
   * Validate receipt data
   */
  validate() {
    const errors = [];
    
    if (!this.paymentId) errors.push('Payment ID is required');
    if (!this.bookingId) errors.push('Booking ID is required');
    if (!this.userId) errors.push('User ID is required');
    if (!this.buyer.name) errors.push('Buyer name is required');
    if (!this.buyer.email) errors.push('Buyer email is required');
    if (this.items.length === 0) errors.push('At least one item is required');
    if (this.total <= 0) errors.push('Total must be greater than 0');
    
    return errors;
  }
  
  /**
   * Get display summary
   */
  getSummary() {
    return {
      id: this.id,
      receiptNumber: this.receiptNumber,
      type: this.type,
      status: this.status,
      issueDate: this.issueDate,
      total: this.total,
      currency: this.currency,
      buyerName: this.buyer.name,
      itemCount: this.items.length,
      pdfUrl: this.pdfUrl
    };
  }
  
  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      receiptNumber: this.receiptNumber,
      paymentId: this.paymentId,
      bookingId: this.bookingId,
      userId: this.userId,
      type: this.type,
      status: this.status,
      issueDate: this.issueDate,
      dueDate: this.dueDate,
      seller: this.seller,
      buyer: this.buyer,
      items: this.items,
      subtotal: this.subtotal,
      discount: this.discount,
      taxes: this.taxes,
      total: this.total,
      currency: this.currency,
      payment: this.payment,
      notes: this.notes,
      termsAndConditions: this.termsAndConditions,
      pdfUrl: this.pdfUrl,
      pdfGeneratedAt: this.pdfGeneratedAt,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      voidedAt: this.voidedAt,
      voidReason: this.voidReason,
      originalReceiptId: this.originalReceiptId,
      stripeInvoiceId: this.stripeInvoiceId,
      stripeInvoiceUrl: this.stripeInvoiceUrl
    };
  }
}

/**
 * Receipt Repository
 */
class ReceiptRepository {
  constructor(database = null) {
    this.db = database;
    this.receipts = new Map();
    this.receiptsByPayment = new Map();
    this.receiptsByBooking = new Map();
    this.receiptsByUser = new Map();
    this.receiptsByNumber = new Map();
  }
  
  async create(receiptData) {
    const receipt = new Receipt(receiptData);
    
    // Calculate totals if items provided
    if (receipt.items.length > 0) {
      receipt.calculateTotals();
    }
    
    const errors = receipt.validate();
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    this.receipts.set(receipt.id, receipt);
    this.receiptsByNumber.set(receipt.receiptNumber, receipt.id);
    this.receiptsByPayment.set(receipt.paymentId, receipt.id);
    this.receiptsByBooking.set(receipt.bookingId, receipt.id);
    
    if (!this.receiptsByUser.has(receipt.userId)) {
      this.receiptsByUser.set(receipt.userId, new Set());
    }
    this.receiptsByUser.get(receipt.userId).add(receipt.id);
    
    if (this.db) {
      try {
        await this.db.collection('receipts').insertOne(receipt.toJSON());
      } catch (error) {
        console.error('Failed to store receipt in MongoDB:', error);
      }
    }
    
    return receipt;
  }
  
  async findById(id) {
    if (this.receipts.has(id)) {
      return this.receipts.get(id);
    }
    
    if (this.db) {
      const data = await this.db.collection('receipts').findOne({ id });
      if (data) return new Receipt(data);
    }
    
    return null;
  }
  
  async findByNumber(receiptNumber) {
    const id = this.receiptsByNumber.get(receiptNumber);
    if (id) return this.findById(id);
    
    if (this.db) {
      const data = await this.db.collection('receipts').findOne({ receiptNumber });
      if (data) return new Receipt(data);
    }
    
    return null;
  }
  
  async findByPayment(paymentId) {
    const id = this.receiptsByPayment.get(paymentId);
    if (id) return this.findById(id);
    
    if (this.db) {
      const data = await this.db.collection('receipts').findOne({ paymentId });
      if (data) return new Receipt(data);
    }
    
    return null;
  }
  
  async findByBooking(bookingId) {
    const id = this.receiptsByBooking.get(bookingId);
    if (id) return this.findById(id);
    
    if (this.db) {
      const data = await this.db.collection('receipts').findOne({ bookingId });
      if (data) return new Receipt(data);
    }
    
    return null;
  }
  
  async findByUser(userId, options = {}) {
    const { type, status, limit = 50, offset = 0 } = options;
    
    const receiptIds = this.receiptsByUser.get(userId);
    if (!receiptIds) return [];
    
    let receipts = Array.from(receiptIds)
      .map(id => this.receipts.get(id))
      .filter(r => r !== undefined);
    
    if (type) receipts = receipts.filter(r => r.type === type);
    if (status) receipts = receipts.filter(r => r.status === status);
    
    receipts.sort((a, b) => b.createdAt - a.createdAt);
    
    return receipts.slice(offset, offset + limit);
  }
  
  async update(id, updates) {
    const receipt = await this.findById(id);
    if (!receipt) return null;
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'receiptNumber') {
        receipt[key] = updates[key];
      }
    });
    
    receipt.updatedAt = new Date();
    
    if (this.db) {
      await this.db.collection('receipts').updateOne(
        { id },
        { $set: { ...updates, updatedAt: receipt.updatedAt } }
      );
    }
    
    return receipt;
  }
  
  async generateReceiptFromPayment(payment, booking, user) {
    const receiptData = {
      paymentId: payment.id,
      bookingId: booking.id,
      userId: payment.userId,
      type: ReceiptType.RECEIPT,
      status: ReceiptStatus.PAID,
      issueDate: new Date(),
      buyer: {
        name: user.name || booking.contact.email,
        email: booking.contact.email,
        address: payment.billingAddress || {}
      },
      payment: {
        method: payment.method,
        lastFourDigits: payment.cardDetails?.lastFourDigits,
        cardBrand: payment.cardDetails?.brand,
        paidAt: payment.completedAt,
        transactionId: payment.stripeChargeId || payment.paypalCaptureId
      },
      stripeInvoiceId: payment.invoiceId,
      stripeInvoiceUrl: payment.invoiceUrl
    };
    
    // Add line items based on booking type
    if (booking.type === 'flight' && booking.flightDetails) {
      const flight = booking.flightDetails;
      const passengerCount = flight.passengers?.length || 1;
      
      receiptData.items = [{
        description: `Flight: ${flight.outbound.airline} ${flight.outbound.flightNumber} (${flight.outbound.departure.airportCode} → ${flight.outbound.arrival.airportCode})`,
        quantity: passengerCount,
        unitPrice: booking.pricing.subtotal / passengerCount,
        totalPrice: booking.pricing.subtotal,
        taxRate: 0,
        taxAmount: booking.pricing.taxes || 0
      }];
      
      if (booking.pricing.fees?.bookingFee) {
        receiptData.items.push({
          description: 'Booking Fee',
          quantity: 1,
          unitPrice: booking.pricing.fees.bookingFee,
          totalPrice: booking.pricing.fees.bookingFee,
          taxRate: 0,
          taxAmount: 0
        });
      }
    } else if (booking.type === 'hotel' && booking.hotelDetails) {
      const hotel = booking.hotelDetails;
      
      receiptData.items = [{
        description: `Hotel: ${hotel.propertyName} (${hotel.nights} nights)`,
        quantity: hotel.nights,
        unitPrice: (booking.pricing.subtotal / hotel.nights),
        totalPrice: booking.pricing.subtotal,
        taxRate: 0,
        taxAmount: booking.pricing.taxes || 0
      }];
    }
    
    receiptData.subtotal = booking.pricing.subtotal;
    receiptData.taxes = booking.pricing.taxes || 0;
    receiptData.total = booking.pricing.total;
    receiptData.currency = booking.pricing.currency;
    
    const receipt = await this.create(receiptData);
    receipt.generatePdfUrl();
    
    return this.update(receipt.id, { pdfUrl: receipt.pdfUrl, pdfGeneratedAt: receipt.pdfGeneratedAt });
  }
}

module.exports = {
  Receipt,
  ReceiptRepository,
  ReceiptSchema,
  ReceiptStatus,
  ReceiptType,
  generateReceiptNumber
};
