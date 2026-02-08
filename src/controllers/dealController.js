/**
 * Deal Controller
 * Handles deal detection and analysis endpoints
 */

const { asyncHandler } = require('../middleware/errorHandler');
const {
  ValidationError,
  MissingFieldError,
  InvalidInputError,
  InsufficientDataError
} = require('../utils/errors');
const { getLogger } = require('../utils/logger');

const logger = getLogger();

/**
 * Create deal controller with injected services
 */
function createDealController(dealEngine, priceService) {
  /**
   * Analyze deals for a route/destination
   * GET /api/deals/analyze
   */
  const analyzeDeals = asyncHandler(async (req, res) => {
    const { type, identifier } = req.query;
    
    if (!type) {
      throw new MissingFieldError('type');
    }
    
    if (!['flight', 'hotel'].includes(type)) {
      throw new InvalidInputError('type', {
        message: 'Type must be either "flight" or "hotel"'
      });
    }
    
    if (!identifier) {
      throw new MissingFieldError('identifier');
    }
    
    // Validate identifier format for flights
    if (type === 'flight' && !identifier.includes('-')) {
      throw new InvalidInputError('identifier', {
        message: 'Flight identifier must be in format ORIGIN-DESTINATION (e.g., JFK-LHR)'
      });
    }
    
    logger.info(`Analyzing ${type} deals for: ${identifier}`, {
      userId: req.user?.id,
      requestId: req.id
    });
    
    const analysis = await dealEngine.analyzeDeals(type, identifier, {
      days: parseInt(req.query.days, 10) || 90,
      forceRefresh: req.query.refresh === 'true'
    });
    
    if (!analysis.found && analysis.reason === 'insufficient_history') {
      throw new InsufficientDataError(type, { identifier });
    }
    
    res.json({
      success: true,
      data: analysis
    });
  });

  /**
   * Find hidden deals
   * GET /api/deals/hidden
   */
  const findHiddenDeals = asyncHandler(async (req, res) => {
    logger.info('Finding hidden deals', {
      userId: req.user?.id,
      requestId: req.id
    });
    
    const deals = await dealEngine.findHiddenDeals({
      origin: req.query.origin,
      destination: req.query.destination,
      maxPrice: req.query.maxPrice ? parseInt(req.query.maxPrice, 10) : undefined
    });
    
    res.json({
      success: true,
      data: deals,
      meta: {
        count: deals.length,
        timestamp: new Date().toISOString()
      }
    });
  });

  /**
   * Score a specific deal
   * POST /api/deals/score
   */
  const scoreDeal = asyncHandler(async (req, res) => {
    const { deal } = req.body;
    
    if (!deal) {
      throw new MissingFieldError('deal');
    }
    
    // Validate required deal fields
    if (!deal.totalPrice && !deal.currentPrice) {
      throw new ValidationError('Deal must have a price');
    }
    
    const score = dealEngine.scoreDeal(deal, req.body.context || {});
    
    res.json({
      success: true,
      data: score
    });
  });

  /**
   * Compare multiple deals
   * POST /api/deals/compare
   */
  const compareDeals = asyncHandler(async (req, res) => {
    const { deals } = req.body;
    
    if (!deals || !Array.isArray(deals)) {
      throw new ValidationError('deals must be an array');
    }
    
    if (deals.length < 2) {
      throw new ValidationError('At least 2 deals are required for comparison');
    }
    
    const comparison = dealEngine.compareDeals(deals);
    
    res.json({
      success: true,
      data: comparison
    });
  });

  /**
   * Predict future prices
   * GET /api/deals/predict
   */
  const predictPrices = asyncHandler(async (req, res) => {
    const { type, identifier } = req.query;
    
    if (!type) {
      throw new MissingFieldError('type');
    }
    
    if (!identifier) {
      throw new MissingFieldError('identifier');
    }
    
    const prediction = dealEngine.predictPrices(type, identifier, {
      days: parseInt(req.query.days, 10) || 60
    });
    
    res.json({
      success: true,
      data: prediction
    });
  });

  /**
   * Get current deals (cached)
   * GET /api/deals/current
   */
  const getCurrentDeals = asyncHandler(async (req, res) => {
    const { type, location } = req.query;
    
    // Get from cache or fetch new
    const cacheKey = `deals:current:${type}:${location || 'all'}`;
    
    // This would typically use a cache service
    // For now, return empty deals list
    res.json({
      success: true,
      data: {
        deals: [],
        timestamp: new Date().toISOString(),
        cacheKey
      }
    });
  });

  /**
   * Get deal categories
   * GET /api/deals/categories
   */
  const getCategories = asyncHandler(async (req, res) => {
    const categories = [
      { id: 'flash_sale', name: 'Flash Sales', description: 'Limited-time offers' },
      { id: 'error_fare', name: 'Error Fares', description: 'Mistakenly low prices' },
      { id: 'price_drop', name: 'Price Drops', description: 'Recently reduced prices' },
      { id: 'package', name: 'Package Deals', description: 'Flight + Hotel bundles' },
      { id: 'seasonal', name: 'Seasonal Deals', description: 'Off-season discounts' }
    ];
    
    res.json({
      success: true,
      data: categories
    });
  });

  return {
    analyzeDeals,
    findHiddenDeals,
    scoreDeal,
    compareDeals,
    predictPrices,
    getCurrentDeals,
    getCategories
  };
}

module.exports = { createDealController };
