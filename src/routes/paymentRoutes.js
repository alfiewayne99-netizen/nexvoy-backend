/**
 * Payment Routes
 * Defines API routes for payment operations
 */

const express = require('express');
const PaymentController = require('../controllers/paymentController');
const StripeWebhookHandler = require('../webhooks/stripeWebhook');

function createPaymentRoutes(database = null) {
  const router = express.Router();
  const controller = new PaymentController(database);
  const webhookHandler = new StripeWebhookHandler(database);
  
  // Create payment intent (Stripe) or order (PayPal)
  router.post('/create-intent', (req, res, next) => controller.createPaymentIntent(req, res, next));
  
  // Confirm payment after success
  router.post('/confirm', (req, res, next) => controller.confirmPayment(req, res, next));
  
  // Get payment status by ID
  router.get('/:id/status', (req, res, next) => controller.getPaymentById(req, res, next));
  
  // Get payment status by booking
  router.get('/booking/:bookingId', (req, res, next) => controller.getPaymentStatus(req, res, next));
  
  // Process refund
  router.post('/refund', (req, res, next) => controller.processRefund(req, res, next));
  
  // Get saved payment methods
  router.get('/methods', (req, res, next) => controller.getSavedMethods(req, res, next));
  
  // Save payment method
  router.post('/methods', (req, res, next) => controller.savePaymentMethod(req, res, next));
  
  // Stripe webhook endpoint (must be raw body, not JSON)
  router.post('/webhook/stripe', 
    express.raw({ type: 'application/json' }),
    (req, res) => webhookHandler.handleWebhook(req, res)
  );
  
  return router;
}

module.exports = createPaymentRoutes;
