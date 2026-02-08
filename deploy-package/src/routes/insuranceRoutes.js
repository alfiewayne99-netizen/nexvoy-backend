/**
 * Insurance Routes
 * Travel insurance API endpoints for quotes, policies, and commission tracking
 * Partners: Allianz Travel Insurance, World Nomads
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { getLogger } = require('../utils/logger');
const InsuranceService = require('../services/insuranceService');

const logger = getLogger();
const router = express.Router();

// Initialize insurance service
const insuranceService = new InsuranceService();

/**
 * POST /api/insurance/quote
 * Get insurance quote for trip
 */
router.post('/quote', asyncHandler(async (req, res) => {
  const {
    tripCost,
    destination,
    tripDuration,
    travelers,
    tripDetails,
    ageGroups
  } = req.body;

  // Validation
  if (!tripCost || tripCost <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Trip cost is required and must be greater than 0',
      code: 'INVALID_TRIP_COST'
    });
  }

  if (!destination) {
    return res.status(400).json({
      success: false,
      error: 'Destination is required',
      code: 'MISSING_DESTINATION'
    });
  }

  if (!tripDuration || tripDuration <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Trip duration is required',
      code: 'MISSING_DURATION'
    });
  }

  logger.info('Insurance quote requested', {
    tripCost,
    destination,
    tripDuration,
    travelers,
    requestId: req.id
  });

  try {
    const quote = await insuranceService.getQuote({
      tripCost,
      destination,
      tripDuration,
      travelers,
      tripDetails,
      ageGroups,
      userId: req.user?.id
    });

    res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    logger.error('Insurance quote failed', { error: error.message, requestId: req.id });
    
    // Return fallback quote on error
    const fallbackQuote = insuranceService.generateFallbackQuote(tripCost, travelers);
    
    res.json({
      success: true,
      data: fallbackQuote,
      warning: 'Using estimated pricing. Actual rates may vary.'
    });
  }
}));

/**
 * POST /api/insurance/add-to-booking
 * Add insurance to existing booking
 */
router.post('/add-to-booking', asyncHandler(async (req, res) => {
  const {
    bookingId,
    planId,
    planName,
    price,
    coverage,
    tripCost,
    commission,
    travelerDetails
  } = req.body;

  if (!bookingId) {
    return res.status(400).json({
      success: false,
      error: 'Booking ID is required',
      code: 'MISSING_BOOKING_ID'
    });
  }

  if (!planId || !['basic', 'plus', 'premium'].includes(planId)) {
    return res.status(400).json({
      success: false,
      error: 'Valid plan ID is required (basic, plus, or premium)',
      code: 'INVALID_PLAN_ID'
    });
  }

  logger.info('Adding insurance to booking', {
    bookingId,
    planId,
    price,
    requestId: req.id
  });

  const result = await insuranceService.addToBooking({
    bookingId,
    planId,
    planName,
    price,
    coverage,
    tripCost,
    commission,
    travelerDetails,
    userId: req.user?.id
  });

  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/insurance/remove-from-booking
 * Remove insurance from booking
 */
router.post('/remove-from-booking', asyncHandler(async (req, res) => {
  const { bookingId } = req.body;

  if (!bookingId) {
    return res.status(400).json({
      success: false,
      error: 'Booking ID is required',
      code: 'MISSING_BOOKING_ID'
    });
  }

  logger.info('Removing insurance from booking', { bookingId, requestId: req.id });

  const result = await insuranceService.removeFromBooking(bookingId, req.user?.id);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * GET /api/insurance/coverage/:planId
 * Get coverage details for a specific plan
 */
router.get('/coverage/:planId', asyncHandler(async (req, res) => {
  const { planId } = req.params;

  if (!['basic', 'plus', 'premium'].includes(planId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid plan ID',
      code: 'INVALID_PLAN_ID'
    });
  }

  const coverage = insuranceService.getCoverageDetails(planId);

  res.json({
    success: true,
    data: coverage
  });
}));

/**
 * POST /api/insurance/compare
 * Compare multiple insurance plans
 */
router.post('/compare', asyncHandler(async (req, res) => {
  const { planIds, tripCost, tripDuration } = req.body;

  if (!planIds || !Array.isArray(planIds)) {
    return res.status(400).json({
      success: false,
      error: 'Plan IDs array is required',
      code: 'MISSING_PLAN_IDS'
    });
  }

  const comparison = await insuranceService.comparePlans(planIds, {
    tripCost,
    tripDuration
  });

  res.json({
    success: true,
    data: comparison
  });
}));

/**
 * POST /api/insurance/track
 * Track insurance-related events
 */
router.post('/track', asyncHandler(async (req, res) => {
  const { type, ...data } = req.body;

  // Fire and forget tracking
  insuranceService.trackEvent(type, {
    ...data,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Event tracked'
  });
}));

/**
 * GET /api/insurance/policy/:policyId/document
 * Get insurance policy document
 */
router.get('/policy/:policyId/document', asyncHandler(async (req, res) => {
  const { policyId } = req.params;

  try {
    const document = await insuranceService.getPolicyDocument(policyId);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="policy-${policyId}.pdf"`);
    res.send(document);
  } catch (error) {
    logger.error('Policy document retrieval failed', { policyId, error: error.message });
    res.status(404).json({
      success: false,
      error: 'Policy document not found',
      code: 'POLICY_NOT_FOUND'
    });
  }
}));

/**
 * GET /api/insurance/commission-stats
 * Get commission statistics (admin only)
 */
router.get('/commission-stats', asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    groupBy = 'tier',
    partner
  } = req.query;

  // TODO: Add admin authentication middleware
  // if (!req.user?.isAdmin) {
  //   return res.status(403).json({
  //     success: false,
  //     error: 'Admin access required',
  //     code: 'UNAUTHORIZED'
  //   });
  // }

  const stats = await insuranceService.getCommissionStats({
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    groupBy,
    partner
  });

  res.json({
    success: true,
    data: stats
  });
}));

/**
 * POST /api/insurance/validate-eligibility
 * Validate trip eligibility for insurance
 */
router.post('/validate-eligibility', asyncHandler(async (req, res) => {
  const {
    destination,
    tripDuration,
    travelerAges,
    departureDate,
    bookingDate
  } = req.body;

  const eligibility = await insuranceService.validateEligibility({
    destination,
    tripDuration,
    travelerAges,
    departureDate,
    bookingDate
  });

  res.json({
    success: true,
    data: eligibility
  });
}));

/**
 * GET /api/insurance/partners
 * Get insurance partner information
 */
router.get('/partners', asyncHandler(async (req, res) => {
  const partners = [
    {
      id: 'allianz',
      name: 'Allianz Global Assistance',
      logo: '/images/partners/allianz.svg',
      description: 'World leader in travel insurance with 24/7 global assistance',
      coverage: 'Worldwide',
      underwriter: 'BCS Insurance Company',
      rating: 'A+ (Superior)',
      commissionRate: 0.10
    },
    {
      id: 'worldnomads',
      name: 'World Nomads',
      logo: '/images/partners/worldnomads.svg',
      description: 'Specialized in adventure travel insurance for explorers',
      coverage: 'Worldwide with adventure sports',
      underwriter: 'Nationwide Mutual Insurance Company',
      rating: 'A+ (Superior)',
      commissionRate: 0.15
    }
  ];

  res.json({
    success: true,
    data: partners
  });
}));

/**
 * POST /api/insurance/purchase
 * Complete insurance purchase
 */
router.post('/purchase', asyncHandler(async (req, res) => {
  const {
    bookingId,
    planId,
    travelerDetails,
    beneficiaries,
    paymentMethod
  } = req.body;

  if (!bookingId || !planId) {
    return res.status(400).json({
      success: false,
      error: 'Booking ID and plan ID are required',
      code: 'MISSING_REQUIRED_FIELDS'
    });
  }

  logger.info('Processing insurance purchase', {
    bookingId,
    planId,
    userId: req.user?.id,
    requestId: req.id
  });

  const purchase = await insuranceService.processPurchase({
    bookingId,
    planId,
    travelerDetails,
    beneficiaries,
    paymentMethod,
    userId: req.user?.id
  });

  res.json({
    success: true,
    data: purchase
  });
}));

module.exports = router;
