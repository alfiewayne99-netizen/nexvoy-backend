/**
 * AI Controller - Handles AI-related API endpoints
 * Provides streaming chat, intent extraction, and smart suggestions
 */

const aiService = require('../services/aiService');
const openaiService = require('../services/openaiService');
const ConversationContext = require('../models/ConversationContext');
const UserPreference = require('../models/UserPreference');
const Destination = require('../models/Destination');

// In-memory conversation contexts (use Redis in production)
const conversationContexts = new Map();

/**
 * Get or create conversation context
 * @param {string} sessionId 
 * @param {string} userId 
 * @returns {ConversationContext}
 */
async function getConversationContext(sessionId, userId) {
  const key = `${userId}:${sessionId}`;
  
  if (!conversationContexts.has(key)) {
    // Load from database or create new
    const userPrefs = await UserPreference.findOne({ userId });
    conversationContexts.set(key, new ConversationContext({
      userId,
      sessionId,
      userPreferences: userPrefs?.toObject() || {}
    }));
  }
  
  return conversationContexts.get(key);
}

/**
 * POST /api/ai/chat
 * Main streaming chat endpoint
 */
async function chat(req, res) {
  try {
    const { message, sessionId, userId, stream = true } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Get conversation context
    const context = await getConversationContext(sessionId, userId);
    
    // Extract intent and entities
    const [intentResult, entities] = await Promise.all([
      aiService.extractIntent(message),
      aiService.extractEntities(message)
    ]);

    // Update context
    context.addMessage('user', message);
    context.updateIntent(intentResult.intent);
    context.updateEntities(entities);

    // Check if this is a destination query
    if (intentResult.intent === 'get_destination_info' && entities.destination) {
      const destination = await Destination.findOne({
        name: { $regex: new RegExp(entities.destination, 'i') }
      });
      if (destination) {
        context.setSearchResults([destination]);
      }
    }

    if (stream) {
      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullResponse = '';

      try {
        await aiService.streamResponse(
          message,
          context.toJSON(),
          context.conversationHistory,
          (chunk, isDone) => {
            if (isDone) {
              // Save AI response to context
              context.addMessage('assistant', fullResponse);
              
              res.write(`data: ${JSON.stringify({
                type: 'done',
                content: fullResponse,
                context: {
                  intent: context.currentIntent,
                  entities: context.extractedEntities
                }
              })}\n\n`);
              res.end();
            } else {
              fullResponse += chunk;
              res.write(`data: ${JSON.stringify({
                type: 'chunk',
                content: chunk
              })}\n\n`);
            }
          }
        );
      } catch (error) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: error.message
        })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response
      const response = await aiService.generateResponse(
        message,
        context.toJSON(),
        context.conversationHistory
      );

      context.addMessage('assistant', response.content);

      res.json({
        success: true,
        data: {
          message: {
            id: `msg_${Date.now()}_ai`,
            role: 'assistant',
            content: response.content,
            timestamp: Date.now(),
            metadata: response.metadata
          },
          context: {
            intent: context.currentIntent,
            entities: context.extractedEntities
          }
        }
      });
    }
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process chat message'
    });
  }
}

/**
 * POST /api/ai/intent
 * Extract intent from user message
 */
async function extractIntent(req, res) {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const result = await aiService.extractIntent(message);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Intent Extraction Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/ai/entities
 * Extract entities from user message
 */
async function extractEntities(req, res) {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const entities = await aiService.extractEntities(message);
    
    res.json({
      success: true,
      data: entities
    });
  } catch (error) {
    console.error('Entity Extraction Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/ai/suggest
 * Generate smart suggestions based on context
 */
async function suggest(req, res) {
  try {
    const { sessionId, userId } = req.body;
    
    const context = await getConversationContext(sessionId, userId);
    const suggestions = await aiService.generateSuggestions(context.toJSON());
    
    res.json({
      success: true,
      data: {
        suggestions,
        context: {
          intent: context.currentIntent,
          entities: context.extractedEntities
        }
      }
    });
  } catch (error) {
    console.error('Suggestions Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/ai/search
 * Trigger search based on conversation
 */
async function triggerSearch(req, res) {
  try {
    const { sessionId, userId, searchType } = req.body;
    
    const context = await getConversationContext(sessionId, userId);
    const params = aiService.generateBookingParams(
      context.currentIntent,
      context.extractedEntities
    );

    // Here you would integrate with your flight/hotel/car search APIs
    // For now, return the parameters that would be used
    
    res.json({
      success: true,
      data: {
        searchParams: params,
        ready: !!(params.origin && params.destination),
        missingFields: !params.origin ? ['origin'] : 
                       !params.destination ? ['destination'] :
                       !params.dates ? ['dates'] : []
      }
    });
  } catch (error) {
    console.error('Search Trigger Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/ai/booking-params
 * Generate booking parameters from context
 */
async function getBookingParams(req, res) {
  try {
    const { sessionId, userId } = req.body;
    
    const context = await getConversationContext(sessionId, userId);
    const params = aiService.generateBookingParams(
      context.currentIntent,
      context.extractedEntities
    );
    
    res.json({
      success: true,
      data: {
        params,
        context: {
          intent: context.currentIntent,
          entities: context.extractedEntities
        }
      }
    });
  } catch (error) {
    console.error('Booking Params Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/ai/context/:sessionId
 * Get current conversation context
 */
async function getContext(req, res) {
  try {
    const { sessionId } = req.params;
    const { userId } = req.query;
    
    const context = await getConversationContext(sessionId, userId);
    
    res.json({
      success: true,
      data: context.toJSON()
    });
  } catch (error) {
    console.error('Get Context Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * DELETE /api/ai/context/:sessionId
 * Clear conversation context
 */
async function clearContext(req, res) {
  try {
    const { sessionId } = req.params;
    const { userId } = req.body;
    
    const key = `${userId}:${sessionId}`;
    conversationContexts.delete(key);
    
    res.json({
      success: true,
      message: 'Context cleared successfully'
    });
  } catch (error) {
    console.error('Clear Context Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/ai/sentiment
 * Analyze sentiment of message
 */
async function analyzeSentiment(req, res) {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const result = await openaiService.analyzeSentiment(message);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Sentiment Analysis Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/ai/destination-info
 * Get AI-generated destination information
 */
async function getDestinationInfo(req, res) {
  try {
    const { destination } = req.body;
    
    if (!destination) {
      return res.status(400).json({
        success: false,
        error: 'Destination is required'
      });
    }

    // First check database
    let destData = await Destination.findOne({
      name: { $regex: new RegExp(destination, 'i') }
    });

    // If not in database or needs refresh, generate with AI
    if (!destData) {
      const generated = await openaiService.generateDestinationDescription(destination);
      if (generated) {
        // Save to database
        destData = new Destination({
          name: destination,
          ...generated,
          generatedByAI: true
        });
        await destData.save();
      }
    }
    
    res.json({
      success: true,
      data: destData
    });
  } catch (error) {
    console.error('Destination Info Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/ai/token-usage
 * Get token usage statistics
 */
async function getTokenUsage(req, res) {
  try {
    const usage = aiService.getTokenUsage();
    
    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('Token Usage Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  chat,
  extractIntent,
  extractEntities,
  suggest,
  triggerSearch,
  getBookingParams,
  getContext,
  clearContext,
  analyzeSentiment,
  getDestinationInfo,
  getTokenUsage
};
