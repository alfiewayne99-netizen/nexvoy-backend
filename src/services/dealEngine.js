/**
 * Deal Engine
 * Analyzes deals, scores them, and finds hidden deals
 */

const { getLogger } = require('../utils/logger');
const logger = getLogger();

class DealEngine {
  constructor(options = {}) {
    this.dealCache = new Map();
    this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Analyze deals for a route or destination
   * @param {string} type - 'flight' or 'hotel'
   * @param {string} identifier - Route or location identifier
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Deal analysis
   */
  async analyzeDeals(type, identifier, options = {}) {
    const { days = 90, forceRefresh = false } = options;
    const cacheKey = `analyze:${type}:${identifier}`;

    // Check cache
    if (!forceRefresh && this.dealCache.has(cacheKey)) {
      const cached = this.dealCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    // Generate analysis (mock implementation for now)
    const analysis = {
      found: false,
      type,
      identifier,
      deals: [],
      summary: {
        totalDeals: 0,
        averageSavings: 0,
        bestDeal: null
      },
      reason: 'insufficient_history',
      timestamp: new Date().toISOString()
    };

    // Cache result
    this.dealCache.set(cacheKey, {
      data: analysis,
      timestamp: Date.now()
    });

    return analysis;
  }

  /**
   * Find hidden deals
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Hidden deals
   */
  async findHiddenDeals(options = {}) {
    const { origin, destination, maxPrice } = options;
    
    logger.info('Finding hidden deals', { origin, destination, maxPrice });

    // Mock hidden deals
    const deals = [];
    
    return deals;
  }

  /**
   * Score a specific deal
   * @param {Object} deal - Deal object
   * @param {Object} context - Context for scoring
   * @returns {Object} Deal score
   */
  scoreDeal(deal, context = {}) {
    const price = deal.totalPrice || deal.currentPrice || 0;
    const historicalAverage = context.historicalAverage || price;
    
    // Calculate base score (0-100)
    let score = 50;
    
    // Price factor (0-40 points)
    if (historicalAverage > 0) {
      const discount = (historicalAverage - price) / historicalAverage;
      score += Math.min(40, Math.max(0, discount * 100));
    }
    
    // Urgency factor (0-10 points)
    if (deal.limitedTime || deal.seatsRemaining < 5) {
      score += 10;
    }
    
    // Quality factor (0-10 points)
    if (deal.airlineRating > 4 || deal.hotelStars > 4) {
      score += 10;
    }

    // Determine rating
    let rating = 'fair';
    if (score >= 85) rating = 'excellent';
    else if (score >= 70) rating = 'good';
    else if (score < 50) rating = 'poor';

    return {
      score: Math.round(score),
      rating,
      isDeal: score >= 70,
      factors: {
        priceScore: Math.min(40, Math.max(0, ((historicalAverage - price) / historicalAverage) * 100)),
        urgencyScore: deal.limitedTime ? 10 : 0,
        qualityScore: (deal.airlineRating > 4 || deal.hotelStars > 4) ? 10 : 0
      },
      recommendation: this._getRecommendation(score, rating)
    };
  }

  /**
   * Compare multiple deals
   * @param {Array} deals - Array of deals
   * @returns {Object} Comparison results
   */
  compareDeals(deals) {
    if (!deals || deals.length < 2) {
      return {
        error: 'At least 2 deals required for comparison',
        winner: null,
        comparison: []
      };
    }

    // Score all deals
    const scoredDeals = deals.map(deal => ({
      ...deal,
      score: this.scoreDeal(deal)
    }));

    // Sort by score
    scoredDeals.sort((a, b) => b.score.score - a.score.score);

    // Generate comparison matrix
    const comparison = scoredDeals.map((deal, index) => ({
      rank: index + 1,
      id: deal.id,
      price: deal.totalPrice || deal.currentPrice,
      score: deal.score.score,
      rating: deal.score.rating,
      pros: this._getPros(deal),
      cons: this._getCons(deal)
    }));

    return {
      winner: scoredDeals[0],
      comparison,
      summary: {
        totalCompared: deals.length,
        priceRange: {
          lowest: Math.min(...deals.map(d => d.totalPrice || d.currentPrice || Infinity)),
          highest: Math.max(...deals.map(d => d.totalPrice || d.currentPrice || 0))
        }
      }
    };
  }

  /**
   * Predict future prices
   * @param {string} type - 'flight' or 'hotel'
   * @param {string} identifier - Route or location
   * @param {Object} options - Prediction options
   * @returns {Object} Price prediction
   */
  predictPrices(type, identifier, options = {}) {
    const { days = 60 } = options;
    
    // Generate mock prediction
    const predictions = [];
    const today = new Date();
    const basePrice = type === 'flight' ? 500 : 150;

    for (let i = 1; i <= days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      // Generate prediction with some variance
      const variance = Math.sin(i * 0.1) * (basePrice * 0.15);
      const predictedPrice = Math.round(basePrice + variance);
      
      predictions.push({
        date: date.toISOString().split('T')[0],
        predictedPrice,
        confidence: Math.max(0.3, 1 - (i / days)) // Confidence decreases over time
      });
    }

    // Determine recommendation
    const avgPrediction = predictions.reduce((sum, p) => sum + p.predictedPrice, 0) / predictions.length;
    let recommendation = 'stable';
    let action = 'wait';
    
    if (predictions[0].predictedPrice < avgPrediction * 0.9) {
      recommendation = 'increase';
      action = 'book_now';
    } else if (predictions[0].predictedPrice > avgPrediction * 1.1) {
      recommendation = 'decrease';
      action = 'wait';
    }

    return {
      type,
      identifier,
      days,
      predictions: predictions.slice(0, 30), // Return first 30 days
      trend: recommendation,
      recommendation: action,
      confidence: 0.7,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get recommendation text based on score
   * @private
   */
  _getRecommendation(score, rating) {
    switch (rating) {
      case 'excellent':
        return '🔥 EXCELLENT DEAL! Book now before it\'s gone';
      case 'good':
        return '✅ Good deal - consider booking soon';
      case 'fair':
        return 'Fair price - consider setting a price alert';
      case 'poor':
        return '⏸️ Price is above average - wait or set an alert';
      default:
        return 'Set an alert to track price changes';
    }
  }

  /**
   * Get pros for a deal
   * @private
   */
  _getPros(deal) {
    const pros = [];
    if (deal.discount > 20) pros.push('Significant savings');
    if (deal.flexibleCancellation) pros.push('Flexible cancellation');
    if (deal.airlineRating > 4) pros.push('Highly rated airline');
    if (deal.hotelStars > 4) pros.push('Luxury accommodation');
    return pros;
  }

  /**
   * Get cons for a deal
   * @private
   */
  _getCons(deal) {
    const cons = [];
    if (deal.changeFees) cons.push('Change fees apply');
    if (deal.limitedAvailability) cons.push('Limited availability');
    if (deal.layovers > 1) cons.push('Multiple layovers');
    return cons;
  }
}

module.exports = DealEngine;
