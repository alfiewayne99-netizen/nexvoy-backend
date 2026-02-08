require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const createRoutes = require('./src/routes');
const authRoutes = require('./src/routes/authRoutes');
const createItineraryRoutes = require('./src/routes/itineraryRoutes');
const createPaymentRoutes = require('./src/routes/paymentRoutes');

// MISSING ROUTES - Adding these for full feature support
const adminRoutes = require('./src/routes/adminRoutes');
const insuranceRoutes = require('./src/routes/insuranceRoutes');
const userRoutes = require('./src/routes/userRoutes');

// Import services needed for controller injection
const BookingService = require('./src/services/bookingService');
const PaymentService = require('./src/services/paymentService');
const PriceService = require('./src/services/priceService');
const AlertService = require('./src/services/alertService');
const DealEngine = require('./src/services/dealEngine');
const NexvoyEngine = require('./src/services/nexvoyEngine');

// Import real controller factories
const { createFlightController } = require('./src/controllers/flightController');
const { createHotelController } = require('./src/controllers/hotelController');
const { createAlertController } = require('./src/controllers/alertController');
const { createBookingLinkController } = require('./src/controllers/bookingLinkController');
const { createDealController } = require('./src/controllers/dealController');

// Import static controllers
const ChatController = require('./src/controllers/chatController');
const PaymentController = require('./src/controllers/paymentController');
const BookingController = require('./src/controllers/bookingController');
const authController = require('./src/controllers/authController');
const affiliateController = require('./src/controllers/affiliateController');
const corporateController = require('./src/controllers/corporateController');
const gamificationController = require('./src/controllers/gamificationController');
const loyaltyController = require('./src/controllers/loyaltyController');
const aiController = require('./src/controllers/aiController');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const corsOrigins = process.env.ALLOWED_ORIGINS;
const corsOptions = {
  origin: corsOrigins === '*' ? true : (corsOrigins?.split(',') || ['http://localhost:3000']),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});
app.use(limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Initialize services
const priceService = new PriceService();
const alertService = new AlertService();
const bookingService = new BookingService();
const paymentService = new PaymentService();
const dealEngine = new DealEngine();
const nexvoyEngine = new NexvoyEngine();

// Initialize real controllers with dependency injection
const flightController = createFlightController(priceService);
const hotelController = createHotelController(priceService);
const chatController = new ChatController(nexvoyEngine);
const alertController = createAlertController(alertService);
const bookingLinkController = createBookingLinkController(bookingService);
const dealController = createDealController(dealEngine, priceService);
const paymentController = new PaymentController();
const bookingController = new BookingController();

// Assemble controllers object for routes
const controllers = {
  flights: flightController,
  hotels: hotelController,
  chat: chatController,
  alerts: alertController,
  payments: paymentController,
  booking: bookingLinkController, // Note: booking routes use bookingLinkController
  bookings: bookingController,    // Note: booking routes also use bookingController for some endpoints
  deals: dealController,
  loyalty: loyaltyController,
  gamification: gamificationController,
  affiliates: affiliateController,
  corporate: corporateController,
  ai: aiController,
  // Social feature controllers that may be conditionally used
  reviews: null,
  companions: null,
  forums: null,
  suggestions: null,
  trips: null,
  personality: null,
  multiModal: null
};

const services = {
  priceService,
  alertService,
  bookingService,
  paymentService,
  dealEngine
};

// Auth routes
app.use('/api/auth', authRoutes);

// Real Stripe Payment routes
app.post('/api/payments/create-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', metadata = {} } = req.body;
    const result = await paymentService.createPaymentIntent(amount, currency, metadata);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/payments/confirm', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const result = await paymentService.confirmPayment(paymentIntentId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/payments/refund', async (req, res) => {
  try {
    const { paymentIntentId, amount } = req.body;
    const result = await paymentService.processRefund(paymentIntentId, amount);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Booking routes with real service
app.get('/api/booking/stats', async (req, res) => {
  try {
    const stats = await bookingService.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/booking/affiliates', async (req, res) => {
  try {
    const affiliates = await bookingService.getAffiliates();
    res.json({ success: true, affiliates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API routes with real controllers
app.use('/api', createRoutes(controllers, services));

// Itinerary routes
app.use('/api/itinerary', createItineraryRoutes());

// Payment routes  
app.use('/api/payments', createPaymentRoutes());

// ============================================================================
// MISSING ROUTES - NOW REGISTERED
// ============================================================================

// Admin routes - Protected admin endpoints
app.use('/api/admin', adminRoutes);

// Insurance routes - Travel insurance quotes and purchases
app.use('/api/insurance', insuranceRoutes);

// User routes - User profile and bookings
app.use('/api/user', userRoutes);

// ============================================================================
// User routes (for profile page) - MUST be before 404 handler
app.get('/api/users/bookings', async (req, res) => {
  console.log('DEBUG: /api/users/bookings route hit');
  try {
    res.json({ success: true, bookings: [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/users/saved-searches', async (req, res) => {
  console.log('DEBUG: /api/users/saved-searches route hit');
  try {
    res.json({ success: true, savedSearches: [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    code: err.code || 'INTERNAL_ERROR'
  });
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Nexvoy API server running on port ${PORT}`);
    console.log(`🔒 JWT Security: ${process.env.JWT_SECRET ? 'Enabled' : 'DISABLED - SERVER WILL EXIT'}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🎮 Real controllers: Enabled`);
  });
}

module.exports = app;
