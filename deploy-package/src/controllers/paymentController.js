/**
 * Payment Controller
 * Handles payment processing with Stripe and PayPal
 */

const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');
const { Payment, PaymentRepository, PaymentStatus } = require('../models/Payment');
const { BookingRepository } = require('../models/Booking');

class PaymentController {
  constructor(database = null) {
    this.paymentRepository = new PaymentRepository(database);
    this.bookingRepository = new BookingRepository(database);
  }
  
  /**
   * Create a payment intent (Stripe)
   * POST /api/payments/create-intent
   */
  async createPaymentIntent(req, res, next) {
    try {
      const { bookingId, paymentMethod, billingAddress, savePaymentMethod } = req.body;
      const userId = req.user?.id || req.body.userId;
      
      // Validate booking
      const booking = await this.bookingRepository.findById(bookingId);
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
      
      // Check if already paid
      const existingPayment = await this.paymentRepository.findByBooking(bookingId);
      if (existingPayment && existingPayment.status === PaymentStatus.COMPLETED) {
        return res.status(400).json({
          success: false,
          error: 'Payment already completed for this booking'
        });
      }
      
      // Calculate total in cents
      const amount = Math.round(booking.pricing.total * 100);
      const currency = booking.pricing.currency.toLowerCase();
      
      let paymentData = {
        bookingId,
        userId,
        amount: booking.pricing.total,
        currency: booking.pricing.currency,
        method: paymentMethod || 'stripe',
        billingAddress,
        billingEmail: booking.contact.email,
        description: `Nexvoy booking ${booking.bookingReference}`,
        metadata: {
          bookingReference: booking.bookingReference,
          bookingType: booking.type,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      };

      // Create or retrieve Stripe customer if savePaymentMethod is true
      let stripeCustomerId = null;
      if (savePaymentMethod && booking.contact.email) {
        const customer = await stripeService.createCustomer({
          email: booking.contact.email,
          name: billingAddress ? `${billingAddress.firstName} ${billingAddress.lastName}` : null,
          metadata: { userId, bookingId }
        });
        stripeCustomerId = customer.id;
        paymentData.stripeCustomerId = stripeCustomerId;
      }
      
      // Default: Stripe PaymentIntent
      const paymentIntent = await stripeService.createPaymentIntent({
        amount,
        currency,
        metadata: {
          bookingId,
          bookingReference: booking.bookingReference,
          userId
        },
        receipt_email: booking.contact.email,
        customer: stripeCustomerId,
        automatic_payment_methods: { enabled: true }
      });
      
      paymentData.stripePaymentIntentId = paymentIntent.id;
      paymentData.threeDSecure = {
        required: paymentIntent.charges?.data[0]?.payment_method_details?.card?.three_d_secure?.succeeded === false
      };
      
      // Create payment record
      const payment = await this.paymentRepository.create(paymentData);
      
      res.json({
        success: true,
        data: {
          provider: 'stripe',
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          paymentId: payment.id,
          amount: booking.pricing.total,
          currency: booking.pricing.currency,
          requires3DSecure: payment.threeDSecure.required,
          stripeCustomerId
        }
      });
    } catch (error) {
      console.error('Create payment intent error:', error);
      next(error);
    }
  }
  
  /**
   * Confirm payment after success
   * POST /api/payments/confirm
   */
  async confirmPayment(req, res, next) {
    try {
      const { paymentIntentId, paymentMethodId } = req.body;
      
      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          error: 'Payment intent ID required'
        });
      }
      
      // Retrieve payment intent from Stripe
      const stripePayment = await stripeService.retrievePaymentIntent(paymentIntentId);
      
      if (stripePayment.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          error: 'Payment not successful',
          status: stripePayment.status
        });
      }
      
      const payment = await this.paymentRepository.findByProviderId('stripe', paymentIntentId);
      
      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment record not found'
        });
      }
      
      // Get charge details
      const charge = stripePayment.charges.data[0];
      
      const providerData = {
        stripeChargeId: charge?.id,
        receiptUrl: charge?.receipt_url,
        receiptNumber: charge?.receipt_number
      };
      
      // Update payment status
      payment.complete(providerData);
      await this.paymentRepository.update(payment.id, {
        status: payment.status,
        completedAt: payment.completedAt,
        stripeChargeId: payment.stripeChargeId,
        receiptUrl: payment.receiptUrl,
        receiptNumber: payment.receiptNumber,
        cardDetails: charge?.payment_method_details?.card ? {
          brand: charge.payment_method_details.card.brand,
          lastFourDigits: charge.payment_method_details.card.last4,
          country: charge.payment_method_details.card.country
        } : null
      });
      
      // Update booking payment status
      const booking = await this.bookingRepository.findById(payment.bookingId);
      if (booking) {
        booking.confirm();
        await this.bookingRepository.update(payment.bookingId, {
          'pricing.paymentStatus': 'paid',
          status: 'confirmed',
          confirmedAt: booking.confirmedAt
        });
        
        // Send confirmation emails
        const user = { 
          email: payment.billingEmail, 
          name: billingAddress ? `${billingAddress.firstName} ${billingAddress.lastName}` : null 
        };
        await emailService.sendBookingConfirmation(booking, payment, user);
        await emailService.sendPaymentReceipt(payment, booking, user);
        
        if (booking.type === 'flight') {
          await emailService.sendETicket(booking, user);
        }
      }
      
      res.json({
        success: true,
        data: {
          payment: payment.getSummary(),
          bookingId: payment.bookingId,
          receiptUrl: payment.receiptUrl
        },
        message: 'Payment confirmed successfully'
      });
    } catch (error) {
      console.error('Confirm payment error:', error);
      next(error);
    }
  }
  
  /**
   * Get payment by ID
   * GET /api/payments/:id/status
   */
  async getPaymentById(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const payment = await this.paymentRepository.findById(id);
      
      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found'
        });
      }
      
      // Check ownership
      if (payment.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // If payment is still processing, check latest status from Stripe
      if (payment.stripePaymentIntentId && 
          (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.PROCESSING)) {
        try {
          const stripePayment = await stripeService.retrievePaymentIntent(payment.stripePaymentIntentId);
          
          // Update if status changed
          if (stripePayment.status === 'succeeded' && payment.status !== PaymentStatus.COMPLETED) {
            payment.complete({
              stripeChargeId: stripePayment.charges.data[0]?.id,
              receiptUrl: stripePayment.charges.data[0]?.receipt_url,
              receiptNumber: stripePayment.charges.data[0]?.receipt_number
            });
            await this.paymentRepository.update(payment.id, {
              status: payment.status,
              completedAt: payment.completedAt,
              stripeChargeId: payment.stripeChargeId,
              receiptUrl: payment.receiptUrl,
              receiptNumber: payment.receiptNumber
            });
          }
        } catch (stripeError) {
          console.error('Error checking Stripe status:', stripeError);
        }
      }
      
      res.json({
        success: true,
        data: {
          payment: payment.getSummary(),
          details: {
            receiptUrl: payment.receiptUrl,
            receiptNumber: payment.receiptNumber,
            createdAt: payment.createdAt,
            completedAt: payment.completedAt,
            refundedAt: payment.refundedAt,
            canRefund: payment.canRefund(),
            totalRefunded: payment.getTotalRefunded()
          }
        }
      });
    } catch (error) {
      console.error('Get payment by ID error:', error);
      next(error);
    }
  }
  
  /**
   * Get payment status
   * GET /api/payments/booking/:bookingId
   */
  async getPaymentStatus(req, res, next) {
    try {
      const { bookingId } = req.params;
      const userId = req.user?.id;
      
      const booking = await this.bookingRepository.findById(bookingId);
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
      
      const payment = await this.paymentRepository.findByBooking(bookingId);
      
      res.json({
        success: true,
        data: {
          bookingId,
          paymentStatus: payment ? payment.status : 'pending',
          payment: payment ? payment.getSummary() : null
        }
      });
    } catch (error) {
      console.error('Get payment status error:', error);
      next(error);
    }
  }
  
  /**
   * Process refund
   * POST /api/payments/refund
   */
  async processRefund(req, res, next) {
    try {
      const { paymentId, amount, reason } = req.body;
      const userId = req.user?.id;
      
      const payment = await this.paymentRepository.findById(paymentId);
      
      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found'
        });
      }
      
      // Check if user has permission (owner or admin)
      if (payment.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // Check if can be refunded
      if (!payment.canRefund()) {
        return res.status(400).json({
          success: false,
          error: `Payment cannot be refunded. Current status: ${payment.status}`
        });
      }
      
      const refundAmount = amount || payment.amount;
      
      // Process refund through Stripe
      if (payment.method === 'stripe' && payment.stripePaymentIntentId) {
        await stripeService.createRefund({
          payment_intent: payment.stripePaymentIntentId,
          amount: Math.round(refundAmount * 100),
          reason: 'requested_by_customer',
          metadata: { reason: reason || 'Customer request' }
        });
      } else if (payment.stripeChargeId) {
        await stripeService.createRefund({
          charge: payment.stripeChargeId,
          amount: Math.round(refundAmount * 100),
          reason: 'requested_by_customer',
          metadata: { reason: reason || 'Customer request' }
        });
      }
      
      // Update payment record
      if (refundAmount >= payment.amount) {
        payment.refund(reason);
      } else {
        payment.partialRefund(refundAmount, reason);
      }
      
      await this.paymentRepository.update(paymentId, {
        status: payment.status,
        refundedAt: payment.refundedAt,
        refundDetails: payment.refundDetails,
        partialRefunds: payment.partialRefunds
      });
      
      // Update booking
      await this.bookingRepository.update(payment.bookingId, {
        'pricing.paymentStatus': payment.status === 'refunded' ? 'fully_refunded' : 'partially_refunded',
        'pricing.refundedAmount': payment.getTotalRefunded()
      });
      
      // Send refund confirmation email
      const booking = await this.bookingRepository.findById(payment.bookingId);
      if (booking) {
        const user = { email: payment.billingEmail };
        await emailService.sendRefundConfirmation(payment, booking, refundAmount);
      }
      
      res.json({
        success: true,
        data: {
          payment: payment.getSummary(),
          refundAmount
        },
        message: 'Refund processed successfully'
      });
    } catch (error) {
      console.error('Process refund error:', error);
      next(error);
    }
  }
  
  /**
   * Get saved payment methods for user
   * GET /api/payments/methods
   */
  async getSavedMethods(req, res, next) {
    try {
      const userId = req.user?.id;
      const { stripeCustomerId } = req.query;
      
      if (!stripeCustomerId) {
        return res.json({
          success: true,
          data: {
            methods: []
          }
        });
      }
      
      const methods = await stripeService.listPaymentMethods(stripeCustomerId);
      
      res.json({
        success: true,
        data: {
          methods: methods.data.map(method => ({
            id: method.id,
            type: method.type,
            card: method.card ? {
              brand: method.card.brand,
              last4: method.card.last4,
              expMonth: method.card.exp_month,
              expYear: method.card.exp_year
            } : null
          }))
        }
      });
    } catch (error) {
      console.error('Get saved methods error:', error);
      next(error);
    }
  }
  
  /**
   * Save payment method
   * POST /api/payments/methods
   */
  async savePaymentMethod(req, res, next) {
    try {
      const { paymentMethodId, stripeCustomerId } = req.body;
      const userId = req.user?.id;
      
      if (!paymentMethodId) {
        return res.status(400).json({
          success: false,
          error: 'Payment method ID required'
        });
      }
      
      let customerId = stripeCustomerId;
      
      // Create customer if doesn't exist
      if (!customerId) {
        const customer = await stripeService.createCustomer({
          email: req.user?.email,
          metadata: { userId }
        });
        customerId = customer.id;
      }
      
      // Attach payment method to customer
      const paymentMethod = await stripeService.attachPaymentMethod(paymentMethodId, customerId);
      
      res.json({
        success: true,
        data: {
          paymentMethod: {
            id: paymentMethod.id,
            type: paymentMethod.type,
            card: paymentMethod.card ? {
              brand: paymentMethod.card.brand,
              last4: paymentMethod.card.last4,
              expMonth: paymentMethod.card.exp_month,
              expYear: paymentMethod.card.exp_year
            } : null
          },
          stripeCustomerId: customerId
        },
        message: 'Payment method saved'
      });
    } catch (error) {
      console.error('Save payment method error:', error);
      next(error);
    }
  }
}

module.exports = PaymentController;
