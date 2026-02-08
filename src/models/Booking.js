/**
 * Booking Model for Nexvoy
 * Handles all booking data: flights, hotels, cars, insurance
 */

const crypto = require('crypto');

/**
 * Generate unique booking reference
 * Format: NVY-XXXXXX (6 alphanumeric characters)
 */
function generateBookingReference() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let reference = 'NVY-';
  for (let i = 0; i < 6; i++) {
    reference += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return reference;
}

/**
 * Booking Schema Definition
 */
const BookingSchema = {
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  bookingReference: { type: String, required: true, unique: true },
  
  // Booking type and status
  type: { 
    type: String, 
    required: true, 
    enum: ['flight', 'hotel', 'car', 'insurance', 'package'],
    index: true 
  },
  status: { 
    type: String, 
    required: true, 
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'refunded', 'failed'],
    default: 'pending',
    index: true 
  },
  
  // Flight details
  flightDetails: {
    outbound: {
      airline: { type: String },
      airlineCode: { type: String },
      flightNumber: { type: String },
      aircraft: { type: String },
      departure: {
        airport: { type: String },
        airportCode: { type: String },
        terminal: { type: String },
        gate: { type: String },
        datetime: { type: Date },
        timezone: { type: String }
      },
      arrival: {
        airport: { type: String },
        airportCode: { type: String },
        terminal: { type: String },
        gate: { type: String },
        datetime: { type: Date },
        timezone: { type: String }
      },
      duration: { type: Number }, // minutes
      stops: { type: Number, default: 0 },
      stopDetails: [{
        airport: { type: String },
        airportCode: { type: String },
        duration: { type: Number } // layover minutes
      }],
      bookingClass: { type: String, enum: ['economy', 'premium_economy', 'business', 'first'] },
      fareBasis: { type: String }
    },
    return: {
      airline: { type: String },
      airlineCode: { type: String },
      flightNumber: { type: String },
      aircraft: { type: String },
      departure: {
        airport: { type: String },
        airportCode: { type: String },
        terminal: { type: String },
        gate: { type: String },
        datetime: { type: Date },
        timezone: { type: String }
      },
      arrival: {
        airport: { type: String },
        airportCode: { type: String },
        terminal: { type: String },
        gate: { type: String },
        datetime: { type: Date },
        timezone: { type: String }
      },
      duration: { type: Number },
      stops: { type: Number, default: 0 },
      stopDetails: [{
        airport: { type: String },
        airportCode: { type: String },
        duration: { type: Number }
      }],
      bookingClass: { type: String, enum: ['economy', 'premium_economy', 'business', 'first'] },
      fareBasis: { type: String }
    },
    tripType: { type: String, enum: ['one_way', 'round_trip', 'multi_city'] },
    passengers: [{
      travelerId: { type: String },
      type: { type: String, enum: ['adult', 'child', 'infant'] },
      title: { type: String },
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      dateOfBirth: { type: Date },
      passportNumber: { type: String },
      passportExpiry: { type: Date },
      passportCountry: { type: String },
      nationality: { type: String },
      seatNumber: { type: String },
      specialMeal: { type: String },
      specialRequests: { type: String },
      checkedBags: { type: Number, default: 0 },
      carryOnBags: { type: Number, default: 1 },
      frequentFlyerNumber: { type: String }
    }],
    cabinClass: { type: String, enum: ['economy', 'premium_economy', 'business', 'first'] },
    baggage: {
      includedChecked: { type: Number, default: 0 },
      includedCarryOn: { type: Number, default: 1 },
      extraChecked: { type: Number, default: 0 },
      extraCost: { type: Number, default: 0 }
    },
    pnr: { type: String }, // Passenger Name Record
    ticketNumber: { type: String },
    eTicketUrl: { type: String }
  },
  
  // Hotel details
  hotelDetails: {
    propertyId: { type: String },
    propertyName: { type: String, required: true },
    address: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      country: { type: String },
      postalCode: { type: String },
      latitude: { type: Number },
      longitude: { type: Number }
    },
    phone: { type: String },
    email: { type: String },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number },
    rooms: [{
      roomId: { type: String },
      roomType: { type: String, required: true },
      roomName: { type: String },
      guests: {
        adults: { type: Number, default: 1 },
        children: { type: Number, default: 0 },
        infants: { type: Number, default: 0 }
      },
      guestNames: [{ type: String }],
      bedType: { type: String },
      boardBasis: { type: String, enum: ['room_only', 'breakfast', 'half_board', 'full_board', 'all_inclusive'] },
      cancellationPolicy: {
        freeUntil: { type: Date },
        penaltyAfter: { type: String },
        nonRefundable: { type: Boolean, default: false }
      },
      specialRequests: { type: String },
      pricePerNight: { type: Number },
      totalRoomPrice: { type: Number }
    }],
    ratePlan: { type: String },
    confirmationNumber: { type: String },
    cancellationPolicy: {
      freeUntil: { type: Date },
      penaltyAmount: { type: Number },
      nonRefundable: { type: Boolean, default: false }
    },
    amenities: [{ type: String }],
    checkInTime: { type: String, default: '15:00' },
    checkOutTime: { type: String, default: '11:00' }
  },
  
  // Car rental details
  carDetails: {
    company: { type: String, required: true },
    companyCode: { type: String },
    vehicleType: { type: String, required: true },
    vehicleName: { type: String },
    vehicleCategory: { type: String, enum: ['economy', 'compact', 'midsize', 'fullsize', 'luxury', 'suv', 'van'] },
    transmission: { type: String, enum: ['manual', 'automatic'] },
    fuelType: { type: String },
    passengers: { type: Number },
    luggageCapacity: { type: Number },
    pickup: {
      location: { type: String, required: true },
      locationCode: { type: String },
      address: { type: String },
      datetime: { type: Date, required: true },
      isAirport: { type: Boolean, default: false },
      terminal: { type: String }
    },
    dropoff: {
      location: { type: String, required: true },
      locationCode: { type: String },
      address: { type: String },
      datetime: { type: Date, required: true },
      isAirport: { type: Boolean, default: false },
      terminal: { type: String }
    },
    driver: {
      title: { type: String },
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      dateOfBirth: { type: Date },
      licenseNumber: { type: String },
      licenseCountry: { type: String },
      licenseExpiry: { type: Date },
      phone: { type: String },
      email: { type: String }
    },
    additionalDrivers: [{
      title: { type: String },
      firstName: { type: String },
      lastName: { type: String },
      dateOfBirth: { type: Date },
      licenseNumber: { type: String },
      licenseCountry: { type: String },
      licenseExpiry: { type: Date }
    }],
    extras: [{
      name: { type: String },
      price: { type: Number },
      quantity: { type: Number }
    }],
    insurance: {
      included: { type: Boolean, default: false },
      type: { type: String },
      coverage: { type: String },
      excess: { type: Number }
    },
    mileage: {
      unlimited: { type: Boolean, default: true },
      limit: { type: Number },
      additionalCost: { type: Number }
    },
    fuelPolicy: { type: String, enum: ['full_to_full', 'full_to_empty', 'same_to_same'] },
    confirmationNumber: { type: String },
    cancellationPolicy: {
      freeUntil: { type: Date },
      penaltyAmount: { type: Number }
    }
  },
  
  // Insurance details
  insuranceDetails: {
    provider: { type: String, required: true },
    providerCode: { type: String },
    policyType: { type: String, enum: ['trip_cancellation', 'medical', 'comprehensive', 'evacuation', 'baggage'] },
    policyNumber: { type: String },
    coverage: {
      medical: { type: Number }, // coverage amount
      tripCancellation: { type: Number },
      baggage: { type: Number },
      evacuation: { type: Number },
      delay: { type: Number }
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    travelers: [{
      travelerId: { type: String },
      firstName: { type: String },
      lastName: { type: String },
      dateOfBirth: { type: Date }
    }],
    destination: { type: String },
    documentsUrl: { type: String },
    termsUrl: { type: String }
  },
  
  // Pricing information
  pricing: {
    currency: { type: String, required: true, default: 'USD' },
    subtotal: { type: Number, required: true },
    taxes: { type: Number, default: 0 },
    fees: {
      bookingFee: { type: Number, default: 0 },
      serviceFee: { type: Number, default: 0 },
      paymentFee: { type: Number, default: 0 }
    },
    discounts: {
      promoCode: { type: String },
      discountAmount: { type: Number, default: 0 },
      loyaltyPointsUsed: { type: Number, default: 0 },
      loyaltyDiscount: { type: Number, default: 0 }
    },
    total: { type: Number, required: true },
    
    // Commission tracking
    commission: {
      amount: { type: Number, default: 0 },
      percentage: { type: Number, default: 0 },
      currency: { type: String, default: 'USD' }
    },
    netAmount: { type: Number }, // total - commission
    
    // Payment status
    paymentStatus: { 
      type: String, 
      enum: ['pending', 'authorized', 'paid', 'partially_refunded', 'fully_refunded', 'failed'],
      default: 'pending'
    },
    paidAmount: { type: Number, default: 0 },
    refundedAmount: { type: Number, default: 0 }
  },
  
  // Payment information
  payment: {
    method: { 
      type: String, 
      enum: ['stripe', 'paypal', 'card', 'bank_transfer', 'apple_pay', 'google_pay', 'klarna', 'affirm'],
      required: true 
    },
    stripePaymentIntentId: { type: String },
    stripeCustomerId: { type: String },
    paypalOrderId: { type: String },
    paypalPayerId: { type: String },
    transactionId: { type: String },
    lastFourDigits: { type: String },
    cardBrand: { type: String },
    paidAt: { type: Date },
    refundedAt: { type: Date },
    refundReason: { type: String },
    billingAddress: {
      firstName: { type: String },
      lastName: { type: String },
      address1: { type: String },
      address2: { type: String },
      city: { type: String },
      state: { type: String },
      postalCode: { type: String },
      country: { type: String }
    }
  },
  
  // OTA / Source information
  source: {
    ota: { 
      type: String, 
      enum: ['booking.com', 'expedia', 'hotels.com', 'kayak', 'skyscanner', 'trip.com', 'agoda', 'direct']
    },
    affiliateId: { type: String },
    campaignId: { type: String },
    trackingId: { type: String },
    directBooking: { type: Boolean, default: true }
  },
  
  // Contact information
  contact: {
    email: { type: String, required: true },
    phone: { type: String },
    countryCode: { type: String },
    marketingConsent: { type: Boolean, default: false }
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }, // for pending bookings
  cancelledAt: { type: Date },
  cancellationReason: { type: String },
  completedAt: { type: Date },
  confirmedAt: { type: Date },
  
  // Additional metadata
  metadata: {
    userAgent: { type: String },
    ipAddress: { type: String },
    notes: { type: String },
    tags: [{ type: String }]
  }
};

/**
 * Booking Model Class
 * In-memory implementation with support for persistent storage
 */
class Booking {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.userId = data.userId;
    this.bookingReference = data.bookingReference || generateBookingReference();
    this.type = data.type;
    this.status = data.status || 'pending';
    
    // Initialize nested objects
    this.flightDetails = data.flightDetails || null;
    this.hotelDetails = data.hotelDetails || null;
    this.carDetails = data.carDetails || null;
    this.insuranceDetails = data.insuranceDetails || null;
    
    this.pricing = data.pricing || {};
    this.payment = data.payment || {};
    this.source = data.source || { directBooking: true };
    this.contact = data.contact || {};
    
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.expiresAt = data.expiresAt || this.calculateExpiry();
    this.cancelledAt = data.cancelledAt || null;
    this.cancellationReason = data.cancellationReason || null;
    this.completedAt = data.completedAt || null;
    this.confirmedAt = data.confirmedAt || null;
    
    this.metadata = data.metadata || {};
  }
  
  /**
   * Calculate booking expiry (15 minutes for pending bookings)
   */
  calculateExpiry() {
    const expiry = new Date(this.createdAt);
    expiry.setMinutes(expiry.getMinutes() + 15);
    return expiry;
  }
  
  /**
   * Confirm the booking after successful payment
   */
  confirm() {
    this.status = 'confirmed';
    this.confirmedAt = new Date();
    this.updatedAt = new Date();
    this.pricing.paymentStatus = 'paid';
    this.payment.paidAt = new Date();
    this.expiresAt = null;
  }
  
  /**
   * Cancel the booking
   */
  cancel(reason = 'user_request') {
    this.status = 'cancelled';
    this.cancelledAt = new Date();
    this.updatedAt = new Date();
    this.cancellationReason = reason;
  }
  
  /**
   * Mark booking as completed
   */
  complete() {
    this.status = 'completed';
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }
  
  /**
   * Process refund
   */
  refund(amount, reason) {
    this.pricing.refundedAmount = (this.pricing.refundedAmount || 0) + amount;
    this.pricing.paidAmount = (this.pricing.paidAmount || this.pricing.total) - amount;
    
    if (this.pricing.refundedAmount >= this.pricing.total) {
      this.pricing.paymentStatus = 'fully_refunded';
      this.status = 'refunded';
    } else {
      this.pricing.paymentStatus = 'partially_refunded';
    }
    
    this.payment.refundedAt = new Date();
    this.payment.refundReason = reason;
    this.updatedAt = new Date();
  }
  
  /**
   * Get summary for display
   */
  getSummary() {
    const summary = {
      id: this.id,
      bookingReference: this.bookingReference,
      type: this.type,
      status: this.status,
      total: this.pricing.total,
      currency: this.pricing.currency,
      createdAt: this.createdAt,
      confirmedAt: this.confirmedAt
    };
    
    // Add type-specific summary
    if (this.type === 'flight' && this.flightDetails) {
      summary.title = `${this.flightDetails.outbound.departure.airportCode} → ${this.flightDetails.outbound.arrival.airportCode}`;
      summary.date = this.flightDetails.outbound.departure.datetime;
      summary.passengers = this.flightDetails.passengers?.length || 0;
    } else if (this.type === 'hotel' && this.hotelDetails) {
      summary.title = this.hotelDetails.propertyName;
      summary.date = this.hotelDetails.checkIn;
      summary.nights = this.hotelDetails.nights;
    } else if (this.type === 'car' && this.carDetails) {
      summary.title = `${this.carDetails.company} - ${this.carDetails.vehicleName}`;
      summary.date = this.carDetails.pickup.datetime;
    }
    
    return summary;
  }
  
  /**
   * Validate booking data
   */
  validate() {
    const errors = [];
    
    if (!this.userId) errors.push('User ID is required');
    if (!this.type) errors.push('Booking type is required');
    if (!this.pricing?.total) errors.push('Total price is required');
    if (!this.contact?.email) errors.push('Contact email is required');
    
    // Type-specific validation
    if (this.type === 'flight' && !this.flightDetails) {
      errors.push('Flight details required for flight booking');
    }
    if (this.type === 'hotel' && !this.hotelDetails) {
      errors.push('Hotel details required for hotel booking');
    }
    if (this.type === 'car' && !this.carDetails) {
      errors.push('Car details required for car booking');
    }
    
    return errors;
  }
  
  /**
   * Convert to JSON for storage
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      bookingReference: this.bookingReference,
      type: this.type,
      status: this.status,
      flightDetails: this.flightDetails,
      hotelDetails: this.hotelDetails,
      carDetails: this.carDetails,
      insuranceDetails: this.insuranceDetails,
      pricing: this.pricing,
      payment: this.payment,
      source: this.source,
      contact: this.contact,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      expiresAt: this.expiresAt,
      cancelledAt: this.cancelledAt,
      cancellationReason: this.cancellationReason,
      completedAt: this.completedAt,
      confirmedAt: this.confirmedAt,
      metadata: this.metadata
    };
  }
}

/**
 * Booking Repository for data persistence
 * In-memory implementation with MongoDB compatibility
 */
class BookingRepository {
  constructor(database = null) {
    this.db = database;
    this.bookings = new Map(); // In-memory storage
    this.bookingsByUser = new Map(); // Index by user
    this.bookingsByReference = new Map(); // Index by reference
  }
  
  /**
   * Create a new booking
   */
  async create(bookingData) {
    const booking = new Booking(bookingData);
    const errors = booking.validate();
    
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    // Store in memory
    this.bookings.set(booking.id, booking);
    
    // Index by user
    if (!this.bookingsByUser.has(booking.userId)) {
      this.bookingsByUser.set(booking.userId, new Set());
    }
    this.bookingsByUser.get(booking.userId).add(booking.id);
    
    // Index by reference
    this.bookingsByReference.set(booking.bookingReference, booking.id);
    
    // If MongoDB is available, also store there
    if (this.db) {
      try {
        await this.db.collection('bookings').insertOne(booking.toJSON());
      } catch (error) {
        console.error('Failed to store booking in MongoDB:', error);
      }
    }
    
    return booking;
  }
  
  /**
   * Find booking by ID
   */
  async findById(id) {
    // Check memory first
    if (this.bookings.has(id)) {
      return this.bookings.get(id);
    }
    
    // Check database if available
    if (this.db) {
      const data = await this.db.collection('bookings').findOne({ id });
      if (data) {
        const booking = new Booking(data);
        this.bookings.set(id, booking);
        return booking;
      }
    }
    
    return null;
  }
  
  /**
   * Find booking by reference number
   */
  async findByReference(reference) {
    const id = this.bookingsByReference.get(reference);
    if (id) {
      return this.findById(id);
    }
    
    if (this.db) {
      const data = await this.db.collection('bookings').findOne({ bookingReference: reference });
      if (data) {
        return new Booking(data);
      }
    }
    
    return null;
  }
  
  /**
   * Find all bookings for a user
   */
  async findByUser(userId, options = {}) {
    const { status, type, limit = 50, offset = 0 } = options;
    
    const userBookingIds = this.bookingsByUser.get(userId);
    if (!userBookingIds) return [];
    
    let bookings = Array.from(userBookingIds)
      .map(id => this.bookings.get(id))
      .filter(b => b !== undefined);
    
    // Apply filters
    if (status) {
      bookings = bookings.filter(b => b.status === status);
    }
    if (type) {
      bookings = bookings.filter(b => b.type === type);
    }
    
    // Sort by created date descending
    bookings.sort((a, b) => b.createdAt - a.createdAt);
    
    // Apply pagination
    return bookings.slice(offset, offset + limit);
  }
  
  /**
   * Update a booking
   */
  async update(id, updates) {
    const booking = await this.findById(id);
    if (!booking) return null;
    
    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'bookingReference') {
        booking[key] = updates[key];
      }
    });
    
    booking.updatedAt = new Date();
    
    // Update in database if available
    if (this.db) {
      await this.db.collection('bookings').updateOne(
        { id },
        { $set: updates, $currentDate: { updatedAt: true } }
      );
    }
    
    return booking;
  }
  
  /**
   * Delete a booking
   */
  async delete(id) {
    const booking = this.bookings.get(id);
    if (booking) {
      this.bookings.delete(id);
      this.bookingsByUser.get(booking.userId)?.delete(id);
      this.bookingsByReference.delete(booking.bookingReference);
    }
    
    if (this.db) {
      await this.db.collection('bookings').deleteOne({ id });
    }
    
    return true;
  }
  
  /**
   * Get expired pending bookings
   */
  async findExpired(now = new Date()) {
    const expired = [];
    for (const booking of this.bookings.values()) {
      if (booking.status === 'pending' && booking.expiresAt && booking.expiresAt < now) {
        expired.push(booking);
      }
    }
    return expired;
  }
  
  /**
   * Get booking statistics
   */
  async getStats(startDate, endDate) {
    const stats = {
      total: 0,
      byType: {},
      byStatus: {},
      revenue: 0,
      commission: 0
    };
    
    for (const booking of this.bookings.values()) {
      const createdAt = new Date(booking.createdAt);
      if (createdAt >= startDate && createdAt <= endDate) {
        stats.total++;
        stats.byType[booking.type] = (stats.byType[booking.type] || 0) + 1;
        stats.byStatus[booking.status] = (stats.byStatus[booking.status] || 0) + 1;
        
        if (booking.status === 'confirmed' || booking.status === 'completed') {
          stats.revenue += booking.pricing.total;
          stats.commission += booking.pricing.commission?.amount || 0;
        }
      }
    }
    
    return stats;
  }
}

module.exports = {
  Booking,
  BookingRepository,
  BookingSchema,
  generateBookingReference
};