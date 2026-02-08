/**
 * Personality Mode Routes
 * API endpoints for AI personality modes
 */

const express = require('express');
const personalityModeService = require('../services/personalityModeService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/personality/modes
 * @desc    Get all available personality modes
 * @access  Public
 */
router.get('/modes', (req, res) => {
  try {
    const modes = personalityModeService.getAvailableModes();
    
    res.json({
      success: true,
      data: modes
    });
  } catch (error) {
    console.error('Get personality modes error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/personality/modes/:modeId
 * @desc    Get details for a specific personality mode
 * @access  Public
 */
router.get('/modes/:modeId', (req, res) => {
  try {
    const { modeId } = req.params;
    
    if (!personalityModeService.isValidMode(modeId)) {
      return res.status(404).json({
        success: false,
        error: 'Personality mode not found'
      });
    }
    
    const mode = personalityModeService.getMode(modeId);
    
    res.json({
      success: true,
      data: {
        id: modeId,
        name: mode.name,
        icon: mode.icon,
        description: mode.description
      }
    });
  } catch (error) {
    console.error('Get personality mode error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/personality/chat
 * @desc    Chat with a specific personality mode
 * @access  Private
 */
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, mode, context, history, stream = false } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    const modeId = mode || 'casual';
    
    if (!personalityModeService.isValidMode(modeId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid personality mode'
      });
    }
    
    if (stream) {
      // Set up SSE for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      let fullContent = '';
      
      await personalityModeService.streamResponse(
        message,
        modeId,
        { ...context, userId: req.user.id },
        history || [],
        (chunk, isDone) => {
          if (isDone) {
            res.write(`data: ${JSON.stringify({
              type: 'done',
              content: fullContent,
              mode: modeId,
              modeName: personalityModeService.getMode(modeId).name
            })}\n\n`);
            res.end();
          } else {
            fullContent += chunk;
            res.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: chunk
            })}\n\n`);
          }
        }
      );
    } else {
      // Non-streaming response
      const response = await personalityModeService.generateResponse(
        message,
        modeId,
        { ...context, userId: req.user.id },
        history || []
      );
      
      res.json({
        success: true,
        data: response
      });
    }
  } catch (error) {
    console.error('Personality chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/personality/recommend
 * @desc    Recommend a personality mode based on message
 * @access  Private
 */
router.post('/recommend', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    const recommendation = await personalityModeService.recommendMode(message);
    
    res.json({
      success: true,
      data: {
        ...recommendation,
        modeName: personalityModeService.getMode(recommendation.mode).name,
        modeIcon: personalityModeService.getModeIcon(recommendation.mode)
      }
    });
  } catch (error) {
    console.error('Recommend mode error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/personality/user-preference
 * @desc    Get user's preferred personality mode
 * @access  Private
 */
router.get('/user-preference', authenticate, async (req, res) => {
  try {
    const UserPreference = require('../models/UserPreference');
    const userPrefs = await UserPreference.findOne({ userId: req.user.id });
    
    res.json({
      success: true,
      data: {
        preferredMode: userPrefs?.aiPersonalityMode || 'casual',
        availableModes: personalityModeService.getAvailableModes()
      }
    });
  } catch (error) {
    console.error('Get user preference error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/personality/user-preference
 * @desc    Set user's preferred personality mode
 * @access  Private
 */
router.put('/user-preference', authenticate, async (req, res) => {
  try {
    const { mode } = req.body;
    
    if (!mode || !personalityModeService.isValidMode(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid personality mode'
      });
    }
    
    const UserPreference = require('../models/UserPreference');
    await UserPreference.upsert(req.user.id, {
      aiPersonalityMode: mode
    });
    
    res.json({
      success: true,
      data: {
        preferredMode: mode,
        message: `Personality mode set to ${personalityModeService.getMode(mode).name}`
      }
    });
  } catch (error) {
    console.error('Set user preference error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
