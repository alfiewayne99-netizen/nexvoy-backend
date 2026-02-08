/**
 * Nexvoy Backend API
 * Main entry point and server setup
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Import Nexvoy services
const bookingLinkService = require('../src/services/bookingLinkService').default;

// Mock services for now - replace with actual implementations
const mockPriceService = {
  searchFlights: async () => ({
    flights: [],
    meta: { count: 0, source: 'mock' }
  }),
  searchHotels: async () => ({
    hotels: [],
    meta: { count: 0, source: 'mock' }
  }),
  getPriceHistory: async () => [],
  trackPrice: async () => ({ success: true })
};

const mockAlertService = {
  createAlert: async () => ({ id: 'mock-alert' }),
  getAlerts: async () => [],
  deleteAlert: async () => ({ success: true })
};

const mockDealEngine = {
  findDeals: async () => [],
  analyzeDeal: async () => ({ score: 0 })
};

// Import middleware
const {
  errorHandler,
  notFoundHandler,
  requestIdMiddleware
} = require('./middleware/errorHandler');

// Import controllers
const { createFlightController } = require('./controllers/flightController');
const { createHotelController } = require('./controllers/hotelController');
const { createAlertController } = require('./controllers/alertController');
const { createDealController } = require('./controllers/dealController');
const { createBookingLinkController } = require('./controllers/bookingLinkController');
const ChatController = require('./controllers/chatController');

// Import routes
const createRoutes = require('./routes');
const authRoutes = require('./routes/authRoutes');
const { setupChatWebSocket } = require('./routes/chatRoutes');
const StripeWebhookHandler = require('./webhooks/stripeWebhook');

/**
 * Create Express app with all middleware and routes
 */
function createApp(config = {}) {
  const app = express();
  
  // Security middleware
  app.use(helmet());
  app.use(cors(config.cors || {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
  }));
  
  // Compression
  app.use(compression());
  
  // Request ID
  app.use(requestIdMiddleware);
  
  // Health check (before auth)
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });
  
  // Stripe webhook endpoint - MUST be before express.json() to get raw body
  const webhookHandler = new StripeWebhookHandler(config.database);
  app.post('/api/payments/webhook/stripe',
    express.raw({ type: 'application/json' }),
    (req, res) => webhookHandler.handleWebhook(req, res)
  );
  
  // Body parsing (after webhook)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Create chat controller
  const chatController = new ChatController({});
  
  // Create controllers
  const controllers = {
    flights: createFlightController(mockPriceService),
    hotels: createHotelController(mockPriceService),
    alerts: createAlertController(mockAlertService),
    deals: createDealController(mockDealEngine, mockPriceService),
    booking: createBookingLinkController(bookingLinkService),
    chat: chatController
  };
  
  // Mount auth routes
  app.use('/api/auth', authRoutes);
  
  // Mount routes
  const services = {
    priceService: mockPriceService,
  };
  app.use('/api', createRoutes(controllers, services, config.database));
  
  // 404 handler
  app.use(notFoundHandler);
  
  // Global error handler
  app.use(errorHandler);
  
  // Attach instances for external access
  app.chatController = chatController;
  
  return app;
}

/**
 * Start the server
 */
async function startServer(options = {}) {
  const config = {
    port: process.env.PORT || 3002,
    host: process.env.HOST || '0.0.0.0',
    ...options
  };
  
  const app = createApp(config);
  
  // Start server
  const server = app.listen(config.port, config.host, () => {
    console.log(`🚀 Nexvoy API server running on http://${config.host}:${config.port}`);
    console.log(`📚 API documentation available at http://${config.host}:${config.port}/api/docs`);
    console.log(`💬 Chat WebSocket available at ws://${config.host}:${config.port}/api/chat/ws`);
    console.log(`💳 Payment webhooks at http://${config.host}:${config.port}/api/payments/webhook/stripe`);
  });
  
  // Setup WebSocket for chat
  const wss = setupChatWebSocket(server, app.chatController);
  app.wss = wss;
  
  // Graceful shutdown
  const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    // Close WebSocket connections
    if (wss) {
      wss.clients.forEach(client => {
        client.close();
      });
    }
    
    server.close(async () => {
      console.log('HTTP server closed');
      
      // Stop alert monitoring
      if (app.nexvoy.alertService.isRunning) {
        app.nexvoy.stopAlertMonitoring();
      }
      
      // Shutdown logger (Sentry flush)
      try {
        const { getLogger } = require('./utils/logger');
        await getLogger().shutdown();
      } catch (e) {
        // Logger might not be initialized
      }
      
      console.log('Graceful shutdown complete');
      process.exit(0);
    });
    
    // Force shutdown after 30s
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  return { app, server, wss };
}

// If run directly, start server
if (require.main === module) {
  startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = {
  createApp,
  startServer
};
