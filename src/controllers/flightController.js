/**
 * Flight Controller
 * Handles flight search and comparison endpoints
 */

const { asyncHandler } = require('../middleware/errorHandler');
const {
  ValidationError,
  MissingFieldError,
  InvalidInputError
} = require('../utils/errors');
const { getLogger } = require('../utils/logger');

const logger = getLogger();

/**
 * Create flight controller with injected services
 */
function createFlightController(priceService) {
  /**
   * Compare flight prices
   * POST /api/flights/compare
   */
  const compareFlights = asyncHandler(async (req, res) => {
    const { origin, destination, dates, options = {} } = req.body;
    
    // Validation
    if (!origin) {
      throw new MissingFieldError('origin');
    }
    
    if (!destination) {
      throw new MissingFieldError('destination');
    }
    
    if (!dates || !dates.departure) {
      throw new MissingFieldError('dates.departure');
    }
    
    // Validate airport codes
    if (!/^[A-Z]{3}$/.test(origin)) {
      throw new InvalidInputError('origin', { 
        message: 'Origin must be a 3-letter airport code (e.g., JFK)' 
      });
    }
    
    if (!/^[A-Z]{3}$/.test(destination)) {
      throw new InvalidInputError('destination', { 
        message: 'Destination must be a 3-letter airport code (e.g., LHR)' 
      });
    }
    
    // Validate dates
    const departureDate = new Date(dates.departure);
    if (isNaN(departureDate.getTime())) {
      throw new InvalidInputError('dates.departure', {
        message: 'Invalid departure date format. Use YYYY-MM-DD'
      });
    }
    
    if (dates.return) {
      const returnDate = new Date(dates.return);
      if (isNaN(returnDate.getTime())) {
        throw new InvalidInputError('dates.return', {
          message: 'Invalid return date format. Use YYYY-MM-DD'
        });
      }
      
      if (returnDate < departureDate) {
        throw new ValidationError('Return date must be after departure date', {
          departure: dates.departure,
          return: dates.return
        });
      }
    }
    
    // Perform comparison
    logger.info(`Comparing flights: ${origin} → ${destination}`, {
      userId: req.user?.id,
      requestId: req.id
    });
    
    const results = await priceService.compareFlights(origin, destination, dates, options);
    
    res.json({
      success: true,
      data: results,
      meta: {
        searchId: results.searchId,
        timestamp: results.timestamp,
        totalResults: results.summary.totalResults
      }
    });
  });

  /**
   * Get flight price history
   * GET /api/flights/history/:route
   */
  const getPriceHistory = asyncHandler(async (req, res) => {
    const { route } = req.params;
    const { days = 30 } = req.query;
    
    if (!route || !route.includes('-')) {
      throw new InvalidInputError('route', {
        message: 'Route must be in format ORIGIN-DESTINATION (e.g., JFK-LHR)'
      });
    }
    
    const [origin, destination] = route.split('-');
    
    if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) {
      throw new InvalidInputError('route', {
        message: 'Route must use 3-letter airport codes'
      });
    }
    
    const history = priceService.getPriceHistory(`${origin}-${destination}`, 'flight', {
      days: parseInt(days, 10)
    });
    
    res.json({
      success: true,
      data: history
    });
  });

  /**
   * Check if a price is a good deal
   * POST /api/flights/deal-check
   */
  const checkDeal = asyncHandler(async (req, res) => {
    const { price, route } = req.body;
    
    if (typeof price !== 'number' || price <= 0) {
      throw new InvalidInputError('price', {
        message: 'Price must be a positive number'
      });
    }
    
    if (!route) {
      throw new MissingFieldError('route');
    }
    
    const history = priceService.getPriceHistory(route, 'flight', { days: 90 });
    
    if (!history.average) {
      res.json({
        success: true,
        data: {
          isDeal: false,
          rating: 'unknown',
          recommendation: 'Not enough historical data for this route yet'
        }
      });
      return;
    }
    
    const deal = priceService.isGoodDeal(price, history.average);
    
    res.json({
      success: true,
      data: deal
    });
  });

  /**
   * Predict future prices
   * GET /api/flights/predict/:route
   */
  const predictPrices = asyncHandler(async (req, res) => {
    const { route } = req.params;
    
    if (!route || !route.includes('-')) {
      throw new InvalidInputError('route', {
        message: 'Route must be in format ORIGIN-DESTINATION'
      });
    }
    
    // Note: This requires dealEngine, which should be passed in constructor
    // For now, we'll return basic prediction
    const history = priceService.getPriceHistory(route, 'flight', { days: 60 });
    
    res.json({
      success: true,
      data: {
        route,
        trend: history.trend,
        historicalLow: history.lowest,
        historicalHigh: history.highest,
        historicalAverage: history.average,
        recommendation: history.trend === 'falling' 
          ? 'Prices are trending down - consider waiting'
          : history.trend === 'rising'
          ? 'Prices are trending up - book soon'
          : 'Prices are stable - set an alert for price drops'
      }
    });
  });

  /**
   * Get popular flight routes
   * GET /api/flights/popular
   */
  const getPopularRoutes = asyncHandler(async (req, res) => {
    // This would typically come from a database or analytics service
    const popularRoutes = [
      { origin: 'JFK', destination: 'LHR', name: 'New York to London' },
      { origin: 'LAX', destination: 'NRT', name: 'Los Angeles to Tokyo' },
      { origin: 'SFO', destination: 'CDG', name: 'San Francisco to Paris' },
      { origin: 'MIA', destination: 'GRU', name: 'Miami to São Paulo' },
      { origin: 'ORD', destination: 'FCO', name: 'Chicago to Rome' }
    ];
    
    res.json({
      success: true,
      data: popularRoutes
    });
  });

  return {
    compareFlights,
    getPriceHistory,
    checkDeal,
    predictPrices,
    getPopularRoutes
  };
}

module.exports = { createFlightController };
