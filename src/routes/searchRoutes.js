/**
 * Search Routes
 * Public routes with optional authentication
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { NexvoyPriceEngine } = require('../../../src/index');
const {
  ValidationError,
  MissingFieldError,
  InvalidInputError
} = require('../utils/errors');

// Initialize price engine (will be set by route config)
let priceService = null;

/**
 * Set the price service instance
 */
function setPriceService(service) {
  priceService = service;
}

/**
 * GET /api/search/hotels
 * Search hotels with real results from OTA comparison
 */
router.get('/hotels', asyncHandler(async (req, res) => {
  const { 
    location, 
    checkIn, 
    checkOut, 
    adults = 2, 
    children = 0, 
    rooms = 1,
    minPrice,
    maxPrice,
    stars,
    amenities
  } = req.query;
  
  // Validation
  if (!location) {
    throw new MissingFieldError('location');
  }
  
  if (!checkIn) {
    throw new MissingFieldError('checkIn');
  }
  
  if (!checkOut) {
    throw new MissingFieldError('checkOut');
  }
  
  // Validate dates
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  if (isNaN(checkInDate.getTime())) {
    throw new InvalidInputError('checkIn', {
      message: 'Invalid check-in date format. Use YYYY-MM-DD'
    });
  }
  
  if (isNaN(checkOutDate.getTime())) {
    throw new InvalidInputError('checkOut', {
      message: 'Invalid check-out date format. Use YYYY-MM-DD'
    });
  }
  
  if (checkOutDate <= checkInDate) {
    throw new ValidationError('Check-out date must be after check-in date', {
      checkIn,
      checkOut
    });
  }
  
  // Parse filters
  const filters = {};
  if (minPrice) filters.minPrice = parseFloat(minPrice);
  if (maxPrice) filters.maxPrice = parseFloat(maxPrice);
  if (stars) filters.stars = parseInt(stars, 10);
  if (amenities) filters.amenities = amenities.split(',');
  
  // Use price service if available, otherwise return mock data
  let results;
  if (priceService) {
    results = await priceService.compareHotels(
      location,
      { checkIn, checkOut },
      { adults: parseInt(adults, 10), children: parseInt(children, 10), rooms: parseInt(rooms, 10) },
      { filters, userPreferences: req.user?.preferences }
    );
  } else {
    // Fallback mock data for development
    results = generateMockHotelResults(location, { checkIn, checkOut }, { adults, children, rooms });
  }
  
  res.json({
    success: true,
    data: {
      query: { 
        location, 
        checkIn, 
        checkOut, 
        guests: { adults: parseInt(adults, 10), children: parseInt(children, 10), rooms: parseInt(rooms, 10) },
        filters
      },
      userId: req.user?.userId || null,
      ...results
    }
  });
}));

/**
 * GET /api/search/flights
 * Search flights
 */
router.get('/flights', asyncHandler(async (req, res) => {
  const { 
    origin, 
    destination, 
    departure, 
    return: returnDate, 
    passengers = 1,
    cabin = 'economy'
  } = req.query;
  
  // Validation
  if (!origin) {
    throw new MissingFieldError('origin');
  }
  
  if (!destination) {
    throw new MissingFieldError('destination');
  }
  
  if (!departure) {
    throw new MissingFieldError('departure');
  }
  
  // Use price service if available
  let results;
  if (priceService) {
    results = await priceService.compareFlights(
      origin,
      destination,
      { departure, return: returnDate },
      { passengers: parseInt(passengers, 10), cabin }
    );
  } else {
    // Fallback mock data
    results = { results: [], summary: { totalResults: 0 } };
  }
  
  res.json({
    success: true,
    data: {
      query: { 
        origin, 
        destination, 
        departure, 
        return: returnDate, 
        passengers: parseInt(passengers, 10),
        cabin
      },
      userId: req.user?.userId || null,
      ...results
    }
  });
}));

/**
 * Generate mock hotel results for development/testing
 */
function generateMockHotelResults(location, dates, guests) {
  const nights = Math.ceil((new Date(dates.checkOut) - new Date(dates.checkIn)) / (1000 * 60 * 60 * 24));
  const hotelNames = [
    'Grand Hotel', 'City Center Inn', 'Luxury Suites', 'Budget Stay',
    'Boutique Hotel', 'Riverside Resort', 'Mountain View Lodge', 'Seaside Paradise',
    'Urban Oasis', 'Heritage Hotel', 'Modern Plaza', 'Comfort Inn'
  ];
  
  const amenities = ['wifi', 'pool', 'gym', 'spa', 'restaurant', 'parking', 'breakfast', 'pets'];
  
  const results = Array(12).fill(null).map((_, i) => {
    const basePrice = 80 + Math.random() * 300;
    const stars = Math.floor(Math.random() * 3) + 3; // 3-5 stars
    const priceMultiplier = stars * 0.3;
    const pricePerNight = Math.round(basePrice * priceMultiplier);
    const totalPrice = pricePerNight * nights;
    
    // Random location offset for map (simulate coordinates)
    const lat = 40.7128 + (Math.random() - 0.5) * 0.1;
    const lng = -74.0060 + (Math.random() - 0.5) * 0.1;
    
    return {
      id: `hotel_${Date.now()}_${i}`,
      name: `${hotelNames[i]} ${location}`,
      location: `${location} City Center`,
      address: `${100 + i} Main Street, ${location}`,
      stars,
      rating: (3.5 + Math.random() * 1.5).toFixed(1),
      pricePerNight,
      totalPrice,
      nights,
      amenities: amenities.slice(0, Math.floor(Math.random() * 5) + 2),
      image: `https://placehold.co/400x300/667eea/ffffff?text=${encodeURIComponent(hotelNames[i])}`,
      images: Array(4).fill(null).map((_, j) => 
        `https://placehold.co/400x300/667eea/ffffff?text=Photo+${j + 1}`
      ),
      coordinates: { lat, lng },
      lat,
      lng,
      distance: (Math.random() * 5).toFixed(1),
      source: 'Nexvoy',
      sources: [
        { name: 'Booking.com', price: pricePerNight, url: 'https://booking.com' },
        { name: 'Expedia', price: Math.round(pricePerNight * 1.05), url: 'https://expedia.com' },
        { name: 'Hotels.com', price: Math.round(pricePerNight * 0.98), url: 'https://hotels.com' },
      ].sort((a, b) => a.price - b.price),
      reviews: {
        score: (3.5 + Math.random() * 1.5).toFixed(1),
        count: Math.floor(Math.random() * 2000) + 100,
        summary: ['Excellent', 'Very Good', 'Good', 'Pleasant'][Math.floor(Math.random() * 4)],
      },
      freeCancellation: Math.random() > 0.3,
      breakfastIncluded: Math.random() > 0.5,
      totalScore: Math.random() * 100,
    };
  });
  
  // Sort by ranking score
  results.sort((a, b) => b.totalScore - a.totalScore);
  
  // Detect deals
  const avgPrice = results.reduce((sum, h) => sum + h.pricePerNight, 0) / results.length;
  const deals = results
    .filter(h => h.pricePerNight < avgPrice * 0.85)
    .map(h => ({
      hotelId: h.id,
      hotelName: h.name,
      isDeal: true,
      rating: h.pricePerNight < avgPrice * 0.7 ? 'excellent' : 'good',
      savings: {
        amount: Math.round(avgPrice - h.pricePerNight),
        percentage: Math.round(((avgPrice - h.pricePerNight) / avgPrice) * 100),
      },
      recommendation: h.pricePerNight < avgPrice * 0.7 
        ? '🔥 EXCELLENT DEAL! Book now' 
        : '✅ Good deal - consider booking soon',
    }));
  
  return {
    searchId: `search_${Date.now()}`,
    results,
    deals,
    summary: {
      totalResults: results.length,
      priceRange: {
        lowest: Math.min(...results.map(h => h.pricePerNight)),
        highest: Math.max(...results.map(h => h.pricePerNight)),
        median: results.map(h => h.pricePerNight).sort((a, b) => a - b)[Math.floor(results.length / 2)],
      },
      uniqueSources: ['Booking.com', 'Expedia', 'Hotels.com', 'Agoda'],
    },
    timestamp: new Date().toISOString(),
  };
}

module.exports = { router, setPriceService };
