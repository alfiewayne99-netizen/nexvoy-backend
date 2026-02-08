/**
 * Conversation Context Model
 * Manages conversation state and extracted information
 */

class ConversationContext {
  constructor({
    userId,
    sessionId,
    userPreferences = {}
  } = {}) {
    this.userId = userId;
    this.sessionId = sessionId;
    this.currentIntent = null;
    this.extractedEntities = {
      origin: null,
      destination: null,
      dates: null,
      travelers: null,
      budget: null,
      preferences: []
    };
    this.searchResults = [];
    this.selectedItem = null;
    this.bookingProgress = null;
    this.conversationHistory = [];
    this.userPreferences = userPreferences;
    this.createdAt = Date.now();
    this.lastUpdated = Date.now();
  }

  /**
   * Add a message to conversation history
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content 
   */
  addMessage(role, content) {
    this.conversationHistory.push({
      role,
      content,
      timestamp: Date.now()
    });

    // Keep only last 10 messages
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }

    this.lastUpdated = Date.now();
  }

  /**
   * Update current intent
   * @param {string} intent 
   */
  updateIntent(intent) {
    this.currentIntent = intent;
    this.lastUpdated = Date.now();
  }

  /**
   * Update extracted entities
   * @param {Object} entities 
   */
  updateEntities(entities) {
    if (entities.origin) this.extractedEntities.origin = entities.origin;
    if (entities.destination) this.extractedEntities.destination = entities.destination;
    if (entities.dates) this.extractedEntities.dates = entities.dates;
    if (entities.travelers) this.extractedEntities.travelers = entities.travelers;
    if (entities.budget) this.extractedEntities.budget = entities.budget;
    if (entities.preferences?.length) {
      this.extractedEntities.preferences = [
        ...new Set([...this.extractedEntities.preferences, ...entities.preferences])
      ];
    }
    if (entities.tripType) this.extractedEntities.tripType = entities.tripType;
    
    this.lastUpdated = Date.now();
  }

  /**
   * Set search results
   * @param {Array} results 
   */
  setSearchResults(results) {
    this.searchResults = results;
    this.lastUpdated = Date.now();
  }

  /**
   * Set currently selected item
   * @param {Object} item 
   */
  setSelectedItem(item) {
    this.selectedItem = item;
    this.lastUpdated = Date.now();
  }

  /**
   * Update booking progress
   * @param {Object} progress 
   */
  updateBookingProgress(progress) {
    this.bookingProgress = progress;
    this.lastUpdated = Date.now();
  }

  /**
   * Clear booking progress
   */
  clearBookingProgress() {
    this.bookingProgress = null;
    this.lastUpdated = Date.now();
  }

  /**
   * Check if we have enough information to search
   * @returns {Object}
   */
  getSearchReadiness() {
    const required = {
      origin: !!this.extractedEntities.origin,
      destination: !!this.extractedEntities.destination,
      dates: !!this.extractedEntities.dates
    };

    return {
      ready: required.origin && required.destination,
      required,
      missing: Object.entries(required)
        .filter(([_, has]) => !has)
        .map(([field]) => field)
    };
  }

  /**
   * Get missing information to ask user
   * @returns {Array}
   */
  getMissingInfo() {
    const missing = [];
    
    if (!this.extractedEntities.origin) {
      missing.push({
        field: 'origin',
        question: 'Where would you like to depart from?',
        examples: ['New York', 'LAX', 'London Heathrow']
      });
    }
    
    if (!this.extractedEntities.destination) {
      missing.push({
        field: 'destination',
        question: 'Where are you traveling to?',
        examples: ['Paris', 'Tokyo', 'Miami']
      });
    }
    
    if (!this.extractedEntities.dates) {
      missing.push({
        field: 'dates',
        question: 'When are you planning to travel?',
        examples: ['Next week', 'December 15-22', 'Anytime in March']
      });
    }
    
    if (!this.extractedEntities.travelers) {
      missing.push({
        field: 'travelers',
        question: 'How many travelers?',
        examples: ['Just me', '2 adults', 'Family of 4']
      });
    }

    return missing;
  }

  /**
   * Clear all search-related data
   */
  clearSearch() {
    this.currentIntent = null;
    this.extractedEntities = {
      origin: null,
      destination: null,
      dates: null,
      travelers: null,
      budget: null,
      preferences: []
    };
    this.searchResults = [];
    this.selectedItem = null;
    this.lastUpdated = Date.now();
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    this.lastUpdated = Date.now();
  }

  /**
   * Export to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      userId: this.userId,
      sessionId: this.sessionId,
      currentIntent: this.currentIntent,
      extractedEntities: this.extractedEntities,
      searchResults: this.searchResults,
      selectedItem: this.selectedItem,
      bookingProgress: this.bookingProgress,
      conversationHistory: this.conversationHistory,
      userPreferences: this.userPreferences,
      createdAt: this.createdAt,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Import from JSON
   * @param {Object} data 
   * @returns {ConversationContext}
   */
  static fromJSON(data) {
    const context = new ConversationContext({
      userId: data.userId,
      sessionId: data.sessionId,
      userPreferences: data.userPreferences
    });
    
    context.currentIntent = data.currentIntent;
    context.extractedEntities = data.extractedEntities;
    context.searchResults = data.searchResults || [];
    context.selectedItem = data.selectedItem;
    context.bookingProgress = data.bookingProgress;
    context.conversationHistory = data.conversationHistory || [];
    context.createdAt = data.createdAt;
    context.lastUpdated = data.lastUpdated;
    
    return context;
  }
}

module.exports = ConversationContext;
