/**
 * Booking Controller
 * Handles all booking operations
 */

const { BookingRepository } = require('../models/Booking');
const { PaymentRepository } = require('../models/Payment');
const emailService = require('../services/emailService');

class BookingController {
  constructor(database = null) {
    this.bookingRepository = new BookingRepository(database);
    this.paymentRepository = new PaymentRepository(database);
  }
  
  /**
   * Create a new booking
   * POST /api/bookings
   */
  async createBooking(req, res, next) {
    try {
      const userId = req.user?.id || req.body.userId; // Fallback for testing
      const bookingData = req.body;
      
      // Validate required fields
      if (!bookingData.type) {
        return res.status(400).json({
          success: false,
          error: 'Booking type is required'
        });
      }
      
      if (!bookingData.contact?.email) {
        return res.status(400).json({
          success: false,
          error: 'Contact email is required'
        });
      }
      
      if (!bookingData.pricing?.total || bookingData.pricing.total <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid total price is required'
        });
      }
      
      // Create booking
      const booking = await this.bookingRepository.create({
        ...bookingData,
        userId,
        status: 'pending'
      });
      
      // Send confirmation email (async, don't wait)
      emailService.sendBookingConfirmation(booking).catch(console.error);
      
      res.status(201).json({
        success: true,
        data: {
          booking: booking.getSummary(),
          expiresAt: booking.expiresAt
        },
        message: 'Booking created successfully'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get booking by ID
   * GET /api/bookings/:id
   */
  async getBooking(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const booking = await this.bookingRepository.findById(id);
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }
      
      // Check ownership (unless admin)
      if (booking.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // Get associated payment
      const payment = await this.paymentRepository.findByBooking(id);
      
      res.json({
        success: true,
        data: {
          booking: booking.toJSON(),
          payment: payment ? payment.getSummary() : null
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get booking by reference number
   * GET /api/bookings/reference/:reference
   */
  async getBookingByReference(req, res, next) {
    try {
      const { reference } = req.params;
      const userId = req.user?.id;
      
      const booking = await this.bookingRepository.findByReference(reference);
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }
      
      // Check ownership (unless admin)
      if (booking.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      res.json({
        success: true,
        data: {
          booking: booking.toJSON()
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * List user bookings
   * GET /api/bookings/user/:userId
   */
  async getUserBookings(req, res, next) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user?.id;
      const { status, type, limit = 50, offset = 0 } = req.query;
      
      // Check ownership (unless admin)
      if (userId !== currentUserId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      const bookings = await this.bookingRepository.findByUser(userId, {
        status,
        type,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      const summaries = bookings.map(b => b.getSummary());
      
      res.json({
        success: true,
        data: {
          bookings: summaries,
          total: summaries.length,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Cancel a booking
   * PATCH /api/bookings/:id/cancel
   */
  async cancelBooking(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id;
      
      const booking = await this.bookingRepository.findById(id);
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }
      
      // Check ownership
      if (booking.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // Check if can be cancelled
      if (!['pending', 'confirmed'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          error: `Booking cannot be cancelled. Current status: ${booking.status}`
        });
      }
      
      // Check cancellation policy
      const cancellationFee = this.calculateCancellationFee(booking);
      
      // Cancel the booking
      booking.cancel(reason || 'user_request');
      await this.bookingRepository.update(id, {
        status: booking.status,
        cancelledAt: booking.cancelledAt,
        cancellationReason: booking.cancellationReason
      });
      
      // If payment was made, process refund
      const payment = await this.paymentRepository.findByBooking(id);
      if (payment && payment.canRefund()) {
        const refundAmount = booking.pricing.total - cancellationFee;
        
        // This would integrate with payment service for actual refund
        payment.partialRefund(refundAmount, reason);
        await this.paymentRepository.update(payment.id, {
          status: payment.status,
          refundDetails: payment.refundDetails,
          partialRefunds: payment.partialRefunds
        });
        
        // Send refund confirmation
        emailService.sendRefundConfirmation(booking, refundAmount).catch(console.error);
      }
      
      // Send cancellation confirmation
      emailService.sendCancellationConfirmation(booking).catch(console.error);
      
      res.json({
        success: true,
        data: {
          booking: booking.getSummary(),
          cancellationFee,
          refundAmount: booking.pricing.total - cancellationFee
        },
        message: 'Booking cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Modify a booking
   * PATCH /api/bookings/:id/modify
   */
  async modifyBooking(req, res, next) {
    try {
      const { id } = req.params;
      const modifications = req.body;
      const userId = req.user?.id;
      
      const booking = await this.bookingRepository.findById(id);
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }
      
      // Check ownership
      if (booking.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // Check if can be modified
      if (!['pending', 'confirmed'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          error: `Booking cannot be modified. Current status: ${booking.status}`
        });
      }
      
      // Apply allowed modifications
      const allowedUpdates = {};
      
      // Allow contact updates
      if (modifications.contact) {
        allowedUpdates.contact = { ...booking.contact, ...modifications.contact };
      }
      
      // Allow passenger/guest updates (for pending bookings)
      if (booking.status === 'pending') {
        if (modifications.flightDetails?.passengers) {
          allowedUpdates.flightDetails = {
            ...booking.flightDetails,
            passengers: modifications.flightDetails.passengers
          };
        }
        if (modifications.hotelDetails?.rooms) {
          allowedUpdates.hotelDetails = {
            ...booking.hotelDetails,
            rooms: modifications.hotelDetails.rooms
          };
        }
      }
      
      // Special requests
      if (modifications.specialRequests !== undefined) {
        allowedUpdates.specialRequests = modifications.specialRequests;
      }
      
      const updatedBooking = await this.bookingRepository.update(id, allowedUpdates);
      
      // Send modification confirmation
      emailService.sendModificationConfirmation(updatedBooking).catch(console.error);
      
      res.json({
        success: true,
        data: {
          booking: updatedBooking.getSummary()
        },
        message: 'Booking modified successfully'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Confirm booking after payment
   * POST /api/bookings/:id/confirm
   */
  async confirmBooking(req, res, next) {
    try {
      const { id } = req.params;
      const { paymentIntentId } = req.body;
      const userId = req.user?.id;
      
      const booking = await this.bookingRepository.findById(id);
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }
      
      // Check ownership
      if (booking.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // Check if can be confirmed
      if (booking.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: `Booking cannot be confirmed. Current status: ${booking.status}`
        });
      }
      
      // Verify payment if paymentIntentId provided
      if (paymentIntentId) {
        const payment = await this.paymentRepository.findByProviderId('stripe', paymentIntentId);
        if (!payment || payment.status !== 'completed') {
          return res.status(400).json({
            success: false,
            error: 'Payment not completed'
          });
        }
      }
      
      // Confirm booking
      booking.confirm();
      await this.bookingRepository.update(id, {
        status: booking.status,
        confirmedAt: booking.confirmedAt,
        updatedAt: booking.updatedAt,
        expiresAt: null,
        'pricing.paymentStatus': 'paid'
      });
      
      // Send confirmation email
      emailService.sendConfirmation(booking).catch(console.error);
      
      res.json({
        success: true,
        data: {
          booking: booking.getSummary()
        },
        message: 'Booking confirmed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Get booking statistics (admin only)
   * GET /api/bookings/stats
   */
  async getStats(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      
      if (!req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }
      
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();
      
      const stats = await this.bookingRepository.getStats(start, end);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Generate e-ticket/download
   * GET /api/bookings/:id/ticket
   */
  async getTicket(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const booking = await this.bookingRepository.findById(id);
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }
      
      // Check ownership
      if (booking.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // Only confirmed/completed bookings have tickets
      if (!['confirmed', 'completed'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          error: 'Ticket not available for this booking status'
        });
      }
      
      // Generate ticket data
      const ticketData = this.generateTicketData(booking);
      
      res.json({
        success: true,
        data: ticketData
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Calculate cancellation fee based on policy
   */
  calculateCancellationFee(booking) {
    // Check if within free cancellation period
    let freeUntil = null;
    
    if (booking.type === 'flight' && booking.flightDetails?.outbound?.departure) {
      const departure = new Date(booking.flightDetails.outbound.departure.datetime);
      // Typically 24 hours before departure for full refund
      freeUntil = new Date(departure.getTime() - 24 * 60 * 60 * 1000);
    } else if (booking.type === 'hotel' && booking.hotelDetails?.cancellationPolicy?.freeUntil) {
      freeUntil = new Date(booking.hotelDetails.cancellationPolicy.freeUntil);
    } else if (booking.type === 'car' && booking.carDetails?.cancellationPolicy?.freeUntil) {
      freeUntil = new Date(booking.carDetails.cancellationPolicy.freeUntil);
    }
    
    const now = new Date();
    
    // If still within free cancellation period
    if (freeUntil && now < freeUntil) {
      return 0;
    }
    
    // Check non-refundable
    if (booking.type === 'hotel' && booking.hotelDetails?.cancellationPolicy?.nonRefundable) {
      return booking.pricing.total;
    }
    
    // Default: 10% cancellation fee
    return booking.pricing.total * 0.10;
  }
  
  /**
   * Generate ticket/e-ticket data
   */
  generateTicketData(booking) {
    const base = {
      bookingReference: booking.bookingReference,
      type: booking.type,
      status: booking.status,
      issueDate: booking.confirmedAt,
      contact: booking.contact
    };
    
    if (booking.type === 'flight') {
      return {
        ...base,
        flightDetails: booking.flightDetails,
        qrCode: this.generateQRCode(booking),
        barcode: this.generateBarcode(booking)
      };
    } else if (booking.type === 'hotel') {
      return {
        ...base,
        hotelDetails: booking.hotelDetails,
        confirmationNumber: booking.hotelDetails?.confirmationNumber,
        qrCode: this.generateQRCode(booking)
      };
    } else if (booking.type === 'car') {
      return {
        ...base,
        carDetails: booking.carDetails,
        confirmationNumber: booking.carDetails?.confirmationNumber
      };
    }
    
    return base;
  }
  
  /**
   * Generate QR code data (placeholder)
   */
  generateQRCode(booking) {
    // In production, this would generate actual QR code
    return `NEXVOY:${booking.bookingReference}:${Date.now()}`;
  }
  
  /**
   * Generate barcode data (placeholder)
   */
  generateBarcode(booking) {
    // In production, this would generate actual barcode
    return booking.bookingReference;
  }
}

module.exports = BookingController;