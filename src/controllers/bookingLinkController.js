/**
 * Booking Link Controller
 * Handles affiliate booking link generation and tracking
 */

const { asyncHandler } = require('../middleware/errorHandler');
const {
  ValidationError,
  MissingFieldError,
  InvalidInputError,
  NotFoundError
} = require('../utils/errors');
const { getLogger } = require('../utils/logger');

const logger = getLogger();

/**
 * Create booking link controller with injected service
 */
function createBookingLinkController(bookingService) {
  /**
   * Generate booking links for all affiliates
   * POST /api/booking/links
   */
  const generateLinks = asyncHandler(async (req, res) => {
    const { searchParams } = req.body;
    
    // Validation
    if (!searchParams) {
      throw new MissingFieldError('searchParams');
    }
    
    if (!searchParams.origin) {
      throw new MissingFieldError('searchParams.origin');
    }
    
    if (!searchParams.destination) {
      throw new MissingFieldError('searchParams.destination');
    }
    
    if (!searchParams.depart) {
      throw new MissingFieldError('searchParams.depart');
    }
    
    // Validate airport codes
    if (!/^[A-Z]{3}$/.test(searchParams.origin)) {
      throw new InvalidInputError('searchParams.origin', {
        message: 'Origin must be a 3-letter airport code'
      });
    }
    
    if (!/^[A-Z]{3}$/.test(searchParams.destination)) {
      throw new InvalidInputError('searchParams.destination', {
        message: 'Destination must be a 3-letter airport code'
      });
    }
    
    // Validate date
    const departDate = new Date(searchParams.depart);
    if (isNaN(departDate.getTime())) {
      throw new InvalidInputError('searchParams.depart', {
        message: 'Invalid departure date. Use YYYY-MM-DD format'
      });
    }
    
    const links = bookingService.generateLinks(searchParams);
    
    logger.info(`Generated booking links: ${searchParams.origin} → ${searchParams.destination}`, {
      userId: req.user?.id,
      requestId: req.id
    });
    
    res.json({
      success: true,
      data: {
        links,
        searchParams,
        timestamp: new Date().toISOString()
      }
    });
  });

  /**
   * Get best booking option
   * POST /api/booking/best-option
   */
  const getBestOption = asyncHandler(async (req, res) => {
    const { bookingOptions, strategy, userPrefs } = req.body;
    
    if (!bookingOptions || !Array.isArray(bookingOptions)) {
      throw new ValidationError('bookingOptions must be an array');
    }
    
    if (bookingOptions.length === 0) {
      throw new ValidationError('At least one booking option is required');
    }
    
    const bestOption = bookingService.getBestOption(
      bookingOptions,
      strategy || 'balanced',
      userPrefs || {}
    );
    
    if (!bestOption) {
      throw new NotFoundError('Booking option', 'No valid options found');
    }
    
    res.json({
      success: true,
      data: bestOption
    });
  });

  /**
   * Track link click
   * POST /api/booking/track-click
   */
  const trackClick = asyncHandler(async (req, res) => {
    const { affiliateId, clickId, searchParams } = req.body;
    
    if (!affiliateId) {
      throw new MissingFieldError('affiliateId');
    }
    
    if (!clickId) {
      throw new MissingFieldError('clickId');
    }
    
    const tracking = bookingService.handleClick(affiliateId, clickId, searchParams || {});
    
    res.json({
      success: true,
      data: tracking
    });
  });

  /**
   * Track conversion
   * POST /api/booking/track-conversion
   */
  const trackConversion = asyncHandler(async (req, res) => {
    const { clickId, conversionData } = req.body;
    
    if (!clickId) {
      throw new MissingFieldError('clickId');
    }
    
    const conversion = bookingService.trackConversion(clickId, conversionData || {});
    
    if (!conversion) {
      throw new NotFoundError('Click', clickId);
    }
    
    res.json({
      success: true,
      data: conversion
    });
  });

  /**
   * Get affiliate options with pricing
   * POST /api/booking/options
   */
  const getBookingOptions = asyncHandler(async (req, res) => {
    const { searchParams, priceData } = req.body;
    
    if (!searchParams) {
      throw new MissingFieldError('searchParams');
    }
    
    const options = bookingService.getBookingOptions(
      searchParams,
      priceData || {}
    );
    
    res.json({
      success: true,
      data: options
    });
  });

  /**
   * Get tracking statistics
   * GET /api/booking/stats
   */
  const getStats = asyncHandler(async (req, res) => {
    const stats = bookingService.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  });

  /**
   * Get available affiliates
   * GET /api/booking/affiliates
   */
  const getAffiliates = asyncHandler(async (req, res) => {
    const affiliates = Object.entries(bookingService.affiliateConfig).map(([id, config]) => ({
      id,
      name: config.name,
      logoUrl: config.logoUrl,
      commissionRate: config.commissionRate,
      priority: config.priority,
      supportedParams: config.supportedParams
    }));
    
    res.json({
      success: true,
      data: affiliates
    });
  });

  /**
   * Get routing strategies
   * GET /api/booking/strategies
   */
  const getStrategies = asyncHandler(async (req, res) => {
    const strategies = [
      {
        id: 'balanced',
        name: 'Balanced',
        description: 'Optimal balance of price, quality, and commission'
      },
      {
        id: 'highest_commission',
        name: 'Highest Commission',
        description: 'Prioritize highest commission partners'
      },
      {
        id: 'best_price',
        name: 'Best Price',
        description: 'Always show the lowest price option'
      },
      {
        id: 'user_preference',
        name: 'User Preference',
        description: 'Respect user preferences and history'
      }
    ];
    
    res.json({
      success: true,
      data: strategies
    });
  });

  return {
    generateLinks,
    getBestOption,
    trackClick,
    trackConversion,
    getBookingOptions,
    getStats,
    getAffiliates,
    getStrategies
  };
}

module.exports = { createBookingLinkController };
