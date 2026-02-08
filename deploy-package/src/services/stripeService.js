/**
 * Stripe Service
 * Handles all Stripe payment processing
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_51YourTestKey');

class StripeService {
  constructor() {
    this.stripe = stripe;
  }

  /**
   * Create a payment intent
   */
  async createPaymentIntent({
    amount,
    currency,
    metadata = {},
    receipt_email = null,
    customer = null,
    automatic_payment_methods = { enabled: true },
    description = null
  }) {
    try {
      const params = {
        amount,
        currency: currency.toLowerCase(),
        metadata,
        automatic_payment_methods
      };

      if (receipt_email) params.receipt_email = receipt_email;
      if (customer) params.customer = customer;
      if (description) params.description = description;

      const paymentIntent = await this.stripe.paymentIntents.create(params);
      
      return paymentIntent;
    } catch (error) {
      console.error('Stripe createPaymentIntent error:', error);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Retrieve a payment intent
   */
  async retrievePaymentIntent(paymentIntentId) {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      console.error('Stripe retrievePaymentIntent error:', error);
      throw new Error(`Failed to retrieve payment intent: ${error.message}`);
    }
  }

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(paymentIntentId, paymentMethodId = null) {
    try {
      const params = {};
      if (paymentMethodId) {
        params.payment_method = paymentMethodId;
      }
      
      return await this.stripe.paymentIntents.confirm(paymentIntentId, params);
    } catch (error) {
      console.error('Stripe confirmPaymentIntent error:', error);
      throw new Error(`Failed to confirm payment intent: ${error.message}`);
    }
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(paymentIntentId) {
    try {
      return await this.stripe.paymentIntents.cancel(paymentIntentId);
    } catch (error) {
      console.error('Stripe cancelPaymentIntent error:', error);
      throw new Error(`Failed to cancel payment intent: ${error.message}`);
    }
  }

  /**
   * Create a refund
   */
  async createRefund({
    payment_intent = null,
    charge = null,
    amount = null,
    reason = 'requested_by_customer',
    metadata = {}
  }) {
    try {
      const params = { reason, metadata };
      
      if (payment_intent) {
        params.payment_intent = payment_intent;
      } else if (charge) {
        params.charge = charge;
      } else {
        throw new Error('Either payment_intent or charge is required');
      }
      
      if (amount) params.amount = amount;

      return await this.stripe.refunds.create(params);
    } catch (error) {
      console.error('Stripe createRefund error:', error);
      throw new Error(`Failed to create refund: ${error.message}`);
    }
  }

  /**
   * Create a customer
   */
  async createCustomer({
    email,
    name = null,
    phone = null,
    metadata = {}
  }) {
    try {
      const params = { email, metadata };
      if (name) params.name = name;
      if (phone) params.phone = phone;

      return await this.stripe.customers.create(params);
    } catch (error) {
      console.error('Stripe createCustomer error:', error);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }

  /**
   * Retrieve a customer
   */
  async retrieveCustomer(customerId) {
    try {
      return await this.stripe.customers.retrieve(customerId);
    } catch (error) {
      console.error('Stripe retrieveCustomer error:', error);
      throw new Error(`Failed to retrieve customer: ${error.message}`);
    }
  }

  /**
   * Create a setup intent for saving payment methods
   */
  async createSetupIntent({
    customer,
    metadata = {}
  }) {
    try {
      return await this.stripe.setupIntents.create({
        customer,
        metadata,
        usage: 'off_session'
      });
    } catch (error) {
      console.error('Stripe createSetupIntent error:', error);
      throw new Error(`Failed to create setup intent: ${error.message}`);
    }
  }

  /**
   * List customer's payment methods
   */
  async listPaymentMethods(customerId, type = 'card') {
    try {
      return await this.stripe.paymentMethods.list({
        customer: customerId,
        type
      });
    } catch (error) {
      console.error('Stripe listPaymentMethods error:', error);
      throw new Error(`Failed to list payment methods: ${error.message}`);
    }
  }

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(paymentMethodId, customerId) {
    try {
      return await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
    } catch (error) {
      console.error('Stripe attachPaymentMethod error:', error);
      throw new Error(`Failed to attach payment method: ${error.message}`);
    }
  }

  /**
   * Detach payment method from customer
   */
  async detachPaymentMethod(paymentMethodId) {
    try {
      return await this.stripe.paymentMethods.detach(paymentMethodId);
    } catch (error) {
      console.error('Stripe detachPaymentMethod error:', error);
      throw new Error(`Failed to detach payment method: ${error.message}`);
    }
  }

  /**
   * Construct webhook event
   */
  constructWebhookEvent(payload, signature, secret) {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      console.error('Stripe webhook signature verification failed:', error);
      throw new Error(`Webhook signature verification failed: ${error.message}`);
    }
  }

  /**
   * Create a price for recurring payments
   */
  async createPrice({
    unit_amount,
    currency,
    product_data = null,
    product = null,
    recurring = null
  }) {
    try {
      const params = {
        unit_amount,
        currency: currency.toLowerCase()
      };

      if (product) {
        params.product = product;
      } else if (product_data) {
        params.product_data = product_data;
      }

      if (recurring) {
        params.recurring = recurring;
      }

      return await this.stripe.prices.create(params);
    } catch (error) {
      console.error('Stripe createPrice error:', error);
      throw new Error(`Failed to create price: ${error.message}`);
    }
  }

  /**
   * Create invoice item
   */
  async createInvoiceItem({
    customer,
    price,
    quantity = 1,
    description = null
  }) {
    try {
      const params = { customer, price, quantity };
      if (description) params.description = description;

      return await this.stripe.invoiceItems.create(params);
    } catch (error) {
      console.error('Stripe createInvoiceItem error:', error);
      throw new Error(`Failed to create invoice item: ${error.message}`);
    }
  }

  /**
   * Create invoice
   */
  async createInvoice({
    customer,
    auto_advance = true,
    collection_method = 'charge_automatically',
    description = null,
    metadata = {}
  }) {
    try {
      const params = {
        customer,
        auto_advance,
        collection_method,
        metadata
      };

      if (description) params.description = description;

      return await this.stripe.invoices.create(params);
    } catch (error) {
      console.error('Stripe createInvoice error:', error);
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  }

  /**
   * Finalize invoice
   */
  async finalizeInvoice(invoiceId) {
    try {
      return await this.stripe.invoices.finalizeInvoice(invoiceId);
    } catch (error) {
      console.error('Stripe finalizeInvoice error:', error);
      throw new Error(`Failed to finalize invoice: ${error.message}`);
    }
  }

  /**
   * Get charge details
   */
  async retrieveCharge(chargeId) {
    try {
      return await this.stripe.charges.retrieve(chargeId);
    } catch (error) {
      console.error('Stripe retrieveCharge error:', error);
      throw new Error(`Failed to retrieve charge: ${error.message}`);
    }
  }

  /**
   * Create checkout session
   */
  async createCheckoutSession({
    line_items,
    mode = 'payment',
    success_url,
    cancel_url,
    customer = null,
    client_reference_id = null,
    metadata = {},
    allow_promotion_codes = true
  }) {
    try {
      const params = {
        line_items,
        mode,
        success_url,
        cancel_url,
        metadata,
        allow_promotion_codes
      };

      if (customer) params.customer = customer;
      if (client_reference_id) params.client_reference_id = client_reference_id;

      return await this.stripe.checkout.sessions.create(params);
    } catch (error) {
      console.error('Stripe createCheckoutSession error:', error);
      throw new Error(`Failed to create checkout session: ${error.message}`);
    }
  }

  /**
   * Retrieve checkout session
   */
  async retrieveCheckoutSession(sessionId) {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      console.error('Stripe retrieveCheckoutSession error:', error);
      throw new Error(`Failed to retrieve checkout session: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new StripeService();
module.exports.StripeService = StripeService;
