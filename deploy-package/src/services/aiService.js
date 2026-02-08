const { OpenAI } = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');

// Initialize clients based on available API keys
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000
}) : null;

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3
}) : null;

// Default LLM provider
const DEFAULT_PROVIDER = process.env.DEFAULT_LLM_PROVIDER || 'openai';
const DEFAULT_MODEL = process.env.DEFAULT_LLM_MODEL || 'gpt-4o';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map();

// Token usage tracking
const tokenUsage = {
  total: 0,
  today: 0,
  requests: 0,
  lastReset: Date.now()
};

/**
 * Check rate limit for a user
 * @param {string} userId - User identifier
 * @returns {Object} Rate limit status
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 30; // 30 requests per minute
  
  if (!rateLimitStore.has(userId)) {
    rateLimitStore.set(userId, { count: 0, resetTime: now + windowMs });
  }
  
  const userLimit = rateLimitStore.get(userId);
  
  if (now > userLimit.resetTime) {
    userLimit.count = 0;
    userLimit.resetTime = now + windowMs;
  }
  
  const allowed = userLimit.count < maxRequests;
  
  if (allowed) {
    userLimit.count++;
  }
  
  return {
    allowed,
    remaining: Math.max(0, maxRequests - userLimit.count),
    resetTime: userLimit.resetTime,
    limit: maxRequests
  };
}

/**
 * Track token usage
 * @param {number} promptTokens 
 * @param {number} completionTokens 
 */
function trackTokenUsage(promptTokens, completionTokens) {
  const total = promptTokens + completionTokens;
  tokenUsage.total += total;
  tokenUsage.today += total;
  tokenUsage.requests++;
  
  // Reset daily counter
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (now - tokenUsage.lastReset > dayMs) {
    tokenUsage.today = total;
    tokenUsage.lastReset = now;
  }
}

/**
 * Get token usage statistics
 */
function getTokenUsage() {
  return {
    ...tokenUsage,
    estimatedCost: calculateCost(tokenUsage.today)
  };
}

/**
 * Calculate estimated cost based on token usage
 * @param {number} tokens 
 * @returns {string} Cost in USD
 */
function calculateCost(tokens) {
  // GPT-4o pricing: $5 per 1M input tokens, $15 per 1M output tokens
  // Average assumption: 70% input, 30% output
  const inputTokens = tokens * 0.7;
  const outputTokens = tokens * 0.3;
  const cost = (inputTokens / 1000000 * 5) + (outputTokens / 1000000 * 15);
  return `$${cost.toFixed(4)}`;
}

/**
 * Generate system prompt with context
 * @param {Object} context - Conversation context
 * @returns {string} System prompt
 */
function generateSystemPrompt(context = {}) {
  const {
    userPreferences = {},
    currentIntent = null,
    extractedEntities = {},
    searchResults = [],
    selectedItem = null,
    bookingProgress = null
  } = context;

  return `You are Nex, an AI travel assistant for Nexvoy. You help users find and book flights, hotels, and car rentals with a warm, professional personality.

YOUR CAPABILITIES:
- Search for flights, hotels, and car rentals
- Compare prices and options intelligently
- Answer travel questions with accurate, up-to-date information
- Guide users through the booking process step-by-step
- Provide destination information and recommendations
- Suggest alternatives when options are limited
- Help with travel planning and itinerary suggestions

YOUR PERSONALITY:
- Friendly, enthusiastic, and genuinely helpful
- Professional but conversational - like a knowledgeable travel agent friend
- Use emojis occasionally to be engaging ✈️ 🏨 🚗
- Ask clarifying questions when needed - don't guess important details
- Be honest about limitations - never make up flight/hotel data

CURRENT CONTEXT:
${currentIntent ? `Current Intent: ${currentIntent}` : 'No active search'}
${extractedEntities.origin ? `From: ${extractedEntities.origin}` : ''}
${extractedEntities.destination ? `To: ${extractedEntities.destination}` : ''}
${extractedEntities.dates ? `Dates: ${extractedEntities.dates}` : ''}
${extractedEntities.travelers ? `Travelers: ${extractedEntities.travelers}` : ''}
${extractedEntities.budget ? `Budget: ${extractedEntities.budget}` : ''}
${searchResults.length > 0 ? `Search Results: ${searchResults.length} items available` : ''}
${selectedItem ? `Currently discussing: ${selectedItem.name || selectedItem.title}` : ''}
${bookingProgress ? `Booking Progress: ${bookingProgress.step}/${bookingProgress.totalSteps} - ${bookingProgress.currentStep}` : ''}

USER PREFERENCES:
${userPreferences.preferredAirlines?.length ? `Preferred Airlines: ${userPreferences.preferredAirlines.join(', ')}` : ''}
${userPreferences.seatPreference ? `Seat Preference: ${userPreferences.seatPreference}` : ''}
${userPreferences.hotelChains?.length ? `Preferred Hotel Chains: ${userPreferences.hotelChains.join(', ')}` : ''}
${userPreferences.travelStyle ? `Travel Style: ${userPreferences.travelStyle}` : ''}
${userPreferences.maxLayover ? `Max Layover: ${userPreferences.maxLayover}h` : ''}

INSTRUCTIONS:
1. ALWAYS acknowledge what the user is looking for before providing information
2. If you need more details to help, ask specific questions (dates, locations, budget)
3. When presenting options, be concise but informative
4. If suggesting searches, format them clearly with relevant parameters
5. For booking-related queries, guide users through the process step by step
6. If user asks about prices you don't have, suggest they search or offer to help set up a search
7. Be proactive - suggest related helpful information when relevant
8. NEVER hallucinate specific prices, flight numbers, or availability - only reference what's in search results or ask to search

Respond naturally and helpfully. If the conversation is about booking, maintain context about where they are in the process.`;
}

/**
 * Generate AI response
 * @param {string} userMessage - User's message
 * @param {Object} context - Conversation context
 * @param {Array} conversationHistory - Previous messages
 * @returns {Promise<Object>} Response with content and metadata
 */
async function generateResponse(userMessage, context = {}, conversationHistory = []) {
  try {
    const rateLimit = checkRateLimit(context.userId || 'anonymous');
    if (!rateLimit.allowed) {
      throw new Error('Rate limit exceeded. Please wait a moment before sending more messages.');
    }

    const systemPrompt = generateSystemPrompt(context);
    
    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    const provider = context.provider || DEFAULT_PROVIDER;
    
    let response;
    let usage = { prompt_tokens: 0, completion_tokens: 0 };

    if (provider === 'anthropic' && anthropic) {
      // Anthropic Claude
      const claudeResponse = await anthropic.messages.create({
        model: context.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role,
          content: m.content
        })),
        system: systemPrompt
      });
      
      response = claudeResponse.content[0].text;
      usage = {
        prompt_tokens: claudeResponse.usage.input_tokens,
        completion_tokens: claudeResponse.usage.output_tokens
      };
    } else if (openai) {
      // OpenAI GPT
      const completion = await openai.chat.completions.create({
        model: context.model || DEFAULT_MODEL,
        messages,
        max_tokens: 2000,
        temperature: 0.7,
        top_p: 0.9
      });
      
      response = completion.choices[0].message.content;
      usage = completion.usage;
    } else {
      throw new Error('No LLM provider available. Please configure OPENAI_API_KEY or ANTHROPIC_API_KEY.');
    }

    trackTokenUsage(usage.prompt_tokens, usage.completion_tokens);

    return {
      content: response,
      metadata: {
        provider,
        model: context.model || DEFAULT_MODEL,
        tokens: usage,
        rateLimit
      }
    };
  } catch (error) {
    console.error('AI Response Generation Error:', error);
    throw error;
  }
}

/**
 * Stream AI response
 * @param {string} userMessage 
 * @param {Object} context 
 * @param {Array} conversationHistory 
 * @param {Function} onChunk - Callback for each chunk
 * @returns {Promise<Object>} Final response
 */
async function streamResponse(userMessage, context = {}, conversationHistory = [], onChunk) {
  try {
    const rateLimit = checkRateLimit(context.userId || 'anonymous');
    if (!rateLimit.allowed) {
      throw new Error('Rate limit exceeded. Please wait before sending more messages.');
    }

    const systemPrompt = generateSystemPrompt(context);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    const provider = context.provider || DEFAULT_PROVIDER;
    let fullContent = '';

    if (provider === 'anthropic' && anthropic) {
      // Stream with Anthropic
      const stream = await anthropic.messages.create({
        model: context.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role,
          content: m.content
        })),
        system: systemPrompt,
        stream: true
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.text) {
          const text = chunk.delta.text;
          fullContent += text;
          onChunk(text, false);
        }
      }
    } else if (openai) {
      // Stream with OpenAI
      const stream = await openai.chat.completions.create({
        model: context.model || DEFAULT_MODEL,
        messages,
        max_tokens: 2000,
        temperature: 0.7,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          onChunk(content, false);
        }
      }
    } else {
      throw new Error('No LLM provider available for streaming.');
    }

    onChunk('', true); // Signal completion

    return {
      content: fullContent,
      metadata: {
        provider,
        model: context.model || DEFAULT_MODEL,
        rateLimit
      }
    };
  } catch (error) {
    console.error('AI Stream Error:', error);
    throw error;
  }
}

/**
 * Extract intent from user message
 * @param {string} userMessage 
 * @returns {Promise<Object>} Intent and confidence
 */
async function extractIntent(userMessage) {
  try {
    const prompt = `Analyze this travel-related message and extract the primary intent. 

Available intents:
- search_flight: User wants to find flights
- search_hotel: User wants to find hotels  
- search_car: User wants to find car rentals
- compare_prices: User wants to compare prices
- get_destination_info: User wants info about a destination
- booking_help: User needs help with booking process
- modify_search: User wants to change search parameters
- price_alert_setup: User wants price alerts
- general_travel_question: General travel inquiry
- greeting: User is greeting or starting conversation
- goodbye: User is ending conversation
- unclear: Cannot determine intent

Message: "${userMessage}"

Respond ONLY with a JSON object in this exact format:
{
  "intent": "one_of_the_above",
  "confidence": 0.0_to_1.0,
  "reasoning": "brief explanation"
}`;

    let response;
    
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use mini for faster/cheaper intent extraction
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1
      });
      response = completion.choices[0].message.content;
    } else if (anthropic) {
      const claudeResponse = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      });
      response = claudeResponse.content[0].text;
    } else {
      // Fallback to simple keyword matching
      return fallbackIntentExtraction(userMessage);
    }

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return fallbackIntentExtraction(userMessage);
  } catch (error) {
    console.error('Intent Extraction Error:', error);
    return fallbackIntentExtraction(userMessage);
  }
}

/**
 * Fallback intent extraction using keyword matching
 * @param {string} message 
 * @returns {Object}
 */
function fallbackIntentExtraction(message) {
  const lowerMsg = message.toLowerCase();
  
  const intentPatterns = {
    search_flight: ['flight', 'fly', 'airport', 'plane', 'airline', 'ticket', 'from.*to'],
    search_hotel: ['hotel', 'stay', 'room', 'accommodation', 'lodging', 'suite', 'resort'],
    search_car: ['car', 'rental', 'drive', 'vehicle', 'suv', 'sedan'],
    compare_prices: ['compare', 'cheapest', 'best price', 'cheaper', 'difference'],
    get_destination_info: ['about', 'what to do', 'visit', 'attractions', 'things to see', 'guide'],
    booking_help: ['book', 'booking', 'reserve', 'reservation', 'confirm'],
    price_alert_setup: ['alert', 'notify', 'price drop', 'when cheaper', 'watch'],
    greeting: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'],
    goodbye: ['bye', 'goodbye', 'see you', 'thanks', 'thank you']
  };

  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(lowerMsg)) {
        return {
          intent,
          confidence: 0.7,
          reasoning: 'Keyword match fallback'
        };
      }
    }
  }

  return {
    intent: 'general_travel_question',
    confidence: 0.5,
    reasoning: 'No specific pattern matched'
  };
}

/**
 * Extract entities from user message
 * @param {string} userMessage 
 * @returns {Promise<Object>} Extracted entities
 */
async function extractEntities(userMessage) {
  try {
    const prompt = `Extract travel-related entities from this message. Return ONLY a JSON object.

Message: "${userMessage}"

Extract:
- origin: Starting location (city, airport code, or "current location")
- destination: Destination location (city, airport code, or landmark)
- dates: Travel dates mentioned (check-in, check-out, or flexible)
- travelers: Number of travelers (adults, children, infants)
- budget: Budget range mentioned
- preferences: Any preferences (direct flight, wifi, breakfast, etc.)
- tripType: "one-way", "round-trip", or "multi-city"

Return JSON format:
{
  "origin": "extracted or null",
  "destination": "extracted or null", 
  "dates": {
    "checkIn": "YYYY-MM-DD or relative description",
    "checkOut": "YYYY-MM-DD or relative description",
    "flexible": true/false
  } or null,
  "travelers": {
    "adults": number,
    "children": number,
    "infants": number
  } or null,
  "budget": {
    "min": number or null,
    "max": number or null,
    "currency": "USD"
  } or null,
  "preferences": ["preference1", "preference2"] or [],
  "tripType": "one-way|round-trip|multi-city|null"
}`;

    let response;
    
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.1
      });
      response = completion.choices[0].message.content;
    } else if (anthropic) {
      const claudeResponse = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      });
      response = claudeResponse.content[0].text;
    } else {
      return fallbackEntityExtraction(userMessage);
    }

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return fallbackEntityExtraction(userMessage);
  } catch (error) {
    console.error('Entity Extraction Error:', error);
    return fallbackEntityExtraction(userMessage);
  }
}

/**
 * Fallback entity extraction
 * @param {string} message 
 * @returns {Object}
 */
function fallbackEntityExtraction(message) {
  const entities = {
    origin: null,
    destination: null,
    dates: null,
    travelers: null,
    budget: null,
    preferences: [],
    tripType: null
  };

  const lowerMsg = message.toLowerCase();

  // Extract cities/locations (simplified)
  const fromMatch = message.match(/from\s+([A-Za-z\s]+?)(?:\s+to\s+|\s+on\s+|\s+for\s+|$)/i);
  const toMatch = message.match(/to\s+([A-Za-z\s]+?)(?:\s+on\s+|\s+for\s+|\s+from\s+|$)/i);
  
  if (fromMatch) entities.origin = fromMatch[1].trim();
  if (toMatch) entities.destination = toMatch[1].trim();

  // Extract dates (relative)
  if (/next week/i.test(lowerMsg)) {
    entities.dates = { checkIn: 'next week', flexible: true };
  } else if (/tomorrow/i.test(lowerMsg)) {
    entities.dates = { checkIn: 'tomorrow', flexible: false };
  } else if (/this weekend/i.test(lowerMsg)) {
    entities.dates = { checkIn: 'this weekend', flexible: false };
  }

  // Extract travelers
  const travelerMatch = message.match(/(\d+)\s*(?:adult|person|people|traveler|passenger)/i);
  if (travelerMatch) {
    entities.travelers = { adults: parseInt(travelerMatch[1]), children: 0, infants: 0 };
  }

  // Extract trip type
  if (/one[- ]?way/i.test(lowerMsg)) entities.tripType = 'one-way';
  else if (/round[- ]?trip/i.test(lowerMsg)) entities.tripType = 'round-trip';

  return entities;
}

/**
 * Generate booking parameters from intent and entities
 * @param {string} intent 
 * @param {Object} entities 
 * @returns {Object} Booking parameters
 */
function generateBookingParams(intent, entities) {
  const params = {
    type: null,
    origin: entities.origin,
    destination: entities.destination,
    dates: entities.dates,
    travelers: entities.travelers || { adults: 1, children: 0, infants: 0 },
    preferences: entities.preferences || [],
    filters: {}
  };

  switch (intent) {
    case 'search_flight':
      params.type = 'flight';
      params.filters = {
        directOnly: entities.preferences?.includes('direct flight') || false,
        maxStops: entities.preferences?.includes('non-stop') ? 0 : null,
        class: entities.preferences?.find(p => /business|first|economy/i.test(p)) || 'economy'
      };
      break;
      
    case 'search_hotel':
      params.type = 'hotel';
      params.filters = {
        amenities: entities.preferences?.filter(p => /wifi|breakfast|pool|gym/i.test(p)) || [],
        minRating: 3,
        maxPrice: entities.budget?.max || null
      };
      break;
      
    case 'search_car':
      params.type = 'car';
      params.filters = {
        vehicleType: entities.preferences?.find(p => /suv|sedan|compact|luxury/i.test(p)) || null,
        transmission: entities.preferences?.find(p => /automatic|manual/i.test(p)) || 'automatic'
      };
      break;
      
    default:
      params.type = 'general';
  }

  return params;
}

/**
 * Generate smart suggestions based on context
 * @param {Object} context 
 * @returns {Promise<Array>} Suggestions
 */
async function generateSuggestions(context = {}) {
  const suggestions = [];

  // Based on current intent
  if (context.currentIntent === 'search_flight' && !context.extractedEntities?.dates) {
    suggestions.push({
      type: 'action',
      text: 'Set travel dates',
      action: 'ask_dates'
    });
  }

  if (context.currentIntent?.includes('search') && !context.extractedEntities?.budget) {
    suggestions.push({
      type: 'action', 
      text: 'Set budget range',
      action: 'ask_budget'
    });
  }

  // Based on search results
  if (context.searchResults?.length > 0) {
    suggestions.push({
      type: 'action',
      text: 'Compare prices',
      action: 'compare_prices'
    });
    suggestions.push({
      type: 'action',
      text: 'Filter by price',
      action: 'filter_price'
    });
  }

  // Popular suggestions
  suggestions.push(
    { type: 'quick_reply', text: 'Show me deals', action: 'show_deals' },
    { type: 'quick_reply', text: 'Help with booking', action: 'booking_help' }
  );

  return suggestions.slice(0, 4); // Max 4 suggestions
}

module.exports = {
  generateResponse,
  streamResponse,
  extractIntent,
  extractEntities,
  generateBookingParams,
  generateSuggestions,
  checkRateLimit,
  getTokenUsage,
  generateSystemPrompt
};
