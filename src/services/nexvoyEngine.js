/**
 * Nexvoy Engine
 * Core AI engine for chat and recommendations
 */

const aiService = require('./aiService');
const { getLogger } = require('../utils/logger');
const logger = getLogger();

class NexvoyEngine {
  constructor(options = {}) {
    this.options = options;
    this.userContexts = new Map();
  }

  /**
   * Process a user message and generate a response
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {string} message - User message
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Response
   */
  async processMessage(userId, sessionId, message, metadata = {}) {
    try {
      // Extract intent and entities
      const [intentResult, entities] = await Promise.all([
        aiService.extractIntent(message),
        aiService.extractEntities(message)
      ]);

      // Get or create user context
      const context = this._getContext(userId, sessionId);
      context.addMessage('user', message);
      context.updateIntent(intentResult.intent);
      context.updateEntities(entities);

      // Generate response
      const response = await aiService.generateResponse(
        message,
        context.toJSON(),
        context.conversationHistory
      );

      context.addMessage('assistant', response.content);

      return {
        message: response.content,
        intent: intentResult.intent,
        entities,
        sessionId,
        metadata: response.metadata || {}
      };
    } catch (error) {
      logger.error('Error processing message:', error);
      return {
        message: 'I apologize, but I\'m having trouble processing your request. Please try again.',
        error: error.message,
        sessionId
      };
    }
  }

  /**
   * Get conversation history
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Array} Conversation history
   */
  getConversationHistory(userId, sessionId) {
    const context = this._getContext(userId, sessionId);
    return context.conversationHistory;
  }

  /**
   * Clear conversation history
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   */
  clearConversation(userId, sessionId) {
    const key = `${userId}:${sessionId}`;
    this.userContexts.delete(key);
  }

  /**
   * Get user context
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Object} User context
   */
  getUserContext(userId, sessionId) {
    const context = this._getContext(userId, sessionId);
    return context.toJSON();
  }

  /**
   * Update user preferences
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {Object} preferences - User preferences
   */
  updateUserPreferences(userId, sessionId, preferences) {
    const context = this._getContext(userId, sessionId);
    context.updatePreferences(preferences);
  }

  /**
   * Get or create conversation context
   * @private
   */
  _getContext(userId, sessionId) {
    const key = `${userId}:${sessionId}`;
    
    if (!this.userContexts.has(key)) {
      this.userContexts.set(key, new ConversationContext({
        userId,
        sessionId,
        createdAt: new Date()
      }));
    }

    return this.userContexts.get(key);
  }
}

/**
 * Conversation Context Class
 */
class ConversationContext {
  constructor({ userId, sessionId, userPreferences = {} }) {
    this.userId = userId;
    this.sessionId = sessionId;
    this.userPreferences = userPreferences;
    this.conversationHistory = [];
    this.currentIntent = null;
    this.extractedEntities = {};
    this.searchResults = [];
    this.createdAt = new Date();
  }

  addMessage(role, content) {
    this.conversationHistory.push({
      role,
      content,
      timestamp: new Date()
    });

    // Keep only last 50 messages
    if (this.conversationHistory.length > 50) {
      this.conversationHistory.shift();
    }
  }

  updateIntent(intent) {
    this.currentIntent = intent;
  }

  updateEntities(entities) {
    this.extractedEntities = { ...this.extractedEntities, ...entities };
  }

  setSearchResults(results) {
    this.searchResults = results;
  }

  updatePreferences(preferences) {
    this.userPreferences = { ...this.userPreferences, ...preferences };
  }

  toJSON() {
    return {
      userId: this.userId,
      sessionId: this.sessionId,
      currentIntent: this.currentIntent,
      extractedEntities: this.extractedEntities,
      userPreferences: this.userPreferences,
      searchResults: this.searchResults,
      messageCount: this.conversationHistory.length,
      createdAt: this.createdAt
    };
  }
}

module.exports = NexvoyEngine;
