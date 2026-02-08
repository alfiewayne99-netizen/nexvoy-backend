/**
 * Price Service
 * Handles price comparison across OTAs for flights and hotels
 */

const { OTAAdapterFactory } = require('./otaAdapters');
const { getLogger } = require('../utils/logger');
const logger = getLogger();

class PriceService {
  constructor() {
    this.adapters = new Map();
    this.priceHistory = new Map(); // In-memory cache for price history
    
    // Initialize adapters
    this._initializeAdapters();
  }
  
  /**
   * Initialize OTA adapters
   * @private
   */
  _initializeAdapters() {
    try {
      const adapterTypes = ['expedia', 'booking', 'skyscanner', 'kayak'];

      for (const type of adapterTypes) {
        try {
          const adapter = OTAAdapterFactory.createAdapter(type, {
            apiKey: process.env[`${type.toUpperCase()}_API_KEY`]
          });
          this.adapters.set(type, adapter);
          logger.logInfo(`Initialized ${type} adapter`);
        } catch (error) {
          logger.logWarning(`Failed to initialize ${type} adapter: ${error.message}`);
        }
      }
    } catch (error) {
      logger.logError(error, { context: 'PriceService._initializeAdapters' });
    }
  }

  /**
   * Compare flight prices across OTAs
   * @param {string} origin - Origin airport code (e.g., JFK)
   * @param {string} destination - Destination airport code (e.g., LHR)
   * @param {Object} dates - { departure, return }
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Comparison results
   */
  async compareFlights(origin, destination, dates, options = {}) {
    const searchId = `flight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // For now, return mock data structure that matches expected format
    // In production, this would call OTA adapters
    const mockResults = {
      searchId,
      timestamp: new Date().toISOString(),
      query: { origin, destination, dates, options },
      results: [],
      summary: {
        totalResults: 0,
        sources: [],
        priceRange: { lowest: null, highest: null, average: null }
      }
    };

    // Store search for history tracking
    this._storeSearch('flight', `${origin}-${destination}`, mockResults);

    return mockResults;
  }

  /**
   * Compare hotel prices across OTAs
   * @param {string} location - Location/city name
   * @param {Object} dates - { checkIn, checkOut }
   * @param {Object} guests - { adults, children, rooms }
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Comparison results
   */
  async compareHotels(location, dates, guests, options = {}) {
    const searchId = `hotel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // For now, return mock data structure
    // In production, this would call OTA adapters
    const nights = Math.ceil(
      (new Date(dates.checkOut) - new Date(dates.checkIn)) / (1000 * 60 * 60 * 24)
    );

    const mockResults = {
      searchId,
      timestamp: new Date().toISOString(),
      query: { location, dates, guests, options },
      results: [],
      summary: {
        totalResults: 0,
        sources: [],
        priceRange: { lowest: null, highest: null, average: null },
        nights
      }
    };

    // Store search for history tracking
    this._storeSearch('hotel', location, mockResults);

    return mockResults;
  }

  /**
   * Search flights (alias for compareFlights with different signature)
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} Search results
   */
  async searchFlights(searchParams) {
    const { origin, destination, departureDate, returnDate, adults = 1, children = 0, cabinClass = 'economy' } = searchParams;
    
    return this.compareFlights(
      origin,
      destination,
      { departure: departureDate, return: returnDate },
      { passengers: adults + children, cabin: cabinClass }
    );
  }

  /**
   * Search hotels (alias for compareHotels with different signature)
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} Search results
   */
  async searchHotels(searchParams) {
    const { destination, checkIn, checkOut, guests = 2 } = searchParams;
    
    return this.compareHotels(
      destination,
      { checkIn, checkOut },
      { adults: guests, children: 0, rooms: 1 }
    );
  }

  /**
   * Get price history for a route/location
   * @param {string} identifier - Route (ORIGIN-DEST) or location
   * @param {string} type - 'flight' or 'hotel'
   * @param {Object} options - { days }
   * @returns {Object} Price history
   */
  getPriceHistory(identifier, type, options = {}) {
    const { days = 30 } = options;
    const key = `${type}:${identifier}`;
    const history = this.priceHistory.get(key) || [];
    
    // Generate mock history if none exists
    if (history.length === 0) {
      return this._generateMockPriceHistory(days, type);
    }

    // Return last N days
    return {
      identifier,
      type,
      days,
      data: history.slice(-days),
      average: null,
      lowest: null,
      highest: null,
      trend: 'stable'
    };
  }

  /**
   * Check if a price is a good deal
   * @param {number} price - Current price
   * @param {number} average - Historical average
   * @returns {Object} Deal assessment
   */
  isGoodDeal(price, average) {
    if (!average || average === 0) {
      return {
        isDeal: false,
        rating: 'unknown',
        recommendation: 'Not enough historical data',
        savings: { amount: 0, percentage: 0 }
      };
    }

    const savings = average - price;
    const percentage = (savings / average) * 100;
    
    let isDeal = false;
    let rating = 'fair';
    let recommendation = 'Fair price - consider setting an alert';

    if (percentage > 20) {
      isDeal = true;
      rating = 'excellent';
      recommendation = '🔥 EXCELLENT DEAL! Book now';
    } else if (percentage > 10) {
      isDeal = true;
      rating = 'good';
      recommendation = '✅ Good deal - consider booking soon';
    } else if (percentage < -10) {
      rating = 'poor';
      recommendation = 'Price is above average - wait or set an alert';
    }

    return {
      isDeal,
      rating,
      recommendation,
      savings: {
        amount: Math.round(savings),
        percentage: Math.round(percentage)
      },
      context: {
        currentPrice: price,
        historicalAverage: average
      }
    };
  }

  /**
   * Store search results for history tracking
   * @private
   */
  _storeSearch(type, identifier, results) {
    const key = `${type}:${identifier}`;
    const history = this.priceHistory.get(key) || [];
    
    history.push({
      timestamp: new Date().toISOString(),
      results
    });

    // Keep only last 90 days
    if (history.length > 90) {
      history.shift();
    }

    this.priceHistory.set(key, history);
  }

  /**
   * Generate mock price history for development
   * @private
   */
  _generateMockPriceHistory(days, type) {
    const history = [];
    const basePrice = type === 'flight' ? 500 : 150;
    const today = new Date();

    for (let i = days; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Generate realistic price variation
      const variation = Math.sin(i * 0.5) * (basePrice * 0.2) + (Math.random() * basePrice * 0.1);
      const price = Math.round(basePrice + variation);
      
      history.push({
        date: date.toISOString().split('T')[0],
        price,
        currency: 'USD'
      });
    }

    const prices = history.map(h => h.price);
    const average = prices.reduce((a, b) => a + b, 0) / prices.length;
    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);
    
    // Determine trend
    const recent = prices.slice(-7);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = prices.slice(-14, -7);
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
    
    let trend = 'stable';
    if (recentAvg < olderAvg * 0.95) trend = 'falling';
    else if (recentAvg > olderAvg * 1.05) trend = 'rising';

    return {
      data: history,
      average: Math.round(average),
      lowest,
      highest,
      trend,
      days
    };
  }
}

module.exports = PriceService;
