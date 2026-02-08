/**
 * OTA Adapter Interface (Enhanced with Error Handling)
 * Standardized interface for all OTA integrations
 */

const {
  OTAAdapterError,
  RateLimitError,
  TimeoutError,
  NetworkError,
  ValidationError,
  HTTP_STATUS,
  ERROR_CODES
} = require('../utils/errors');

const { getLogger } = require('../utils/logger');

const logger = getLogger();

class OTAAdapter {
  constructor(config) {
    this.name = config.name;
    this.baseUrl = config.baseUrl;
    this.commission = config.commission;
    this.apiKey = config.apiKey;
    this.rateLimit = config.rateLimit || { requests: 100, window: 60000 };
    this.requestCount = 0;
    this.windowStart = Date.now();
    this.timeout = config.timeout || 30000; // 30 second default timeout
    this.maxRetries = config.maxRetries || 2;
  }

  /**
   * Check rate limit before making request
   */
  async checkRateLimit() {
    const now = Date.now();
    if (now - this.windowStart > this.rateLimit.window) {
      this.requestCount = 0;
      this.windowStart = now;
    }
    
    if (this.requestCount >= this.rateLimit.requests) {
      const waitTime = this.rateLimit.window - (now - this.windowStart);
      logger.warn(`Rate limit reached for ${this.name}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.checkRateLimit();
    }
    
    this.requestCount++;
    return true;
  }

  /**
   * Make API request with error handling
   */
  async makeRequest(url, options = {}) {
    await this.checkRateLimit();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Handle HTTP errors
      if (!response.ok) {
        await this.handleHttpError(response);
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw this.convertError(error);
    }
  }

  /**
   * Handle HTTP error responses
   */
  async handleHttpError(response) {
    const status = response.status;
    
    if (status === 429) {
      throw new RateLimitError(60);
    }
    
    if (status === 401 || status === 403) {
      throw new OTAAdapterError(this.name, new Error('API authentication failed'));
    }
    
    if (status === 404) {
      throw new OTAAdapterError(this.name, new Error('Resource not found'));
    }
    
    if (status >= 500) {
      throw new OTAAdapterError(this.name, new Error(`OTA server error: ${status}`));
    }
    
    const body = await response.text();
    throw new OTAAdapterError(this.name, new Error(`HTTP ${status}: ${body}`));
  }

  /**
   * Convert various errors to NexvoyError
   */
  convertError(error) {
    // Already a NexvoyError
    if (error.code && error.statusCode) {
      return error;
    }
    
    // Abort/timeout errors
    if (error.name === 'AbortError') {
      return new TimeoutError(this.name);
    }
    
    // Network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new NetworkError(this.name);
    }
    
    // Timeout errors
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return new TimeoutError(this.name);
    }
    
    // Default to OTA error
    return new OTAAdapterError(this.name, error);
  }

  /**
   * Search flights - must be implemented by each adapter
   */
  async searchFlights(params) {
    throw new OTAAdapterError(this.name, new Error('searchFlights must be implemented'));
  }

  /**
   * Search hotels - must be implemented by each adapter
   */
  async searchHotels(params) {
    throw new OTAAdapterError(this.name, new Error('searchHotels must be implemented'));
  }

  /**
   * Get booking URL
   */
  getBookingUrl(result) {
    throw new OTAAdapterError(this.name, new Error('getBookingUrl must be implemented'));
  }

  /**
   * Standardize flight result format
   */
  standardizeFlight(rawResult) {
    return {
      id: rawResult.id,
      airline: rawResult.airline,
      flightNumber: rawResult.flightNumber,
      price: rawResult.price,
      currency: rawResult.currency || 'USD',
      departure: {
        airport: rawResult.departureAirport,
        time: rawResult.departureTime,
        terminal: rawResult.departureTerminal
      },
      arrival: {
        airport: rawResult.arrivalAirport,
        time: rawResult.arrivalTime,
        terminal: rawResult.arrivalTerminal
      },
      duration: rawResult.duration,
      stops: rawResult.stops || 0,
      isDirect: (rawResult.stops || 0) === 0,
      baggage: {
        included: rawResult.baggageIncluded || false,
        carryOn: rawResult.carryOnBags || 1,
        checked: rawResult.checkedBags || 0
      },
      cancellation: rawResult.cancellationPolicy || 'unknown',
      amenities: rawResult.amenities || [],
      raw: rawResult
    };
  }

  /**
   * Standardize hotel result format
   */
  standardizeHotel(rawResult) {
    return {
      id: rawResult.id,
      name: rawResult.name,
      price: rawResult.price,
      currency: rawResult.currency || 'USD',
      stars: rawResult.stars || 0,
      rating: rawResult.rating || 0,
      reviews: rawResult.reviewCount || 0,
      location: {
        address: rawResult.address,
        city: rawResult.city,
        coordinates: rawResult.coordinates,
        neighborhood: rawResult.neighborhood
      },
      amenities: rawResult.amenities || [],
      images: rawResult.images || [],
      room: {
        type: rawResult.roomType,
        beds: rawResult.bedCount,
        maxGuests: rawResult.maxGuests
      },
      policies: {
        freeCancellation: rawResult.freeCancellation || false,
        breakfastIncluded: rawResult.breakfastIncluded || false,
        payAtProperty: rawResult.payAtProperty || false
      },
      fees: {
        resortFee: rawResult.resortFee || 0,
        cleaningFee: rawResult.cleaningFee || 0,
        cityTax: rawResult.cityTax || 0
      },
      raw: rawResult
    };
  }
}

// ============================================================================
// SPECIFIC OTA ADAPTERS
// ============================================================================

class BookingAdapter extends OTAAdapter {
  constructor(config) {
    super({
      name: 'Booking.com',
      commission: 0.15,
      baseUrl: 'https://distribution-xml.booking.com/json/bookings',
      ...config
    });
  }

  async searchHotels(params) {
    if (!params.checkIn || !params.checkOut) {
      throw new ValidationError('Check-in and check-out dates are required');
    }
    
    const queryParams = new URLSearchParams({
      checkin: params.checkIn,
      checkout: params.checkOut,
      city_ids: params.cityId,
      room1: `A${params.adults},${params.children || 0}`,
      rows: '20',
      output: 'hotel_details,room_details'
    });

    try {
      const response = await this.makeRequest(
        `${this.baseUrl}.getHotels?${queryParams}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.result || !Array.isArray(response.result)) {
        logger.warn(`Unexpected response format from ${this.name}`);
        return [];
      }
      
      return response.result.map(hotel => this.standardizeHotel({
        id: hotel.hotel_id,
        name: hotel.hotel_name,
        price: hotel.min_rate,
        currency: hotel.currencycode,
        stars: hotel.class,
        rating: hotel.review_score,
        reviewCount: hotel.review_nr,
        address: hotel.address,
        city: hotel.city,
        amenities: hotel.hotel_facilities?.split(','),
        freeCancellation: hotel.cancellation_policy === 'free_cancellation',
        ...hotel
      }));
    } catch (error) {
      logger.error(`Booking.com API error: ${error.message}`, { 
        adapter: this.name,
        operation: 'searchHotels' 
      });
      throw error;
    }
  }

  getBookingUrl(result) {
    if (!result.raw?.hotel_id) {
      throw new ValidationError('Hotel ID is required for booking URL');
    }
    return `https://www.booking.com/hotel/${result.raw.hotel_id}.html?aid=${this.affiliateId}`;
  }
}

class ExpediaAdapter extends OTAAdapter {
  constructor(config) {
    super({
      name: 'Expedia',
      commission: 0.12,
      baseUrl: 'https://api.expedia.com/v3',
      ...config
    });
  }

  async searchFlights(params) {
    this._validateFlightParams(params);
    
    try {
      const response = await this.makeRequest(
        `${this.baseUrl}/flights/search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            origin: params.origin,
            destination: params.destination,
            departureDate: params.departure,
            returnDate: params.return,
            adults: params.passengers || 1,
            cabinClass: params.cabin || 'ECONOMY'
          })
        }
      );
      
      if (!response.flights || !Array.isArray(response.flights)) {
        logger.warn(`Unexpected response format from ${this.name}`);
        return [];
      }
      
      return response.flights.map(flight => this.standardizeFlight({
        id: flight.offerId,
        airline: flight.segments[0].carrierCode,
        flightNumber: flight.segments[0].flightNumber,
        price: flight.price.total,
        currency: flight.price.currency,
        departureAirport: flight.segments[0].departure.iataCode,
        departureTime: flight.segments[0].departure.at,
        arrivalAirport: flight.segments[flight.segments.length - 1].arrival.iataCode,
        arrivalTime: flight.segments[flight.segments.length - 1].arrival.at,
        duration: flight.segments.reduce((acc, seg) => acc + seg.duration, 0),
        stops: flight.segments.length - 1,
        baggageIncluded: flight.baggageAllowance?.included || false,
        ...flight
      }));
    } catch (error) {
      logger.error(`Expedia API error: ${error.message}`, { 
        adapter: this.name,
        operation: 'searchFlights' 
      });
      throw error;
    }
  }

  async searchHotels(params) {
    // Implementation similar to flights
    logger.info(`Expedia hotel search not yet implemented`);
    return [];
  }

  getBookingUrl(result) {
    if (!result.id) {
      throw new ValidationError('Result ID is required for booking URL');
    }
    return `https://www.expedia.com/Flight-Information?offerId=${result.id}&aid=${this.affiliateId}`;
  }

  _validateFlightParams(params) {
    if (!params.origin) throw new ValidationError('Origin is required');
    if (!params.destination) throw new ValidationError('Destination is required');
    if (!params.departure) throw new ValidationError('Departure date is required');
  }
}

class SkyscannerAdapter extends OTAAdapter {
  constructor(config) {
    super({
      name: 'Skyscanner',
      commission: 0.10,
      baseUrl: 'https://partners.api.skyscanner.net/apiservices',
      timeout: 45000, // Skyscanner can be slow
      ...config
    });
  }

  async searchFlights(params) {
    this._validateFlightParams(params);
    
    try {
      // Step 1: Create session
      const sessionResponse = await this.makeRequest(
        `${this.baseUrl}/pricing/v1.0`,
        {
          method: 'POST',
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            country: 'US',
            currency: 'USD',
            locale: 'en-US',
            originplace: params.origin,
            destinationplace: params.destination,
            outbounddate: params.departure,
            inbounddate: params.return,
            adults: params.passengers || 1,
            cabinclass: params.cabin || 'economy'
          })
        }
      );
      
      // Note: In real implementation, we'd get the session URL from headers
      // For now, simulate polling
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // This is a simplified version - real implementation would poll the session
      logger.info(`Skyscanner search initiated (mock implementation)`);
      return [];
      
    } catch (error) {
      logger.error(`Skyscanner API error: ${error.message}`, { 
        adapter: this.name,
        operation: 'searchFlights' 
      });
      throw error;
    }
  }

  getBookingUrl(result) {
    return result.raw?.bookingLink || `https://www.skyscanner.com/transport/flights/?aid=${this.affiliateId}`;
  }

  _validateFlightParams(params) {
    if (!params.origin) throw new ValidationError('Origin is required');
    if (!params.destination) throw new ValidationError('Destination is required');
    if (!params.departure) throw new ValidationError('Departure date is required');
  }
}

class KayakAdapter extends OTAAdapter {
  constructor(config) {
    super({
      name: 'Kayak',
      commission: 0.08,
      baseUrl: 'https://api.kayak.com/v1',
      ...config
    });
  }

  async searchFlights(params) {
    logger.info(`Kayak flight search not yet implemented`);
    return [];
  }

  async searchHotels(params) {
    logger.info(`Kayak hotel search not yet implemented`);
    return [];
  }

  getBookingUrl(result) {
    if (!result.id) {
      throw new ValidationError('Result ID is required for booking URL');
    }
    return `https://www.kayak.com/book/flight?p=${result.id}&aid=${this.affiliateId}`;
  }
}

class HotelsAdapter extends OTAAdapter {
  constructor(config) {
    super({
      name: 'Hotels.com',
      commission: 0.14,
      baseUrl: 'https://hotels4.p.rapidapi.com',
      ...config
    });
  }

  async searchHotels(params) {
    if (!params.location) {
      throw new ValidationError('Location is required');
    }
    
    try {
      // Get destination ID first
      const destResponse = await this.makeRequest(
        `${this.baseUrl}/locations/v3/search?q=${encodeURIComponent(params.location)}`,
        {
          headers: {
            'X-RapidAPI-Key': this.apiKey,
            'X-RapidAPI-Host': 'hotels4.p.rapidapi.com'
          }
        }
      );
      
      const destId = destResponse.sr?.[0]?.gaiaId;
      
      if (!destId) {
        logger.warn(`No destination found for location: ${params.location}`);
        return [];
      }
      
      // Search hotels
      const searchResponse = await this.makeRequest(
        `${this.baseUrl}/properties/v2/list`,
        {
          method: 'POST',
          headers: {
            'X-RapidAPI-Key': this.apiKey,
            'X-RapidAPI-Host': 'hotels4.p.rapidapi.com',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            destination: { regionId: destId },
            checkInDate: this._parseDate(params.checkIn),
            checkOutDate: this._parseDate(params.checkOut),
            rooms: [{ adults: params.adults, children: [] }]
          })
        }
      );
      
      const properties = searchResponse.data?.propertySearch?.properties;
      
      if (!Array.isArray(properties)) {
        logger.warn(`Unexpected response format from ${this.name}`);
        return [];
      }
      
      return properties.map(hotel => this.standardizeHotel({
        id: hotel.id,
        name: hotel.name,
        price: hotel.price?.lead?.amount,
        currency: hotel.price?.lead?.currency,
        stars: hotel.star,
        rating: hotel.reviews?.score,
        reviewCount: hotel.reviews?.total,
        address: hotel.propertyImage?.description,
        amenities: hotel.amenities?.map(a => a.name),
        images: hotel.propertyImage?.image?.url ? [hotel.propertyImage.image.url] : [],
        ...hotel
      }));
    } catch (error) {
      logger.error(`Hotels.com API error: ${error.message}`, { 
        adapter: this.name,
        operation: 'searchHotels' 
      });
      throw error;
    }
  }

  getBookingUrl(result) {
    if (!result.id) {
      throw new ValidationError('Hotel ID is required for booking URL');
    }
    return `https://www.hotels.com/ho${result.id}/?aid=${this.affiliateId}`;
  }

  _parseDate(dateString) {
    const parts = dateString.split('-');
    return {
      day: parts[2],
      month: parts[1],
      year: parts[0]
    };
  }
}

class AgodaAdapter extends OTAAdapter {
  constructor(config) {
    super({
      name: 'Agoda',
      commission: 0.13,
      baseUrl: 'https://affiliateapi.agoda.com/affiliateservice/v1',
      ...config
    });
  }

  async searchHotels(params) {
    logger.info(`Agoda hotel search not yet implemented`);
    return [];
  }

  getBookingUrl(result) {
    if (!result.id) {
      throw new ValidationError('Hotel ID is required for booking URL');
    }
    return `https://www.agoda.com/hotel/${result.id}?affiliateId=${this.affiliateId}`;
  }
}

class TripAdapter extends OTAAdapter {
  constructor(config) {
    super({
      name: 'Trip.com',
      commission: 0.11,
      baseUrl: 'https://openapi.trip.com/affiliate',
      ...config
    });
  }

  async searchFlights(params) {
    logger.info(`Trip.com flight search not yet implemented`);
    return [];
  }

  async searchHotels(params) {
    logger.info(`Trip.com hotel search not yet implemented`);
    return [];
  }

  getBookingUrl(result) {
    if (!result.id) {
      throw new ValidationError('Result ID is required for booking URL');
    }
    return `https://www.trip.com/booking/redirect?affiliateId=${this.affiliateId}&resultId=${result.id}`;
  }
}

// ============================================================================
// ADAPTER FACTORY
// ============================================================================

class OTAAdapterFactory {
  static createAdapter(type, config) {
    const adapters = {
      booking: BookingAdapter,
      expedia: ExpediaAdapter,
      skyscanner: SkyscannerAdapter,
      kayak: KayakAdapter,
      hotels: HotelsAdapter,
      agoda: AgodaAdapter,
      trip: TripAdapter
    };

    const AdapterClass = adapters[type.toLowerCase()];
    if (!AdapterClass) {
      throw new ValidationError(`Unknown adapter type: ${type}`);
    }

    return new AdapterClass(config);
  }

  static getAvailableAdapters() {
    return [
      { id: 'booking', name: 'Booking.com', supports: ['hotels'] },
      { id: 'expedia', name: 'Expedia', supports: ['flights', 'hotels'] },
      { id: 'skyscanner', name: 'Skyscanner', supports: ['flights'] },
      { id: 'kayak', name: 'Kayak', supports: ['flights', 'hotels'] },
      { id: 'hotels', name: 'Hotels.com', supports: ['hotels'] },
      { id: 'agoda', name: 'Agoda', supports: ['hotels'] },
      { id: 'trip', name: 'Trip.com', supports: ['flights', 'hotels'] }
    ];
  }
}

module.exports = {
  OTAAdapter,
  BookingAdapter,
  ExpediaAdapter,
  SkyscannerAdapter,
  KayakAdapter,
  HotelsAdapter,
  AgodaAdapter,
  TripAdapter,
  OTAAdapterFactory
};
