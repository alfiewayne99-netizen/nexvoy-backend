/**
 * Hotel Controller
 * Handles hotel search and comparison endpoints
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
 * Create hotel controller with injected services
 */
function createHotelController(priceService) {
  /**
   * Compare hotel prices
   * POST /api/hotels/compare
   */
  const compareHotels = asyncHandler(async (req, res) => {
    const { location, dates, guests = {}, options = {} } = req.body;
    
    // Validation
    if (!location) {
      throw new MissingFieldError('location');
    }
    
    if (!dates || !dates.checkIn) {
      throw new MissingFieldError('dates.checkIn');
    }
    
    if (!dates.checkOut) {
      throw new MissingFieldError('dates.checkOut');
    }
    
    // Validate dates
    const checkIn = new Date(dates.checkIn);
    const checkOut = new Date(dates.checkOut);
    
    if (isNaN(checkIn.getTime())) {
      throw new InvalidInputError('dates.checkIn', {
        message: 'Invalid check-in date format. Use YYYY-MM-DD'
      });
    }
    
    if (isNaN(checkOut.getTime())) {
      throw new InvalidInputError('dates.checkOut', {
        message: 'Invalid check-out date format. Use YYYY-MM-DD'
      });
    }
    
    if (checkOut <= checkIn) {
      throw new ValidationError('Check-out date must be after check-in date', {
        checkIn: dates.checkIn,
        checkOut: dates.checkOut
      });
    }
    
    // Validate guests
    if (guests.adults && (typeof guests.adults !== 'number' || guests.adults < 1)) {
      throw new InvalidInputError('guests.adults', {
        message: 'Must have at least 1 adult'
      });
    }
    
    // Perform comparison
    logger.info(`Comparing hotels in: ${location}`, {
      userId: req.user?.id,
      requestId: req.id
    });
    
    const results = await priceService.compareHotels(location, dates, guests, options);
    
    res.json({
      success: true,
      data: results,
      meta: {
        searchId: results.searchId,
        timestamp: results.timestamp,
        totalResults: results.summary.totalResults,
        nights: Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
      }
    });
  });

  /**
   * Get hotel price history
   * GET /api/hotels/history/:location
   */
  const getPriceHistory = asyncHandler(async (req, res) => {
    const { location } = req.params;
    const { days = 30 } = req.query;
    
    if (!location) {
      throw new MissingFieldError('location');
    }
    
    const history = priceService.getPriceHistory(location, 'hotel', {
      days: parseInt(days, 10)
    });
    
    res.json({
      success: true,
      data: history
    });
  });

  /**
   * Check if a hotel price is a good deal
   * POST /api/hotels/deal-check
   */
  const checkDeal = asyncHandler(async (req, res) => {
    const { price, location } = req.body;
    
    if (typeof price !== 'number' || price <= 0) {
      throw new InvalidInputError('price', {
        message: 'Price must be a positive number'
      });
    }
    
    if (!location) {
      throw new MissingFieldError('location');
    }
    
    const history = priceService.getPriceHistory(location, 'hotel', { days: 90 });
    
    if (!history.average) {
      res.json({
        success: true,
        data: {
          isDeal: false,
          rating: 'unknown',
          recommendation: 'Not enough historical data for this location yet'
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
   * Get popular hotel destinations
   * GET /api/hotels/popular
   */
  const getPopularDestinations = asyncHandler(async (req, res) => {
    const destinations = [
      { id: 'paris', name: 'Paris', country: 'France' },
      { id: 'london', name: 'London', country: 'UK' },
      { id: 'tokyo', name: 'Tokyo', country: 'Japan' },
      { id: 'new-york', name: 'New York', country: 'USA' },
      { id: 'barcelona', name: 'Barcelona', country: 'Spain' },
      { id: 'dubai', name: 'Dubai', country: 'UAE' },
      { id: 'singapore', name: 'Singapore', country: 'Singapore' },
      { id: 'sydney', name: 'Sydney', country: 'Australia' }
    ];
    
    res.json({
      success: true,
      data: destinations
    });
  });

  /**
   * Get hotel amenities filter options
   * GET /api/hotels/amenities
   */
  const getAmenities = asyncHandler(async (req, res) => {
    const amenities = [
      { id: 'wifi', name: 'Free WiFi', icon: 'wifi' },
      { id: 'pool', name: 'Swimming Pool', icon: 'pool' },
      { id: 'gym', name: 'Fitness Center', icon: 'gym' },
      { id: 'spa', name: 'Spa', icon: 'spa' },
      { id: 'restaurant', name: 'Restaurant', icon: 'restaurant' },
      { id: 'parking', name: 'Free Parking', icon: 'parking' },
      { id: 'breakfast', name: 'Breakfast Included', icon: 'breakfast' },
      { id: 'pets', name: 'Pet Friendly', icon: 'pets' }
    ];
    
    res.json({
      success: true,
      data: amenities
    });
  });

  return {
    compareHotels,
    getPriceHistory,
    checkDeal,
    getPopularDestinations,
    getAmenities
  };
}

module.exports = { createHotelController };
