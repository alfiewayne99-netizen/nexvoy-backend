/**
 * Nexvoy API Routes
 * Central route configuration
 */

const express = require('express');
const { createChatRoutes } = require('./chatRoutes');
const { router: searchRouter, setPriceService } = require('./searchRoutes');
const createPaymentRoutes = require('./paymentRoutes');
const createReceiptRoutes = require('./receiptRoutes');
const createBookingRoutes = require('./bookingRoutes');
const createItineraryRoutes = require('./itineraryRoutes');
const createReviewRoutes = require('./reviewRoutes');
const createTravelCompanionRoutes = require('./travelCompanionRoutes');
const createForumRoutes = require('./forumRoutes');
const suggestionRoutes = require('./suggestionRoutes');
const tripRoutes = require('./tripRoutes');
const personalityRoutes = require('./personalityRoutes');
const multiModalRoutes = require('./multiModalRoutes');

// Business Feature Routes (Batch 4)
const corporateRoutes = require('./corporateRoutes');
const affiliateRoutes = require('./affiliateRoutes');
const loyaltyRoutes = require('./loyaltyRoutes');
const gamificationRoutes = require('./gamificationRoutes');

/**
 * Create all API routes
 */
function createRoutes(controllers, services = {}, database = null) {
  const router = express.Router();
  
  // Set price service for search routes if available
  if (services.priceService) {
    setPriceService(services.priceService);
  }
  
  // Mount chat routes if chat controller exists
  if (controllers.chat) {
    router.post('/chat/send', controllers.chat.sendMessage);
    router.get('/chat/history', controllers.chat.getHistory);
    router.delete('/chat/history', controllers.chat.clearHistory);
    router.get('/chat/context/:userId/:sessionId', controllers.chat.getContext);
    router.put('/chat/context/:userId/:sessionId', controllers.chat.updateContext);
  }
  
  // ============================================================================
  // Payment Routes
  // ============================================================================
  router.use('/payments', createPaymentRoutes(database));
  
  // ============================================================================
  // Receipt Routes
  // ============================================================================
  router.use('/receipts', createReceiptRoutes(database));
  
  // ============================================================================
  // Booking Routes
  // ============================================================================
  router.use('/bookings', createBookingRoutes(database));
  
  // ============================================================================
  // Flight Routes
  // ============================================================================
  router.post('/flights/compare', controllers.flights.compareFlights);
  router.get('/flights/history/:route', controllers.flights.getPriceHistory);
  router.post('/flights/deal-check', controllers.flights.checkDeal);
  router.get('/flights/predict/:route', controllers.flights.predictPrices);
  router.get('/flights/popular', controllers.flights.getPopularRoutes);
  
  // ============================================================================
  // Hotel Routes
  // ============================================================================
  router.post('/hotels/compare', controllers.hotels.compareHotels);
  router.get('/hotels/history/:location', controllers.hotels.getPriceHistory);
  router.post('/hotels/deal-check', controllers.hotels.checkDeal);
  router.get('/hotels/popular', controllers.hotels.getPopularDestinations);
  router.get('/hotels/amenities', controllers.hotels.getAmenities);
  
  // ============================================================================
  // Search Routes
  // ============================================================================
  router.use('/search', searchRouter);
  
  // ============================================================================
  // Alert Routes
  // ============================================================================
  router.post('/alerts', controllers.alerts.createAlert);
  router.get('/alerts', controllers.alerts.getUserAlerts);
  router.get('/alerts/stats', controllers.alerts.getStatistics);
  router.get('/alerts/export', controllers.alerts.exportAlerts);
  router.post('/alerts/import', controllers.alerts.importAlerts);
  router.get('/alerts/history', controllers.alerts.getPriceHistory);
  router.get('/alerts/predict', controllers.alerts.getPricePrediction);
  router.get('/alerts/:id', controllers.alerts.getAlert);
  router.put('/alerts/:id', controllers.alerts.updateAlert);
  router.delete('/alerts/:id', controllers.alerts.deleteAlert);
  router.post('/alerts/:id/pause', controllers.alerts.pauseAlert);
  router.post('/alerts/:id/resume', controllers.alerts.resumeAlert);
  router.post('/alerts/:id/check', controllers.alerts.checkAlert);
  
  // ============================================================================
  // Deal Routes
  // ============================================================================
  router.get('/deals/analyze', controllers.deals.analyzeDeals);
  router.get('/deals/hidden', controllers.deals.findHiddenDeals);
  router.post('/deals/score', controllers.deals.scoreDeal);
  router.post('/deals/compare', controllers.deals.compareDeals);
  router.get('/deals/predict', controllers.deals.predictPrices);
  router.get('/deals/current', controllers.deals.getCurrentDeals);
  router.get('/deals/categories', controllers.deals.getCategories);
  
  // ============================================================================
  // Booking Link Routes
  // ============================================================================
  router.post('/booking/links', controllers.booking.generateLinks);
  router.post('/booking/best-option', controllers.booking.getBestOption);
  router.post('/booking/track-click', controllers.booking.trackClick);
  router.post('/booking/track-conversion', controllers.booking.trackConversion);
  router.post('/booking/options', controllers.booking.getBookingOptions);
  router.get('/booking/stats', controllers.booking.getStats);
  router.get('/booking/affiliates', controllers.booking.getAffiliates);
  router.get('/booking/strategies', controllers.booking.getStrategies);
  
  // ============================================================================
  // Itinerary Routes
  // ============================================================================
  router.use('/itineraries', createItineraryRoutes(database));
  
  // ============================================================================
  // Review Routes (Social Feature)
  // ============================================================================
  if (controllers.reviews) {
    router.get('/reviews', controllers.reviews.getReviews);
    router.post('/reviews', controllers.reviews.createReview);
    router.get('/reviews/:id', controllers.reviews.getReviewById);
    router.put('/reviews/:id', controllers.reviews.updateReview);
    router.delete('/reviews/:id', controllers.reviews.deleteReview);
  } else {
    router.use('/reviews', createReviewRoutes(database));
  }
  
  // ============================================================================
  // Travel Companion Routes (Social Feature)
  // ============================================================================
  if (controllers.companions) {
    router.get('/companions', controllers.companions.findCompanions);
    router.post('/companions/request', controllers.companions.requestCompanion);
  } else {
    router.use('/companions', createTravelCompanionRoutes(database));
  }
  
  // ============================================================================
  // Forum Routes (Social Feature)
  // ============================================================================
  if (controllers.forums) {
    router.get('/forums/categories', controllers.forums.getCategories);
    router.get('/forums/topics', controllers.forums.getTopics);
    router.post('/forums/topics', controllers.forums.createTopic);
  } else {
    router.use('/forums', createForumRoutes(database));
  }

  // ============================================================================
  // AI Feature Routes (Batch 2)
  // ============================================================================

  // Proactive AI Suggestions
  router.use('/suggestions', suggestionRoutes);

  // Advanced Trip Planning
  router.use('/trips', tripRoutes);

  // Personality Modes
  router.use('/personality', personalityRoutes);

  // Multi-Modal Chat
  router.use('/multimodal', multiModalRoutes);

  // ============================================================================
  // Business Feature Routes (Batch 4)
  // ============================================================================
  
  // B2B Corporate Travel
  router.use('/corporate', corporateRoutes);
  
  // Affiliate/Creator Program
  router.use('/affiliates', affiliateRoutes);
  
  // Loyalty Program
  if (controllers.loyalty) {
    router.get('/loyalty/points', controllers.loyalty.getPoints);
    router.get('/loyalty/account', controllers.loyalty.getAccount);
    router.get('/loyalty/history', controllers.loyalty.getHistory);
    router.post('/loyalty/redeem', controllers.loyalty.redeemPoints);
  } else {
    router.use('/loyalty', loyaltyRoutes);
  }
  
  // Gamification
  if (controllers.gamification) {
    router.get('/gamification', controllers.gamification.getAchievements);
    router.get('/gamification/leaderboard', controllers.gamification.getLeaderboard);
  } else {
    router.use('/gamification', gamificationRoutes);
  }

  // ============================================================================
  // API Documentation
  // ============================================================================
  router.get('/docs', (req, res) => {
    res.json({
      success: true,
      data: {
        name: 'Nexvoy API',
        version: '1.0.0',
        endpoints: {
          payments: {
            'POST /api/payments/create-intent': 'Create Stripe payment intent',
            'POST /api/payments/confirm': 'Confirm successful payment',
            'GET /api/payments/:id/status': 'Get payment status by ID',
            'GET /api/payments/booking/:bookingId': 'Get payment status by booking',
            'POST /api/payments/refund': 'Process refund',
            'GET /api/payments/methods': 'Get saved payment methods',
            'POST /api/payments/methods': 'Save payment method',
            'POST /api/payments/webhook/stripe': 'Stripe webhook endpoint'
          },
          receipts: {
            'GET /api/receipts': 'Get user receipts',
            'GET /api/receipts/:id': 'Get receipt by ID',
            'GET /api/receipts/booking/:bookingId': 'Get receipt by booking',
            'GET /api/receipts/:id/pdf': 'Download receipt PDF',
            'POST /api/receipts/:id/resend': 'Resend receipt email'
          },
          bookings: {
            'GET /api/bookings': 'Get user bookings',
            'POST /api/bookings': 'Create new booking',
            'GET /api/bookings/:id': 'Get booking details',
            'PUT /api/bookings/:id': 'Update booking',
            'DELETE /api/bookings/:id': 'Cancel booking',
            'GET /api/bookings/:id/ticket': 'Download e-ticket PDF'
          },
          flights: {
            'POST /api/flights/compare': 'Compare flight prices across OTAs',
            'GET /api/flights/history/:route': 'Get price history for a route',
            'POST /api/flights/deal-check': 'Check if a price is a good deal',
            'GET /api/flights/predict/:route': 'Predict future price movements',
            'GET /api/flights/popular': 'Get popular flight routes'
          },
          hotels: {
            'POST /api/hotels/compare': 'Compare hotel prices across OTAs',
            'GET /api/hotels/history/:location': 'Get price history for a location',
            'POST /api/hotels/deal-check': 'Check if a price is a good deal',
            'GET /api/hotels/popular': 'Get popular hotel destinations',
            'GET /api/hotels/amenities': 'Get available amenity filters'
          },
          alerts: {
            'POST /api/alerts': 'Create a price alert',
            'GET /api/alerts': 'Get user\'s alerts',
            'GET /api/alerts/:id': 'Get specific alert',
            'PUT /api/alerts/:id': 'Update alert',
            'DELETE /api/alerts/:id': 'Delete alert',
            'POST /api/alerts/:id/pause': 'Pause alert',
            'POST /api/alerts/:id/resume': 'Resume alert'
          },
          deals: {
            'GET /api/deals/analyze': 'Analyze deals for route/destination',
            'GET /api/deals/hidden': 'Find hidden deals',
            'POST /api/deals/score': 'Score a specific deal',
            'POST /api/deals/compare': 'Compare multiple deals'
          },
          booking: {
            'POST /api/booking/links': 'Generate affiliate booking links',
            'POST /api/booking/best-option': 'Get best booking option',
            'GET /api/booking/affiliates': 'List available affiliates'
          },
          itineraries: {
            'GET /api/itineraries': 'Get user itineraries',
            'POST /api/itineraries': 'Create new itinerary',
            'GET /api/itineraries/:id': 'Get itinerary details',
            'PUT /api/itineraries/:id': 'Update itinerary',
            'DELETE /api/itineraries/:id': 'Delete itinerary',
            'POST /api/itineraries/:id/days/:dayNumber/activities': 'Add activity to day',
            'DELETE /api/itineraries/:id/activities/:activityId': 'Remove activity',
            'PUT /api/itineraries/:id/days/:dayNumber/reorder': 'Reorder activities',
            'POST /api/itineraries/:id/share': 'Share itinerary',
            'GET /api/itineraries/:id/pdf': 'Export itinerary as PDF',
            'POST /api/itineraries/:id/duplicate': 'Duplicate itinerary'
          },
          chat: {
            'POST /api/chat/message': 'Send message to AI assistant',
            'WS /api/chat/ws': 'WebSocket for real-time chat',
            'GET /api/chat/history/:userId/:sessionId': 'Get conversation history',
            'DELETE /api/chat/history/:userId/:sessionId': 'Clear conversation history',
            'GET /api/chat/context/:userId/:sessionId': 'Get user context',
            'PUT /api/chat/preferences/:userId/:sessionId': 'Update user preferences'
          },
          suggestions: {
            'GET /api/suggestions': 'Get all proactive suggestions',
            'GET /api/suggestions/high-priority': 'Get urgent suggestions',
            'POST /api/suggestions/:id/read': 'Mark as read',
            'POST /api/suggestions/:id/dismiss': 'Dismiss suggestion',
            'POST /api/suggestions/seasonal': 'Generate seasonal suggestion'
          },
          trips: {
            'POST /api/trips/plan': 'Generate AI trip plan',
            'POST /api/trips/optimize-route': 'Optimize multi-city route',
            'POST /api/trips/bleisure': 'Generate bleisure plan',
            'POST /api/trips/budget': 'Generate budget trip plan',
            'GET /api/trips/my-plans': 'Get my trip plans',
            'GET /api/trips/public': 'Get public trip plans',
            'GET /api/trips/:id': 'Get trip plan details',
            'POST /api/trips/:id/fork': 'Fork a trip plan',
            'PUT /api/trips/:id/status': 'Update plan status'
          },
          personality: {
            'GET /api/personality/modes': 'Get all personality modes',
            'GET /api/personality/modes/:modeId': 'Get specific mode',
            'POST /api/personality/chat': 'Chat with personality mode',
            'POST /api/personality/recommend': 'Recommend mode for message',
            'GET /api/personality/user-preference': 'Get user preferred mode',
            'PUT /api/personality/user-preference': 'Set user preferred mode'
          },
          multimodal: {
            'POST /api/multimodal/voice': 'Process voice input',
            'POST /api/multimodal/image': 'Process image upload',
            'POST /api/multimodal/screenshot': 'Process screenshot',
            'POST /api/multimodal/document': 'Process document upload',
            'POST /api/multimodal/chat': 'Send message with attachments',
            'GET /api/multimodal/attachments': 'Get user attachments',
            'GET /api/multimodal/attachments/:id': 'Get specific attachment',
            'DELETE /api/multimodal/attachments/:id': 'Delete attachment',
            'GET /api/multimodal/search-images': 'Search images by description'
          },
          reviews: {
            'GET /api/reviews/target/:type/:id': 'Get reviews for a target',
            'GET /api/reviews/user/:userId': 'Get reviews by user',
            'GET /api/reviews/summary/:type/:id': 'Get rating summary',
            'POST /api/reviews': 'Create a review',
            'GET /api/reviews/:id': 'Get review details',
            'PUT /api/reviews/:id': 'Update review',
            'DELETE /api/reviews/:id': 'Delete review',
            'POST /api/reviews/:id/helpful': 'Mark review helpful',
            'POST /api/reviews/:id/photos': 'Add photo to review',
            'DELETE /api/reviews/:id/photos/:photoId': 'Remove photo from review',
            'POST /api/reviews/:id/verify': 'Verify review',
            'POST /api/reviews/:id/comments': 'Add comment to review'
          },
          companions: {
            'GET /api/companions/profile/:userId': 'Get traveler profile',
            'POST /api/companions/profile': 'Create/update profile',
            'GET /api/companions/matches/:userId': 'Find compatible companions',
            'GET /api/companions/trips': 'List trip postings',
            'POST /api/companions/trips': 'Create trip posting',
            'GET /api/companions/trips/:id': 'Get trip details',
            'POST /api/companions/trips/:id/apply': 'Apply to join trip',
            'POST /api/companions/trips/:id/accept': 'Accept application',
            'GET /api/companions/trips/:id/expenses': 'Get trip expenses',
            'POST /api/companions/expenses': 'Create expense',
            'POST /api/companions/expenses/:id/settle': 'Settle expense'
          },
          forums: {
            'GET /api/forums': 'List all forums',
            'GET /api/forums/destinations': 'List destination forums',
            'POST /api/forums': 'Create forum',
            'GET /api/forums/:id': 'Get forum by ID',
            'GET /api/forums/slug/:slug': 'Get forum by slug',
            'GET /api/forums/:forumId/topics': 'List topics in forum',
            'POST /api/forums/:forumId/topics': 'Create topic',
            'GET /api/forums/topics/search': 'Search topics',
            'GET /api/forums/topics/:id': 'Get topic details',
            'POST /api/forums/topics/:id/vote': 'Vote on topic',
            'GET /api/forums/topics/:topicId/replies': 'Get replies',
            'POST /api/forums/topics/:topicId/replies': 'Create reply',
            'POST /api/forums/replies/:id/like': 'Like reply',
            'GET /api/forums/users/:userId/stats': 'Get user stats'
          }
        },
        errorFormat: {
          success: false,
          error: 'Human-readable message',
          code: 'MACHINE_READABLE_CODE',
          timestamp: 'ISO8601',
          details: {} // Optional
        }
      }
    });
  });
  
  return router;
}

module.exports = createRoutes;
