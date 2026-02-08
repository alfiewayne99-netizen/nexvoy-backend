/**
 * Trip Planning Routes
 * API endpoints for advanced trip planning
 */

const express = require('express');
const tripPlanningService = require('../services/tripPlanningService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/trips/plan
 * @desc    Generate a complete AI trip plan
 * @access  Private
 */
router.post('/plan', authenticate, async (req, res) => {
  try {
    const {
      origin,
      destinations,
      startDate,
      duration,
      budget,
      travelers,
      tripType,
      preferences
    } = req.body;
    
    // Validate required fields
    if (!origin || !destinations || !duration || !budget) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: origin, destinations, duration, budget'
      });
    }
    
    const plan = await tripPlanningService.generateTripPlan({
      origin,
      destinations,
      startDate,
      duration,
      budget,
      travelers: travelers || { adults: 1, children: 0, infants: 0 },
      tripType: tripType || 'leisure',
      preferences: preferences || {},
      userId: req.user.id
    });
    
    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Generate trip plan error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/trips/optimize-route
 * @desc    Optimize multi-city route
 * @access  Private
 */
router.post('/optimize-route', authenticate, async (req, res) => {
  try {
    const { destinations, origin, maxDuration, priorities } = req.body;
    
    if (!destinations || !Array.isArray(destinations) || destinations.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 destinations required'
      });
    }
    
    const optimization = await tripPlanningService.optimizeMultiCityRoute(
      destinations,
      { origin, maxDuration, priorities }
    );
    
    res.json({
      success: true,
      data: optimization
    });
  } catch (error) {
    console.error('Optimize route error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/trips/bleisure
 * @desc    Generate bleisure (business + leisure) plan
 * @access  Private
 */
router.post('/bleisure', authenticate, async (req, res) => {
  try {
    const { businessDestination, businessDates, extraDays, interests } = req.body;
    
    if (!businessDestination || !businessDates) {
      return res.status(400).json({
        success: false,
        error: 'businessDestination and businessDates are required'
      });
    }
    
    const bleisurePlan = await tripPlanningService.generateBleisurePlan({
      origin: req.body.origin,
      businessDestination,
      businessDates,
      extraDays: extraDays || 3,
      interests
    });
    
    res.json({
      success: true,
      data: bleisurePlan
    });
  } catch (error) {
    console.error('Generate bleisure plan error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/trips/budget
 * @desc    Generate budget trip plan
 * @access  Private
 */
router.post('/budget', authenticate, async (req, res) => {
  try {
    const { destination, budget, days } = req.body;
    
    if (!destination || !budget || !days) {
      return res.status(400).json({
        success: false,
        error: 'destination, budget, and days are required'
      });
    }
    
    const budgetPlan = await tripPlanningService.generateBudgetTrip(destination, budget, days);
    
    res.json({
      success: true,
      data: budgetPlan
    });
  } catch (error) {
    console.error('Generate budget plan error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/trips/my-plans
 * @desc    Get user's trip plans
 * @access  Private
 */
router.get('/my-plans', authenticate, async (req, res) => {
  try {
    const plans = await tripPlanningService.getUserPlans(req.user.id);
    
    res.json({
      success: true,
      data: plans,
      meta: { count: plans.length }
    });
  } catch (error) {
    console.error('Get user plans error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/trips/public
 * @desc    Get public trip plans
 * @access  Public
 */
router.get('/public', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const plans = await tripPlanningService.getPublicPlans(parseInt(limit));
    
    res.json({
      success: true,
      data: plans,
      meta: { count: plans.length }
    });
  } catch (error) {
    console.error('Get public plans error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/trips/:id
 * @desc    Get specific trip plan
 * @access  Private/Public (if public)
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const TripPlan = require('../models/TripPlan');
    const plan = await TripPlan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Trip plan not found'
      });
    }
    
    // Check access permissions
    if (!plan.isPublic && plan.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Get trip plan error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/trips/:id/fork
 * @desc    Fork a trip plan
 * @access  Private
 */
router.post('/:id/fork', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    
    const forkedPlan = await tripPlanningService.forkPlan(
      req.params.id,
      req.user.id,
      name
    );
    
    res.json({
      success: true,
      data: forkedPlan,
      message: 'Plan forked successfully'
    });
  } catch (error) {
    console.error('Fork plan error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/trips/:id/status
 * @desc    Update trip plan status
 * @access  Private
 */
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['draft', 'active', 'booked', 'completed', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }
    
    const plan = await tripPlanningService.updatePlanStatus(req.params.id, status);
    
    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Update plan status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/trips/destination/:destination
 * @desc    Find plans by destination
 * @access  Public
 */
router.get('/destination/:destination', async (req, res) => {
  try {
    const TripPlan = require('../models/TripPlan');
    const plans = await TripPlan.findByDestination(req.params.destination);
    
    res.json({
      success: true,
      data: plans,
      meta: { count: plans.length }
    });
  } catch (error) {
    console.error('Find by destination error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
