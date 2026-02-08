/**
 * Booking Service
 * Handles booking operations, stats, and affiliate management
 */

class BookingService {
  constructor(database = null) {
    this.db = database;
    this.bookings = new Map();
    this.affiliates = new Map();
    
    // Seed sample affiliates
    this.affiliates.set('expedia', {
      id: 'expedia',
      name: 'Expedia',
      commission: 0.08,
      active: true
    });
    this.affiliates.set('bookingcom', {
      id: 'bookingcom', 
      name: 'Booking.com',
      commission: 0.06,
      active: true
    });
  }

  /**
   * Get booking statistics
   */
  async getStats(userId) {
    return {
      total: this.bookings.size,
      completed: 0,
      pending: 0,
      cancelled: 0,
      revenue: 0
    };
  }

  /**
   * Get all affiliates
   */
  async getAffiliates() {
    return Array.from(this.affiliates.values());
  }

  /**
   * Create a new booking
   */
  async createBooking(bookingData) {
    const id = `booking-${Date.now()}`;
    const booking = {
      id,
      ...bookingData,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.bookings.set(id, booking);
    return booking;
  }

  /**
   * Get booking by ID
   */
  async getBooking(id) {
    return this.bookings.get(id) || null;
  }

  /**
   * Get all bookings for a user
   */
  async getUserBookings(userId) {
    return Array.from(this.bookings.values())
      .filter(b => b.userId === userId);
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(id) {
    const booking = this.bookings.get(id);
    if (booking) {
      booking.status = 'cancelled';
      return booking;
    }
    return null;
  }
}

module.exports = BookingService;
