/**
 * Stripe Webhook Handler
 * Processes Stripe webhook events
 */

const stripeService = require('../services/stripeService');
const emailService = require('../services/emailService');
const { PaymentRepository, PaymentStatus } = require('../models/Payment');
const { BookingRepository } = require('../models/Booking');

class StripeWebhookHandler {
  constructor(database = null) {
    this.paymentRepository = new PaymentRepository(database);
    this.bookingRepository = new BookingRepository(database);
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const payload = req.body;

    let event;

    try {
      event = stripeService.constructWebhookEvent(
        payload,
        sig,
        this.webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('Processing Stripe webhook:', event.type);

    try {
      // Handle the event
      switch (event.type) {
        case 'payment_intent.created':
          await this.handlePaymentIntentCreated(event.data.object);
          break;
        
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object);
          break;
        
        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(event.data.object);
          break;
        
        case 'charge.succeeded':
          await this.handleChargeSucceeded(event.data.object);
          break;
        
        case 'charge.failed':
          await this.handleChargeFailed(event.data.object);
          break;
        
        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object);
          break;
        
        case 'charge.dispute.created':
          await this.handleDisputeCreated(event.data.object);
          break;
        
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object);
          break;
        
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
        
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;
        
        case 'refund.created':
          await this.handleRefundCreated(event.data.object);
          break;
        
        case 'refund.updated':
          await this.handleRefundUpdated(event.data.object);
          break;
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle payment_intent.created
   */
  async handlePaymentIntentCreated(paymentIntent) {
    console.log('Payment intent created:', paymentIntent.id);
    
    // Record webhook event on the payment
    const payment = await this.paymentRepository.findByProviderId('stripe', paymentIntent.id);
    if (payment) {
      payment.recordWebhookEvent('payment_intent.created', {
        id: paymentIntent.id,
        status: paymentIntent.status
      });
      await this.paymentRepository.update(payment.id, {
        webhookEvents: payment.webhookEvents
      });
    }
  }

  /**
   * Handle payment_intent.succeeded
   */
  async handlePaymentIntentSucceeded(paymentIntent) {
    console.log('Payment intent succeeded:', paymentIntent.id);
    
    const payment = await this.paymentRepository.findByProviderId('stripe', paymentIntent.id);
    if (!payment) {
      console.error('Payment not found for intent:', paymentIntent.id);
      return;
    }

    // Update payment status
    payment.recordWebhookEvent('payment_intent.succeeded', {
      id: paymentIntent.id,
      status: paymentIntent.status
    });

    // Get charge details
    const charge = paymentIntent.charges.data[0];
    
    payment.complete({
      stripeChargeId: charge?.id,
      receiptUrl: charge?.receipt_url,
      receiptNumber: charge?.receipt_number
    });

    await this.paymentRepository.update(payment.id, {
      status: payment.status,
      completedAt: payment.completedAt,
      stripeChargeId: payment.stripeChargeId,
      receiptUrl: payment.receiptUrl,
      receiptNumber: payment.receiptNumber,
      webhookEvents: payment.webhookEvents
    });

    // Update booking
    const booking = await this.bookingRepository.findById(payment.bookingId);
    if (booking) {
      booking.confirm();
      await this.bookingRepository.update(booking.id, {
        status: 'confirmed',
        confirmedAt: booking.confirmedAt,
        'pricing.paymentStatus': 'paid'
      });

      // Send confirmation emails
      const user = { email: payment.billingEmail, name: booking.contact.email };
      await emailService.sendBookingConfirmation(booking, payment, user);
      await emailService.sendPaymentReceipt(payment, booking, user);
      
      if (booking.type === 'flight') {
        await emailService.sendETicket(booking, user);
      }
    }
  }

  /**
   * Handle payment_intent.payment_failed
   */
  async handlePaymentIntentFailed(paymentIntent) {
    console.log('Payment intent failed:', paymentIntent.id);
    
    const payment = await this.paymentRepository.findByProviderId('stripe', paymentIntent.id);
    if (!payment) return;

    const error = paymentIntent.last_payment_error;
    
    payment.fail(
      error?.message || 'Payment failed',
      error?.code || 'unknown',
      error?.decline_code || null
    );

    payment.recordWebhookEvent('payment_intent.payment_failed', {
      id: paymentIntent.id,
      error: error
    });

    await this.paymentRepository.update(payment.id, {
      status: payment.status,
      failedAt: payment.failedAt,
      errorMessage: payment.errorMessage,
      errorCode: payment.errorCode,
      declineCode: payment.declineCode,
      webhookEvents: payment.webhookEvents
    });
  }

  /**
   * Handle payment_intent.canceled
   */
  async handlePaymentIntentCanceled(paymentIntent) {
    console.log('Payment intent canceled:', paymentIntent.id);
    
    const payment = await this.paymentRepository.findByProviderId('stripe', paymentIntent.id);
    if (!payment) return;

    payment.cancel(paymentIntent.cancellation_reason || 'unknown');
    payment.recordWebhookEvent('payment_intent.canceled', {
      id: paymentIntent.id,
      reason: paymentIntent.cancellation_reason
    });

    await this.paymentRepository.update(payment.id, {
      status: payment.status,
      cancelledAt: payment.cancelledAt,
      webhookEvents: payment.webhookEvents
    });
  }

  /**
   * Handle charge.succeeded
   */
  async handleChargeSucceeded(charge) {
    console.log('Charge succeeded:', charge.id);
    
    // Additional processing if needed
    // Most handling is done in payment_intent.succeeded
  }

  /**
   * Handle charge.failed
   */
  async handleChargeFailed(charge) {
    console.log('Charge failed:', charge.id);
    
    // Additional processing if needed
  }

  /**
   * Handle charge.refunded
   */
  async handleChargeRefunded(charge) {
    console.log('Charge refunded:', charge.id);
    
    const payment = await this.paymentRepository.findByProviderId('stripe', charge.payment_intent);
    if (!payment) return;

    const refundAmount = charge.refunds.data.reduce((sum, r) => sum + r.amount, 0) / 100;
    
    if (refundAmount >= payment.amount) {
      payment.refund('refunded_via_webhook');
    } else {
      payment.partialRefund(refundAmount, 'partial_refund_via_webhook');
    }

    payment.recordWebhookEvent('charge.refunded', {
      chargeId: charge.id,
      refundAmount
    });

    await this.paymentRepository.update(payment.id, {
      status: payment.status,
      refundedAt: payment.refundedAt,
      refundDetails: payment.refundDetails,
      partialRefunds: payment.partialRefunds,
      webhookEvents: payment.webhookEvents
    });

    // Update booking
    const booking = await this.bookingRepository.findById(payment.bookingId);
    if (booking) {
      await this.bookingRepository.update(booking.id, {
        'pricing.paymentStatus': payment.status === 'refunded' ? 'fully_refunded' : 'partially_refunded',
        'pricing.refundedAmount': payment.getTotalRefunded()
      });
    }
  }

  /**
   * Handle charge.dispute.created
   */
  async handleDisputeCreated(dispute) {
    console.log('Dispute created:', dispute.id);
    
    const payment = await this.paymentRepository.findByProviderId('stripe', dispute.payment_intent);
    if (!payment) return;

    payment.recordWebhookEvent('charge.dispute.created', {
      disputeId: dispute.id,
      reason: dispute.reason,
      amount: dispute.amount
    });

    await this.paymentRepository.update(payment.id, {
      status: PaymentStatus.DISPUTED,
      webhookEvents: payment.webhookEvents
    });

    // Notify admin about dispute
    await emailService.sendEmail({
      to: process.env.ADMIN_EMAIL || 'admin@nexvoy.com',
      subject: `⚠️ Payment Dispute - ${dispute.id}`,
      html: `
        <h2>Payment Dispute Created</h2>
        <p><strong>Dispute ID:</strong> ${dispute.id}</p>
        <p><strong>Payment ID:</strong> ${payment.id}</p>
        <p><strong>Booking ID:</strong> ${payment.bookingId}</p>
        <p><strong>Reason:</strong> ${dispute.reason}</p>
        <p><strong>Amount:</strong> $${(dispute.amount / 100).toFixed(2)}</p>
        <p>Please respond to this dispute in the Stripe Dashboard.</p>
      `
    });
  }

  /**
   * Handle invoice.payment_succeeded
   */
  async handleInvoicePaymentSucceeded(invoice) {
    console.log('Invoice payment succeeded:', invoice.id);
    // Handle subscription payments if applicable
  }

  /**
   * Handle invoice.payment_failed
   */
  async handleInvoicePaymentFailed(invoice) {
    console.log('Invoice payment failed:', invoice.id);
    // Handle failed subscription payments if applicable
  }

  /**
   * Handle checkout.session.completed
   */
  async handleCheckoutSessionCompleted(session) {
    console.log('Checkout session completed:', session.id);
    
    // Handle checkout session completion if using Stripe Checkout
    if (session.payment_intent) {
      const payment = await this.paymentRepository.findByProviderId('stripe', session.payment_intent);
      if (payment) {
        payment.recordWebhookEvent('checkout.session.completed', {
          sessionId: session.id,
          paymentIntentId: session.payment_intent
        });
        await this.paymentRepository.update(payment.id, {
          webhookEvents: payment.webhookEvents
        });
      }
    }
  }

  /**
   * Handle refund.created
   */
  async handleRefundCreated(refund) {
    console.log('Refund created:', refund.id);
    // Additional processing if needed
  }

  /**
   * Handle refund.updated
   */
  async handleRefundUpdated(refund) {
    console.log('Refund updated:', refund.id);
    
    // Update refund status if needed
    const payment = await this.paymentRepository.findByProviderId('stripe', refund.payment_intent);
    if (payment) {
      payment.recordWebhookEvent('refund.updated', {
        refundId: refund.id,
        status: refund.status
      });
      await this.paymentRepository.update(payment.id, {
        webhookEvents: payment.webhookEvents
      });
    }
  }
}

module.exports = StripeWebhookHandler;
