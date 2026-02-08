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

// Import services
const BookingService = require('./src/services/bookingService');
const PaymentService = require('./src/services/paymentService');

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

// Mock controllers for testing
const mockControllers = {
  flights: {
    compareFlights: (req, res) => res.json({ success: true, flights: [] }),
    getPriceHistory: (req, res) => res.json({ success: true, history: [] }),
    checkDeal: (req, res) => res.json({ success: true, isDeal: true }),
    predictPrices: (req, res) => res.json({ success: true, prediction: {} }),
    getPopularRoutes: (req, res) => res.json({ success: true, routes: [] }),
  },
  hotels: {
    compareHotels: (req, res) => res.json({ success: true, hotels: [] }),
    getPriceHistory: (req, res) => res.json({ success: true, history: [] }),
    checkDeal: (req, res) => res.json({ success: true, isDeal: true }),
    getPopularDestinations: (req, res) => res.json({ success: true, destinations: [] }),
    getAmenities: (req, res) => res.json({ success: true, amenities: [] }),
  },
  chat: {
    sendMessage: (req, res) => res.json({ success: true, response: 'Hello!' }),
    getHistory: (req, res) => res.json({ success: true, messages: [] }),
    clearHistory: (req, res) => res.json({ success: true }),
    getContext: (req, res) => res.json({ success: true, context: {} }),
    updateContext: (req, res) => res.json({ success: true }),
    getPreferences: (req, res) => res.json({ success: true, preferences: {} }),
    updatePreferences: (req, res) => res.json({ success: true }),
    exportConversation: (req, res) => res.json({ success: true, data: '' }),
    handleWebSocket: () => {},
  },
  alerts: {
    createAlert: (req, res) => res.json({ success: true, alert: { id: '1' } }),
    getAlerts: (req, res) => res.json({ success: true, alerts: [] }),
    getUserAlerts: (req, res) => res.json({ success: true, alerts: [] }),
    getStatistics: (req, res) => res.json({ success: true, stats: {} }),
    exportAlerts: (req, res) => res.json({ success: true, data: '' }),
    importAlerts: (req, res) => res.json({ success: true }),
    getPriceHistory: (req, res) => res.json({ success: true, history: [] }),
    getPricePrediction: (req, res) => res.json({ success: true, prediction: {} }),
    getAlert: (req, res) => res.json({ success: true, alert: {} }),
    updateAlert: (req, res) => res.json({ success: true }),
    deleteAlert: (req, res) => res.json({ success: true }),
    pauseAlert: (req, res) => res.json({ success: true }),
    resumeAlert: (req, res) => res.json({ success: true }),
    checkAlert: (req, res) => res.json({ success: true }),
  },
  payments: {
    createPaymentIntent: (req, res) => res.json({ success: true, clientSecret: 'secret' }),
    confirmPayment: (req, res) => res.json({ success: true }),
    getPaymentMethods: (req, res) => res.json({ success: true, methods: [] }),
  },
  itinerary: {
    createItinerary: (req, res) => res.json({ success: true, itinerary: {} }),
    getItinerary: (req, res) => res.json({ success: true, itinerary: {} }),
    updateItinerary: (req, res) => res.json({ success: true }),
    deleteItinerary: (req, res) => res.json({ success: true }),
  },
  receipts: {
    generateReceipt: (req, res) => res.json({ success: true, receipt: {} }),
    getReceipt: (req, res) => res.json({ success: true, receipt: {} }),
    emailReceipt: (req, res) => res.json({ success: true }),
  },
  booking: {
    createBooking: (req, res) => res.json({ success: true, booking: {} }),
    getBookings: (req, res) => res.json({ success: true, bookings: [] }),
    getBooking: (req, res) => res.json({ success: true, booking: {} }),
    cancelBooking: (req, res) => res.json({ success: true }),
    generateLinks: (req, res) => res.json({ success: true, links: {} }),
    trackClick: (req, res) => res.json({ success: true }),
    getBestOption: (req, res) => res.json({ success: true, option: {} }),
    trackConversion: (req, res) => res.json({ success: true }),
    getBookingOptions: (req, res) => res.json({ success: true, options: [] }),
    getStats: (req, res) => res.json({ success: true, stats: {} }),
    getAffiliates: (req, res) => res.json({ success: true, affiliates: [] }),
    getStrategies: (req, res) => res.json({ success: true, strategies: [] }),
  },
  reviews: {
    createReview: (req, res) => res.json({ success: true, review: {} }),
    getReviews: (req, res) => res.json({ success: true, reviews: [] }),
    getReviewById: (req, res) => res.json({ success: true, review: {} }),
    updateReview: (req, res) => res.json({ success: true }),
    deleteReview: (req, res) => res.json({ success: true }),
  },
  companions: {
    findCompanions: (req, res) => res.json({ success: true, companions: [] }),
    requestCompanion: (req, res) => res.json({ success: true }),
  },
  forums: {
    getCategories: (req, res) => res.json({ success: true, categories: [] }),
    getTopics: (req, res) => res.json({ success: true, topics: [] }),
    createTopic: (req, res) => res.json({ success: true, topic: {} }),
  },
  suggestions: {
    getSuggestions: (req, res) => res.json({ success: true, suggestions: [] }),
  },
  trips: {
    createTrip: (req, res) => res.json({ success: true, trip: {} }),
    getTrips: (req, res) => res.json({ success: true, trips: [] }),
  },
  personality: {
    getMode: (req, res) => res.json({ success: true, mode: 'adventurer' }),
    setMode: (req, res) => res.json({ success: true }),
  },
  multiModal: {
    processInput: (req, res) => res.json({ success: true, result: {} }),
  },
  corporate: {
    getDashboard: (req, res) => res.json({ success: true, dashboard: {} }),
  },
  affiliates: {
    getStats: (req, res) => res.json({ success: true, stats: {} }),
  },
  loyalty: {
    getPoints: (req, res) => res.json({ success: true, points: 0 }),
    getAccount: (req, res) => res.json({ success: true, account: { tier: 'bronze', points: 0 } }),
    getHistory: (req, res) => res.json({ success: true, history: [] }),
    redeemPoints: (req, res) => res.json({ success: true, redeemed: 0 }),
  },
  gamification: {
    getAchievements: (req, res) => res.json({ success: true, achievements: [] }),
    getLeaderboard: (req, res) => res.json({ success: true, leaderboard: [] }),
  },
  itinerary: {
    getAll: (req, res) => res.json({ success: true, itineraries: [] }),
    getById: (req, res) => res.json({ success: true, itinerary: {} }),
    create: (req, res) => res.json({ success: true, itinerary: { id: '1' } }),
    update: (req, res) => res.json({ success: true }),
    delete: (req, res) => res.json({ success: true }),
    addActivity: (req, res) => res.json({ success: true, activity: {} }),
    removeActivity: (req, res) => res.json({ success: true }),
    optimize: (req, res) => res.json({ success: true, optimized: {} }),
  },
  payments: {
    createIntent: (req, res) => res.json({ success: true, clientSecret: 'pi_test_secret' }),
    confirm: (req, res) => res.json({ success: true, payment: {} }),
    getMethods: (req, res) => res.json({ success: true, methods: [] }),
    addMethod: (req, res) => res.json({ success: true, method: {} }),
    removeMethod: (req, res) => res.json({ success: true }),
    getHistory: (req, res) => res.json({ success: true, payments: [] }),
    refund: (req, res) => res.json({ success: true, refund: {} }),
  },
  deals: {
    getDeals: (req, res) => res.json({ success: true, deals: [] }),
    analyzeDeals: (req, res) => res.json({ success: true, analysis: {} }),
    findHiddenDeals: (req, res) => res.json({ success: true, deals: [] }),
    scoreDeal: (req, res) => res.json({ success: true, score: 0 }),
    compareDeals: (req, res) => res.json({ success: true, comparison: {} }),
    predictPrices: (req, res) => res.json({ success: true, prediction: {} }),
    getCurrentDeals: (req, res) => res.json({ success: true, deals: [] }),
    getCategories: (req, res) => res.json({ success: true, categories: [] }),
    getDealById: (req, res) => res.json({ success: true, deal: {} }),
    getDealStats: (req, res) => res.json({ success: true, stats: {} }),
    trackDealView: (req, res) => res.json({ success: true }),
    shareDeal: (req, res) => res.json({ success: true }),
  },
};

const mockServices = {
  priceService: {
    searchFlights: async () => ({ flights: [], meta: { count: 0 } }),
    searchHotels: async () => ({ hotels: [], meta: { count: 0 } }),
  }
};

// Initialize services
const bookingService = new BookingService();
const paymentService = new PaymentService();

// Auth routes (no controllers needed)
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

// API routes with controllers
app.use('/api', createRoutes(mockControllers, mockServices));

// Itinerary routes
app.use('/api/itinerary', createItineraryRoutes());

// Payment routes  
app.use('/api/payments', createPaymentRoutes());

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

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Nexvoy API server running on port ${PORT}`);
    console.log(`🔒 JWT Security: ${process.env.JWT_SECRET ? 'Enabled' : 'DISABLED - SERVER WILL EXIT'}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
