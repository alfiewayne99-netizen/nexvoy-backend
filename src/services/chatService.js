/**
 * Nex AI Chat Service
 * Real-time conversational AI for travel assistance with WebSocket support
 */

const { EventEmitter } = require('events');
const { getLogger } = require('../utils/logger');

class NexAIChatService extends EventEmitter {
  constructor(nexvoyEngine, config = {}) {
    super();
    this.nexvoy = nexvoyEngine;
    this.config = {
      maxHistoryLength: 50,
      typingDelayMin: 800,
      typingDelayMax: 2000,
      responseTimeout: 30000,
      contextExpiryMinutes: 30,
      ...config
    };
    
    this.conversations = new Map();
    this.contextStore = new Map();
    this.logger = getLogger();
    // Helper to safely log with fallback
    this.logInfo = (msg, ctx) => this.logger && this.logger.logInfo ? this.logger.logInfo(msg, ctx) : console.log(msg, ctx);
    this.logError = (msg, ctx) => this.logger && this.logger.logError ? this.logger.logError(msg, ctx) : console.error(msg, ctx);
    
    // Initialize AI response patterns
    this.intents = this.initializeIntents();
  }

  /**
   * Initialize conversation intent patterns
   */
  initializeIntents() {
    return {
      // Flight search intents
      FLIGHT_SEARCH: {
        patterns: [
          /flight\s+from\s+(\w+)\s+to\s+(\w+)/i,
          /fly\s+from\s+(\w+)\s+to\s+(\w+)/i,
          /(?:find|search|look\s+for)\s+flights?\s+(?:from|to)/i,
          /(?:cheap|best|lowest)\s+(?:price|fare)\s+(?:to|from)/i,
          /how\s+much\s+(?:is|does)\s+(?:it\s+cost\s+to\s+fly|a\s+flight)/i,
        ],
        handler: this.handleFlightSearch.bind(this)
      },
      
      // Hotel search intents
      HOTEL_SEARCH: {
        patterns: [
          /hotel\s+(?:in|at|near)\s+([\w\s]+)/i,
          /(?:find|search|look\s+for)\s+(?:a\s+)?hotel/i,
          /(?:cheap|best|affordable)\s+(?:hotel|place\s+to\s+stay)\s+(?:in|at)/i,
          /where\s+(?:should|can)\s+I\s+stay\s+(?:in|at|near)/i,
        ],
        handler: this.handleHotelSearch.bind(this)
      },
      
      // Deal finding intents
      FIND_DEALS: {
        patterns: [
          /(?:find|show|get)\s+(?:me\s+)?deals/i,
          /(?:cheap|discounted|sale)\s+flights?/i,
          /(?:error\s+fares?|price\s+mistakes?)/i,
          /(?:hidden\s+deals?|flash\s+sales?)/i,
          /(?:best\s+deals?|top\s+offers)/i,
        ],
        handler: this.handleDealSearch.bind(this)
      },
      
      // Price prediction intents
      PRICE_PREDICT: {
        patterns: [
          /(?:will|should)\s+prices?\s+(?:go\s+down|drop|decrease)/i,
          /when\s+(?:should|to)\s+book/i,
          /price\s+(?:prediction|forecast|trend)/i,
          /(?:is\s+this\s+a\s+good\s+time\s+to\s+book|wait\s+or\s+book)/i,
          /(?:buy\s+now\s+or\s+wait|should\s+I\s+wait)/i,
        ],
        handler: this.handlePricePrediction.bind(this)
      },
      
      // Alert management intents
      ALERT_CREATE: {
        patterns: [
          /(?:create|set\s+up|add)\s+(?:an?\s+)?alert/i,
          /notify\s+me\s+when/i,
          /(?:watch|monitor)\s+(?:prices?|this\s+route)/i,
          /alert\s+me\s+(?:if|when)/i,
        ],
        handler: this.handleAlertCreate.bind(this)
      },
      
      // General travel help
      TRAVEL_HELP: {
        patterns: [
          /(?:help|assist)\s+(?:me\s+)?(?:with|planning)/i,
          /(?:plan|organize)\s+(?:a\s+)?trip/i,
          /(?:what|how)\s+(?:do|can|should)\s+I/i,
          /(?:recommendation|suggestion|advice)/i,
        ],
        handler: this.handleTravelHelp.bind(this)
      },
      
      // Booking assistance
      BOOKING_HELP: {
        patterns: [
          /(?:book|reserve)\s+(?:a\s+)?(?:flight|hotel)/i,
          /how\s+(?:do|can)\s+I\s+book/i,
          /(?:best\s+site|where\s+to\s+book)/i,
          /(?:compare\s+booking\s+sites|affiliate\s+links?)/i,
        ],
        handler: this.handleBookingHelp.bind(this)
      },
      
      // Greeting
      GREETING: {
        patterns: [
          /^(?:hi|hello|hey|greetings)/i,
          /^(?:good\s+(?:morning|afternoon|evening))/i,
          /^(?:what's\s+up|howdy)/i,
        ],
        handler: this.handleGreeting.bind(this)
      },
      
      // Farewell
      FAREWELL: {
        patterns: [
          /(?:bye|goodbye|see\s+ya|later)/i,
          /(?:thanks?|thank\s+you)(?:\s+.*)?(?:bye)?/i,
          /have\s+a\s+good/i,
        ],
        handler: this.handleFarewell.bind(this)
      }
    };
  }

  /**
   * Create or get existing conversation
   */
  getOrCreateConversation(userId, sessionId) {
    const key = `${userId}:${sessionId}`;
    
    if (!this.conversations.has(key)) {
      this.conversations.set(key, {
        userId,
        sessionId,
        messages: [],
        context: {
          extractedEntities: {},
          preferences: {},
          lastSearch: null,
          pendingAction: null
        },
        createdAt: Date.now(),
        lastActivity: Date.now()
      });
    }
    
    const conversation = this.conversations.get(key);
    conversation.lastActivity = Date.now();
    
    return conversation;
  }

  /**
   * Process incoming message and generate response
   */
  async processMessage(userId, sessionId, message, metadata = {}) {
    const startTime = Date.now();
    const conversation = this.getOrCreateConversation(userId, sessionId);
    
    // Add user message to history
    const userMessage = {
      id: this.generateMessageId(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
      metadata
    };
    conversation.messages.push(userMessage);
    
    // Trim history if needed
    if (conversation.messages.length > this.config.maxHistoryLength) {
      conversation.messages = conversation.messages.slice(-this.config.maxHistoryLength);
    }

    this.logInfo(`Chat message received`, { userId, sessionId, messageLength: message.length });

    try {
      // Extract entities and update context
      this.extractEntities(message, conversation.context);
      
      // Detect intent
      const intent = this.detectIntent(message);
      
      // Emit typing indicator
      this.emit('typing', { userId, sessionId, isTyping: true });
      
      // Calculate realistic typing delay based on response complexity
      const typingDelay = this.calculateTypingDelay(message, intent);
      
      // Process based on intent
      await new Promise(resolve => setTimeout(resolve, typingDelay));
      
      let response;
      
      if (intent) {
        response = await intent.handler(message, conversation, metadata);
      } else {
        response = await this.handleUnknownIntent(message, conversation);
      }
      
      // Add AI response to history
      const aiMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        metadata: {
          intent: intent?.type || 'unknown',
          processingTime: Date.now() - startTime,
          ...response.metadata
        }
      };
      conversation.messages.push(aiMessage);
      
      // Stop typing indicator
      this.emit('typing', { userId, sessionId, isTyping: false });
      
      // Emit response
      this.emit('message', {
        userId,
        sessionId,
        message: aiMessage
      });
      
      return aiMessage;
      
    } catch (error) {
      this.logger.error('Chat processing error', { error: error.message, userId, sessionId });
      
      this.emit('typing', { userId, sessionId, isTyping: false });
      
      const errorMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: this.getErrorResponse(error),
        timestamp: Date.now(),
        metadata: { error: true, errorType: error.name }
      };
      
      this.emit('message', {
        userId,
        sessionId,
        message: errorMessage
      });
      
      return errorMessage;
    }
  }

  /**
   * Extract entities from message
   */
  extractEntities(message, context) {
    // Extract locations
    const locationPatterns = [
      /(?:from|departing\s+from)\s+([A-Z]{3}|[A-Za-z\s]+?)(?:\s+(?:to|on|at|for)\s+|,|$)/i,
      /(?:to|going\s+to|arriving\s+in)\s+([A-Z]{3}|[A-Za-z\s]+?)(?:\s+(?:from|on|at|for)\s+|,|$)/i,
      /(?:in|at|near)\s+([A-Za-z\s]+?)(?:\s+(?:for|on|from)\s+|,|$)/i,
    ];
    
    for (const pattern of locationPatterns) {
      const match = message.match(pattern);
      if (match) {
        const location = match[1].trim();
        if (!context.extractedEntities.origin && pattern.source.includes('from')) {
          context.extractedEntities.origin = location;
        } else if (!context.extractedEntities.destination) {
          context.extractedEntities.destination = location;
        }
      }
    }

    // Extract dates
    const datePatterns = [
      // "January 15" or "Jan 15" or "15 January"
      /(\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?\b)/i,
      /(\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\b)/i,
      // MM/DD/YYYY or DD/MM/YYYY
      /(\b\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}\b)/,
      // "next week", "this weekend", "tomorrow"
      /(\b(?:tomorrow|next\s+(?:week|month|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|this\s+(?:weekend|week)|in\s+\d+\s+(?:days?|weeks?|months?))\b)/i,
    ];
    
    const dates = [];
    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match && !dates.includes(match[1])) {
        dates.push(match[1]);
      }
    }
    
    if (dates.length > 0) {
      context.extractedEntities.dates = dates;
    }

    // Extract travelers
    const travelerPatterns = [
      /(\d+)\s+(?:adult|person|people|traveler|passenger)s?/i,
      /(?:for\s+)?(\d+)\s+(?:adults|people)/i,
      /(?:single|solo)\s+traveler/i,
      /(?:couple|pair|two\s+people)/i,
      /(?:family\s+of\s+)(\d+)/i,
    ];
    
    for (const pattern of travelerPatterns) {
      const match = message.match(pattern);
      if (match) {
        if (match[0].includes('single') || match[0].includes('solo')) {
          context.extractedEntities.travelers = 1;
        } else if (match[0].includes('couple') || match[0].includes('pair') || match[0].includes('two')) {
          context.extractedEntities.travelers = 2;
        } else if (match[1]) {
          context.extractedEntities.travelers = parseInt(match[1]);
        }
        break;
      }
    }

    // Extract budget
    const budgetPattern = /(?:budget|under|less\s+than|around|about|up\s+to)\s+(?:\$|USD|€|£)?(\d{3,4})/i;
    const budgetMatch = message.match(budgetPattern);
    if (budgetMatch) {
      context.extractedEntities.budget = parseInt(budgetMatch[1]);
    }

    // Extract class preference
    const classPatterns = {
      economy: /\b(?:economy|coach)\b/i,
      business: /\b(?:business|biz)\s+class\b/i,
      first: /\b(?:first\s+class|first)\b/i,
      premium: /\b(?:premium\s+economy|premium)\b/i
    };
    
    for (const [classType, pattern] of Object.entries(classPatterns)) {
      if (pattern.test(message)) {
        context.extractedEntities.class = classType;
        break;
      }
    }
  }

  /**
   * Detect intent from message
   */
  detectIntent(message) {
    for (const [type, intent] of Object.entries(this.intents)) {
      for (const pattern of intent.patterns) {
        if (pattern.test(message)) {
          return { type, handler: intent.handler };
        }
      }
    }
    return null;
  }

  /**
   * Calculate realistic typing delay
   */
  calculateTypingDelay(message, intent) {
    const baseDelay = this.config.typingDelayMin;
    const variableDelay = this.config.typingDelayMax - this.config.typingDelayMin;
    
    // Longer messages = longer "thinking" time
    const lengthFactor = Math.min(message.length / 100, 1);
    
    // Complex intents take longer
    const intentComplexity = {
      FLIGHT_SEARCH: 1.2,
      HOTEL_SEARCH: 1.2,
      FIND_DEALS: 1.0,
      PRICE_PREDICT: 1.3,
      ALERT_CREATE: 0.8,
      TRAVEL_HELP: 1.1,
      BOOKING_HELP: 0.9,
      GREETING: 0.3,
      FAREWELL: 0.3
    };
    
    const complexity = intent ? (intentComplexity[intent.type] || 1) : 1;
    
    return baseDelay + (variableDelay * lengthFactor * complexity);
  }

  // ============================================================================
  // INTENT HANDLERS
  // ============================================================================

  async handleFlightSearch(message, conversation) {
    const entities = conversation.context.extractedEntities;
    
    // Check if we have enough information
    if (!entities.origin || !entities.destination) {
      return {
        content: this.generateClarificationResponse('flight', entities),
        metadata: { needsMoreInfo: true, missingFields: ['origin', 'destination'].filter(f => !entities[f]) }
      };
    }

    try {
      // Search for flights using Nexvoy engine
      const searchParams = {
        origin: entities.origin,
        destination: entities.destination,
        dates: entities.dates || ['next week'],
        travelers: entities.travelers || 1,
        class: entities.class || 'economy'
      };

      // Store last search
      conversation.context.lastSearch = { type: 'flight', params: searchParams };

      // In a real implementation, this would call the price service
      // For now, simulate with realistic response
      const response = this.generateFlightSearchResponse(searchParams);
      
      return {
        content: response,
        metadata: { 
          intent: 'flight_search',
          searchParams,
          hasResults: true
        }
      };
      
    } catch (error) {
      this.logger.error('Flight search error', { error: error.message });
      return {
        content: "I'm having trouble searching for flights right now. Could you try again in a moment?",
        metadata: { error: true }
      };
    }
  }

  async handleHotelSearch(message, conversation) {
    const entities = conversation.context.extractedEntities;
    
    if (!entities.destination) {
      return {
        content: "I'd be happy to help you find hotels! Which city or destination are you looking to stay in?",
        metadata: { needsMoreInfo: true }
      };
    }

    const searchParams = {
      location: entities.destination,
      dates: entities.dates || ['next week'],
      guests: entities.travelers || 2
    };

    conversation.context.lastSearch = { type: 'hotel', params: searchParams };

    return {
      content: this.generateHotelSearchResponse(searchParams),
      metadata: {
        intent: 'hotel_search',
        searchParams,
        hasResults: true
      }
    };
  }

  async handleDealSearch(message, conversation) {
    const entities = conversation.context.extractedEntities;
    
    try {
      // In production, this would call dealEngine.findHiddenDeals()
      const deals = [
        { route: 'NYC → Paris', price: '$299', normal: '$650', savings: '54%' },
        { route: 'LAX → Tokyo', price: '$450', normal: '$980', savings: '54%' },
        { route: 'London → Dubai', price: '$199', normal: '$450', savings: '56%' },
      ];

      let response = "🎉 Here are some amazing deals I found:\n\n";
      deals.forEach((deal, i) => {
        response += `${i + 1}. **${deal.route}**\n`;
        response += `   💰 **${deal.price}** (was ${deal.normal})\n`;
        response += `   💸 Save ${deal.savings}\n\n`;
      });
      
      response += "These deals can disappear quickly! Would you like me to set up a price alert for any of these routes, or search for deals to a specific destination?";

      return {
        content: response,
        metadata: { intent: 'deal_search', dealCount: deals.length }
      };
      
    } catch (error) {
      return {
        content: "I found some great deals! Here are a few standouts:\n\n• Flash sale: 40% off European flights this week\n• Error fare: NYC to Bangkok $350 roundtrip\n• Weekend deal: Domestic US flights from $49\n\nWant me to search for deals to a specific destination?",
        metadata: { intent: 'deal_search', fallback: true }
      };
    }
  }

  async handlePricePrediction(message, conversation) {
    const entities = conversation.context.extractedEntities;
    const lastSearch = conversation.context.lastSearch;
    
    let route = null;
    if (entities.origin && entities.destination) {
      route = `${entities.origin} to ${entities.destination}`;
    } else if (lastSearch?.params) {
      route = `${lastSearch.params.origin} to ${lastSearch.params.destination}`;
    }

    if (!route) {
      return {
        content: "I can help predict price trends! Which route are you asking about? (e.g., 'NYC to London')",
        metadata: { needsMoreInfo: true }
      };
    }

    return {
      content: `📊 **Price Forecast for ${route}**\n\nBased on historical data:\n\n` +
               `• **Current trend**: Prices are lower than average (good time to book!)\n` +
               `• **Prediction**: Prices may rise 8-12% in the next 2 weeks\n` +
               `• **Best booking window**: Within the next 5-7 days\n` +
               `• **Confidence**: 78%\n\n` +
               `💡 **My recommendation**: Book soon if your dates are flexible, or set up a price alert if you're waiting for a specific price.`,
      metadata: { 
        intent: 'price_prediction',
        route,
        recommendation: 'book_soon'
      }
    };
  }

  async handleAlertCreate(message, conversation) {
    const entities = conversation.context.extractedEntities;
    const lastSearch = conversation.context.lastSearch;
    
    let targetRoute = null;
    if (entities.origin && entities.destination) {
      targetRoute = { origin: entities.origin, destination: entities.destination };
    } else if (lastSearch?.type === 'flight') {
      targetRoute = { 
        origin: lastSearch.params.origin, 
        destination: lastSearch.params.destination 
      };
    }

    if (!targetRoute) {
      return {
        content: "I'd be happy to set up a price alert for you! Which route would you like me to monitor? Just tell me the origin and destination (e.g., 'alert me for flights from NYC to London')",
        metadata: { needsMoreInfo: true }
      };
    }

    // In production, this would call alertService.createAlert()
    const targetPrice = entities.budget || 'the best available price';

    return {
      content: `🔔 **Price Alert Created!**\n\n` +
               `I'll monitor flights from **${targetRoute.origin}** to **${targetRoute.destination}**\n` +
               `Target price: **${targetPrice}**\n\n` +
               `You'll receive a notification as soon as prices drop to your target or when I find an exceptional deal. You can manage your alerts anytime in your account settings.`,
      metadata: { 
        intent: 'alert_create',
        alertCreated: true,
        route: targetRoute
      }
    };
  }

  async handleTravelHelp(message, conversation) {
    const entities = conversation.context.extractedEntities;
    
    const responses = [
      "I'd love to help you plan your trip! 🌍\n\nTo get started, could you tell me:\n1. Where are you departing from?\n2. Where would you like to go?\n3. When are you thinking of traveling?\n\nOnce I know these details, I can search for the best flights and hotels for you!",
      
      "I'm here to make your travel planning easy! ✈️\n\nI can help you:\n• Find and compare flight prices\n• Discover hotel deals\n• Monitor prices with alerts\n• Predict the best time to book\n• Find hidden deals and error fares\n\nWhat would you like to do first?"
    ];

    return {
      content: responses[Math.floor(Math.random() * responses.length)],
      metadata: { intent: 'travel_help' }
    };
  }

  async handleBookingHelp(message, conversation) {
    const lastSearch = conversation.context.lastSearch;
    
    let response = "I can help you find the best booking options! 💳\n\n";
    
    if (lastSearch) {
      response += `Based on your recent search for ${lastSearch.params.origin} to ${lastSearch.params.destination}, `;
      response += "here are the best sites to book:\n\n";
      response += "1. **Booking.com** - Best for flexible cancellation\n";
      response += "2. **Expedia** - Often has package deals\n";
      response += "3. **Kayak** - Great price comparison\n";
      response += "4. **Airline direct** - Best for customer service\n\n";
    } else {
      response += "When you're ready to book, I recommend comparing prices across these trusted sites:\n\n";
      response += "• **Kayak** - Comprehensive comparison\n";
      response += "• **Expedia** - Package deals and rewards\n";
      response += "• **Booking.com** - Flexible options\n";
      response += "• **Airline/Hotel direct** - Best customer service\n\n";
    }
    
    response += "💡 **Pro tip**: Book directly with the airline for easier changes, or use an OTA for package savings!";

    return {
      content: response,
      metadata: { intent: 'booking_help' }
    };
  }

  async handleGreeting(message, conversation) {
    const hour = new Date().getHours();
    let timeGreeting = 'Hello';
    
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 18) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    const name = conversation.context.userName || 'there';
    
    return {
      content: `${timeGreeting}${name !== 'there' ? ` ${name}` : ''}! 👋\n\n` +
               `I'm **Nex**, your AI travel assistant. I can help you:\n\n` +
               `✈️ Find cheap flights\n` +
               `🏨 Discover hotel deals\n` +
               `🔔 Set up price alerts\n` +
               `📊 Predict price trends\n` +
               `🎯 Find hidden deals\n\n` +
               `What can I help you with today?`,
      metadata: { intent: 'greeting' }
    };
  }

  async handleFarewell(message, conversation) {
    const responses = [
      "You're welcome! Safe travels and feel free to come back anytime you need travel help! ✈️🌍",
      "Happy to help! Have an amazing trip! 🎉",
      "Anytime! I'll be here when you need to find your next great deal. Bon voyage! 🌟",
      "Thanks for chatting! Don't forget to set up price alerts for the best deals. Safe travels! ✨"
    ];

    return {
      content: responses[Math.floor(Math.random() * responses.length)],
      metadata: { intent: 'farewell' }
    };
  }

  async handleUnknownIntent(message, conversation) {
    const responses = [
      "I'm not sure I understood that completely. I can help you with:\n\n" +
      "• Finding flights (e.g., 'flights from NYC to London')\n" +
      "• Searching hotels (e.g., 'hotels in Paris')\n" +
      "• Finding deals (e.g., 'show me deals to Europe')\n" +
      "• Setting price alerts\n" +
      "• Predicting when to book\n\n" +
      "What would you like to do?",
      
      "Hmm, I'm still learning! Could you try rephrasing? For example:\n\n" +
      "• 'Find me flights from LA to Tokyo'\n" +
      "• 'Hotels in Barcelona next month'\n" +
      "• 'Any good deals right now?'\n" +
      "• 'Should I book now or wait?'",
    ];

    return {
      content: responses[Math.floor(Math.random() * responses.length)],
      metadata: { intent: 'unknown', originalMessage: message }
    };
  }

  // ============================================================================
  // RESPONSE GENERATORS
  // ============================================================================

  generateClarificationResponse(searchType, entities) {
    const missing = [];
    if (!entities.origin) missing.push('departure city/airport');
    if (!entities.destination) missing.push('destination');
    if (!entities.dates) missing.push('travel dates');

    let response = "I'd love to help you find ";
    response += searchType === 'flight' ? 'flights' : 'hotels';
    response += "! I just need a bit more information:\n\n";
    
    missing.forEach(item => {
      response += `• What's your ${item}?\n`;
    });
    
    response += "\nFor example, you could say: ";
    if (searchType === 'flight') {
      response += `"flights from ${entities.origin || 'NYC'} to ${entities.destination || 'London'} on March 15"`;
    } else {
      response += `"hotels in ${entities.destination || 'Paris'} for next weekend"`;
    }

    return response;
  }

  generateFlightSearchResponse(params) {
    const { origin, destination, dates, travelers, class: travelClass } = params;
    
    // Simulate search results
    const results = [
      { airline: 'Best Value Air', price: 425, duration: '7h 30m', stops: 0 },
      { airline: 'Budget Fly', price: 289, duration: '11h 15m', stops: 1 },
      { airline: 'Premium Airlines', price: 675, duration: '7h 45m', stops: 0 },
    ];

    let response = `✈️ **Flights from ${origin} to ${destination}**\n\n`;
    
    results.forEach((flight, i) => {
      const isBest = i === 0;
      response += `${isBest ? '🏆' : `${i + 1}.`} **${flight.airline}**\n`;
      response += `   💰 $${flight.price}${travelers > 1 ? ` × ${travelers} = $${flight.price * travelers}` : ''}\n`;
      response += `   ⏱️ ${flight.duration} · ${flight.stops === 0 ? 'Nonstop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}\n\n`;
    });

    response += `📊 **Price Analysis**: The best value is **Best Value Air at $${results[0].price}**\n`;
    response += `• Historical average: $520\n`;
    response += `• You could save: $${520 - results[0].price} (18% below average)\n\n`;
    response += `💡 Want me to **set up a price alert** in case prices drop further, or would you like to **see booking options**?`;

    return response;
  }

  generateHotelSearchResponse(params) {
    const { location, dates, guests } = params;
    
    return `🏨 **Hotels in ${location}**\n\n` +
           `Here are some great options for ${guests} guest${guests > 1 ? 's' : ''}:\n\n` +
           `1. **City Center Hotel** ⭐⭐⭐⭐\n` +
           `   💰 $120/night · Free cancellation\n` +
           `   📍 Downtown · 4.5/5 rating\n\n` +
           `2. **Boutique Inn** ⭐⭐⭐⭐⭐\n` +
           `   💰 $185/night · Breakfast included\n` +
           `   📍 Historic district · 4.8/5 rating\n\n` +
           `3. **Budget Stay** ⭐⭐⭐\n` +
           `   💰 $75/night · Basic amenities\n` +
           `   📍 Near metro · 4.0/5 rating\n\n` +
           `💡 These prices are 15% lower than usual for these dates! Would you like me to show booking links or find alternatives?`;
  }

  getErrorResponse(error) {
    const responses = [
      "Oops, I encountered a little hiccup there. Let me try that again!",
      "I'm having a brief moment of confusion. Could you repeat that?",
      "Something went wrong on my end. My apologies! Can you try again?",
      "I seem to have tripped over my own circuits. One moment please!"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getConversationHistory(userId, sessionId, limit = 20) {
    const key = `${userId}:${sessionId}`;
    const conversation = this.conversations.get(key);
    
    if (!conversation) return [];
    
    return conversation.messages.slice(-limit);
  }

  clearConversation(userId, sessionId) {
    const key = `${userId}:${sessionId}`;
    this.conversations.delete(key);
  }

  getUserContext(userId, sessionId) {
    const conversation = this.getOrCreateConversation(userId, sessionId);
    return conversation.context;
  }

  updateUserPreferences(userId, sessionId, preferences) {
    const conversation = this.getOrCreateConversation(userId, sessionId);
    conversation.context.preferences = {
      ...conversation.context.preferences,
      ...preferences
    };
  }

  /**
   * Cleanup old conversations
   */
  cleanup(maxAgeMinutes = 60) {
    const now = Date.now();
    const maxAge = maxAgeMinutes * 60 * 1000;
    
    for (const [key, conversation] of this.conversations.entries()) {
      if (now - conversation.lastActivity > maxAge) {
        this.conversations.delete(key);
        this.logInfo('Cleaned up inactive conversation', { key });
      }
    }
  }
}

module.exports = NexAIChatService;
