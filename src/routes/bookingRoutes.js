/**
 * Booking Routes
 * Handles booking CRUD operations
 */

const express = require('express');
const { BookingRepository } = require('../models/Booking');
const { PaymentRepository } = require('../models/Payment');
const { ReceiptRepository } = require('../models/Receipt');
const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');

function createBookingRoutes(database = null) {
  const router = express.Router();
  const bookingRepo = new BookingRepository(database);
  const paymentRepo = new PaymentRepository(database);
  const receiptRepo = new ReceiptRepository(database);
  
  /**
   * Get all bookings for user
   * GET /api/bookings
   */
  router.get('/', async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const { status, type, limit = 50, offset = 0 } = req.query;
      
      const bookings = await bookingRepo.findByUser(userId, {
        status,
        type,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.json({
        success: true,
        data: bookings.map(b => b.getSummary()),
        meta: {
          total: bookings.length,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Create new booking
   * POST /api/bookings
   */
  router.post('/', async (req, res, next) => {
    try {
      const userId = req.user?.id || req.body.userId;
      const bookingData = { ...req.body, userId };
      
      const booking = await bookingRepo.create(bookingData);
      
      res.status(201).json({
        success: true,
        data: booking.getSummary(),
        message: 'Booking created successfully'
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Get booking by ID
   * GET /api/bookings/:id
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const booking = await bookingRepo.findById(id);
      
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }
      
      if (booking.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      // Get associated payment
      const payment = await paymentRepo.findByBooking(id);
      
      // Get associated receipt
      const receipt = await receiptRepo.findByBooking(id);
      
      res.json({
        success: true,
        data: {
          ...booking.toJSON(),
          payment: payment ? payment.getSummary() : null,
          receipt: receipt ? receipt.getSummary() : null
        }
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Get booking by reference
   * GET /api/bookings/reference/:reference
   */
  router.get('/reference/:reference', async (req, res, next) => {
    try {
      const { reference } = req.params;
      const userId = req.user?.id;
      
      const booking = await bookingRepo.findByReference(reference);
      
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }
      
      if (booking.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      res.json({
        success: true,
        data: booking.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Update booking
   * PUT /api/bookings/:id
   */
  router.put('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const updates = req.body;
      
      const booking = await bookingRepo.findById(id);
      
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }
      
      if (booking.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      // Don't allow updates to confirmed bookings except for specific fields
      if (booking.status === 'confirmed' && !req.user?.isAdmin) {
        const allowedUpdates = ['contact', 'metadata.notes'];
        const attemptedUpdates = Object.keys(updates);
        const invalidUpdates = attemptedUpdates.filter(key => !allowedUpdates.includes(key));
        
        if (invalidUpdates.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'Cannot modify confirmed booking except for contact information'
          });
        }
      }
      
      const updatedBooking = await bookingRepo.update(id, updates);
      
      res.json({
        success: true,
        data: updatedBooking.getSummary(),
        message: 'Booking updated successfully'
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Cancel booking
   * DELETE /api/bookings/:id
   */
  router.delete('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { reason } = req.body;
      
      const booking = await bookingRepo.findById(id);
      
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }
      
      if (booking.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      // Check if booking can be cancelled
      if (booking.status === 'cancelled') {
        return res.status(400).json({ success: false, error: 'Booking already cancelled' });
      }
      
      if (booking.status === 'completed') {
        return res.status(400).json({ success: false, error: 'Cannot cancel completed booking' });
      }
      
      // Cancel the booking
      booking.cancel(reason || 'user_request');
      await bookingRepo.update(id, {
        status: 'cancelled',
        cancelledAt: booking.cancelledAt,
        cancellationReason: booking.cancellationReason
      });
      
      // If payment was made, process refund
      if (booking.pricing.paymentStatus === 'paid') {
        const payment = await paymentRepo.findByBooking(id);
        if (payment && payment.canRefund()) {
          // Process refund through Stripe
          if (payment.stripePaymentIntentId) {
            await stripeService.createRefund({
              payment_intent: payment.stripePaymentIntentId,
              reason: 'requested_by_customer',
              metadata: { bookingId: id, reason: reason || 'Cancellation' }
            });
          }
          
          payment.refund(reason || 'booking_cancelled');
          await paymentRepo.update(payment.id, {
            status: payment.status,
            refundedAt: payment.refundedAt,
            refundDetails: payment.refundDetails
          });
          
          // Update booking refund status
          await bookingRepo.update(id, {
            'pricing.paymentStatus': 'fully_refunded',
            'pricing.refundedAmount': booking.pricing.total
          });
          
          // Send refund confirmation
          await emailService.sendRefundConfirmation(payment, booking, booking.pricing.total);
        }
      }
      
      res.json({
        success: true,
        data: booking.getSummary(),
        message: 'Booking cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Download e-ticket PDF
   * GET /api/bookings/:id/ticket
   */
  router.get('/:id/ticket', async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const booking = await bookingRepo.findById(id);
      
      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }
      
      if (booking.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      if (booking.type !== 'flight') {
        return res.status(400).json({ success: false, error: 'E-tickets only available for flight bookings' });
      }
      
      if (booking.status !== 'confirmed' && booking.status !== 'completed') {
        return res.status(400).json({ success: false, error: 'Booking must be confirmed to download e-ticket' });
      }
      
      // Generate e-ticket HTML
      const html = generateETicketHTML(booking);
      
      // Set headers for download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="ticket-${booking.bookingReference}.pdf"`);
      
      res.send(html);
    } catch (error) {
      next(error);
    }
  });
  
  return router;
}

/**
 * Generate e-ticket HTML
 */
function generateETicketHTML(booking) {
  const flight = booking.flightDetails;
  const outbound = flight.outbound;
  const returnFlight = flight.return;
  
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };
  
  const formatDateTime = (datetime) => {
    const date = new Date(datetime);
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };
  
  const outboundDep = formatDateTime(outbound.departure.datetime);
  const outboundArr = formatDateTime(outbound.arrival.datetime);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>E-Ticket ${booking.bookingReference}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
        .ticket-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
        .ticket-header h1 { margin: 0; font-size: 28px; }
        .ticket-body { border: 3px solid #667eea; border-top: none; padding: 30px; border-radius: 0 0 10px 10px; }
        .booking-ref { background: #f0f0f0; padding: 15px; text-align: center; margin: 20px 0; border-radius: 5px; }
        .booking-ref-label { font-size: 12px; color: #666; }
        .booking-ref-number { font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #667eea; }
        .flight-segment { background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; }
        .flight-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .airline { font-size: 20px; font-weight: bold; color: #333; }
        .flight-number { font-size: 16px; color: #667eea; }
        .route { display: flex; align-items: center; justify-content: space-between; margin: 20px 0; }
        .airport { text-align: center; }
        .airport-code { font-size: 48px; font-weight: bold; color: #667eea; }
        .airport-name { font-size: 14px; color: #666; }
        .arrow { font-size: 32px; color: #999; }
        .datetime { text-align: center; margin-top: 10px; }
        .date { font-size: 16px; color: #333; }
        .time { font-size: 24px; font-weight: bold; color: #667eea; }
        .passengers { margin-top: 30px; }
        .passenger { background: #fff; padding: 15px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; }
        .passenger-name { font-size: 18px; font-weight: bold; }
        .passenger-details { font-size: 14px; color: #666; margin-top: 5px; }
        .barcode { text-align: center; margin: 30px 0; padding: 20px; background: #f0f0f0; }
        .barcode-placeholder { font-family: monospace; font-size: 48px; letter-spacing: 5px; }
        .important-info { background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px; }
        .important-info h3 { margin-top: 0; color: #856404; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="ticket-header">
        <h1>✈️ BOARDING PASS</h1>
        <p>Nexvoy E-Ticket</p>
      </div>
      
      <div class="ticket-body">
        <div class="booking-ref">
          <div class="booking-ref-label">BOOKING REFERENCE</div>
          <div class="booking-ref-number">${booking.bookingReference}</div>
        </div>
        
        <div class="flight-segment">
          <div class="flight-header">
            <span class="airline">${outbound.airline}</span>
            <span class="flight-number">${outbound.flightNumber}</span>
          </div>
          
          <div class="route">
            <div class="airport">
              <div class="airport-code">${outbound.departure.airportCode}</div>
              <div class="airport-name">${outbound.departure.airport}</div>
              <div class="datetime">
                <div class="date">${outboundDep.date}</div>
                <div class="time">${outboundDep.time}</div>
              </div>
            </div>
            <div class="arrow">✈️</div>
            <div class="airport">
              <div class="airport-code">${outbound.arrival.airportCode}</div>
              <div class="airport-name">${outbound.arrival.airport}</div>
              <div class="datetime">
                <div class="date">${outboundArr.date}</div>
                <div class="time">${outboundArr.time}</div>
              </div>
            </div>
          </div>
          
          <p><strong>Duration:</strong> ${formatDuration(outbound.duration)} | <strong>Class:</strong> ${flight.cabinClass || 'Economy'}</p>
          ${outbound.terminal ? `<p><strong>Terminal:</strong> ${outbound.terminal}</p>` : ''}
        </div>
        
        ${returnFlight ? `
          <div class="flight-segment">
            <div class="flight-header">
              <span class="airline">${returnFlight.airline}</span>
              <span class="flight-number">${returnFlight.flightNumber}</span>
            </div>
            <p style="text-align: center; color: #666;">Return Flight</p>
          </div>
        ` : ''}
        
        <div class="passengers">
          <h3>Passengers</h3>
          ${flight.passengers?.map((p, i) => `
            <div class="passenger">
              <div class="passenger-name">${p.title || ''} ${p.firstName} ${p.lastName}</div>
              <div class="passenger-details">
                Type: ${p.type || 'Adult'} | 
                ${p.seatNumber ? `Seat: ${p.seatNumber} | ` : ''}
                ${p.checkedBags ? `Checked Bags: ${p.checkedBags} | ` : ''}
                Ticket: ${booking.bookingReference}-${String(i + 1).padStart(3, '0')}
              </div>
            </div>
          `).join('') || '<p>No passenger details available</p>'}
        </div>
        
        <div class="barcode">
          <div class="barcode-placeholder">||||||||||||||||</div>
          <p style="font-size: 12px; color: #666;">Scan at airport check-in</p>
        </div>
        
        <div class="important-info">
          <h3>⚠️ Important Information</h3>
          <ul>
            <li>Arrive at the airport at least 2 hours before domestic flights and 3 hours before international flights</li>
            <li>Bring a valid passport or government-issued ID</li>
            <li>Check your airline's baggage allowance before packing</li>
            <li>Verify terminal and gate information on airport displays</li>
          </ul>
        </div>
        
        <div class="footer">
          <p>This e-ticket was issued by Nexvoy on ${new Date().toLocaleDateString()}</p>
          <p>For support, contact support@nexvoy.com or call +1 (555) 123-4567</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = createBookingRoutes;
