/**
 * Proactive Suggestion Routes
 * API endpoints for AI-generated proactive suggestions
 */

const express = require('express');
const proactiveSuggestionService = require('../services/proactiveSuggestionService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/suggestions
 * @desc    Get all suggestions for current user
 * @access  Private
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit = 10, priority } = req.query;
    const userId = req.user.id;
    
    let suggestions;
    if (priority === 'high') {
      suggestions = await proactiveSuggestionService.getHighPrioritySuggestions(userId);
    } else {
      suggestions = await proactiveSuggestionService.getUserSuggestions(userId, parseInt(limit));
    }
    
    res.json({
      success: true,
      data: suggestions,
      meta: {
        count: suggestions.length,
        unread: suggestions.filter(s => s.status === 'unread').length
      }
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/suggestions/high-priority
 * @desc    Get high priority suggestions
 * @access  Private
 */
router.get('/high-priority', authenticate, async (req, res) => {
  try {
    const suggestions = await proactiveSuggestionService.getHighPrioritySuggestions(req.user.id);
    
    res.json({
      success: true,
      data: suggestions,
      meta: { count: suggestions.length }
    });
  } catch (error) {
    console.error('Get high priority suggestions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/suggestions/:id/read
 * @desc    Mark suggestion as read
 * @access  Private
 */
router.post('/:id/read', authenticate, async (req, res) => {
  try {
    const suggestion = await proactiveSuggestionService.markAsRead(req.params.id);
    
    if (!suggestion) {
      return res.status(404).json({
        success: false,
        error: 'Suggestion not found'
      });
    }
    
    res.json({
      success: true,
      data: suggestion
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/suggestions/:id/dismiss
 * @desc    Dismiss suggestion
 * @access  Private
 */
router.post('/:id/dismiss', authenticate, async (req, res) => {
  try {
    const suggestion = await proactiveSuggestionService.dismissSuggestion(req.params.id);
    
    if (!suggestion) {
      return res.status(404).json({
        success: false,
        error: 'Suggestion not found'
      });
    }
    
    res.json({
      success: true,
      data: suggestion
    });
  } catch (error) {
    console.error('Dismiss suggestion error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/suggestions/price-drop
 * @desc    Create price drop suggestion (internal/admin)
 * @access  Private/Admin
 */
router.post('/price-drop', authenticate, async (req, res) => {
  try {
    const { userId, origin, destination, originalPrice, currentPrice, currency } = req.body;
    
    const suggestion = await proactiveSuggestionService.generatePriceDropSuggestion(
      userId,
      { origin, destination, originalPrice, currentPrice, currency }
    );
    
    res.json({
      success: true,
      data: suggestion
    });
  } catch (error) {
    console.error('Create price drop suggestion error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/suggestions/weather-alert
 * @desc    Create weather alert (internal/admin)
 * @access  Private/Admin
 */
router.post('/weather-alert', authenticate, async (req, res) => {
  try {
    const { userId, destination, condition, temperature, alerts, dates } = req.body;
    
    const suggestion = await proactiveSuggestionService.generateWeatherAlert(
      userId,
      { destination, condition, temperature, alerts, dates }
    );
    
    res.json({
      success: true,
      data: suggestion
    });
  } catch (error) {
    console.error('Create weather alert error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/suggestions/passport-warning
 * @desc    Create passport expiry warning (internal/admin)
 * @access  Private/Admin
 */
router.post('/passport-warning', authenticate, async (req, res) => {
  try {
    const { userId, expiryDate, country } = req.body;
    
    const suggestion = await proactiveSuggestionService.generatePassportExpiryWarning(
      userId,
      { expiryDate, country }
    );
    
    res.json({
      success: true,
      data: suggestion
    });
  } catch (error) {
    console.error('Create passport warning error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/suggestions/visa-required
 * @desc    Create visa requirement suggestion
 * @access  Private/Admin
 */
router.post('/visa-required', authenticate, async (req, res) => {
  try {
    const { userId, destination, nationality, requirement, processingTime } = req.body;
    
    const suggestion = await proactiveSuggestionService.generateVisaRequirement(
      userId,
      { destination, nationality, requirement, processingTime }
    );
    
    res.json({
      success: true,
      data: suggestion
    });
  } catch (error) {
    console.error('Create visa requirement error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/suggestions/deal-alert
 * @desc    Create deal alert
 * @access  Private/Admin
 */
router.post('/deal-alert', authenticate, async (req, res) => {
  try {
    const { userId, destination, discount, validUntil, imageUrl, bookingUrl } = req.body;
    
    const suggestion = await proactiveSuggestionService.generateDealAlert(
      userId,
      { destination, discount, validUntil, imageUrl, bookingUrl }
    );
    
    res.json({
      success: true,
      data: suggestion
    });
  } catch (error) {
    console.error('Create deal alert error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/suggestions/seasonal
 * @desc    Generate seasonal suggestion for user
 * @access  Private
 */
router.post('/seasonal', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user preferences
    const UserPreference = require('../models/UserPreference');
    const userPrefs = await UserPreference.findOne({ userId });
    
    const suggestion = await proactiveSuggestionService.generateSeasonalSuggestion(
      userId,
      userPrefs || {}
    );
    
    res.json({
      success: true,
      data: suggestion
    });
  } catch (error) {
    console.error('Generate seasonal suggestion error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
