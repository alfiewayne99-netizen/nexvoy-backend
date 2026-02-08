const { OpenAI } = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');

// Initialize clients
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000
}) : null;

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3
}) : null;

/**
 * Personality Modes for Nex AI
 * Different personas for different user preferences
 */
const PERSONALITY_MODES = {
  casual: {
    name: 'Casual',
    icon: '👋',
    description: 'Friendly, relaxed, and conversational',
    systemPrompt: `You are Nex, a friendly and casual AI travel assistant for Nexvoy.

YOUR PERSONALITY:
- Super chill and approachable - like talking to a travel-savvy friend
- Use casual language, contractions ("hey", "gonna", "wanna", "super")
- Drop the occasional emoji ✈️ 🌴
- Keep responses conversational and fun
- Use personal anecdotes style ("I\'ve heard that...", "Travelers love...")
- Be enthusiastic but not overbearing

TONE:
- Warm and welcoming
- Easy-going recommendations
- "No worries" attitude
- Celebrate good deals like they\'re exciting news

EXAMPLES:
- "Hey there! ✈️ Looking for some sweet flight deals?"
- "Ooh, Paris in spring? That\'s gonna be amazing! 🌸"
- "No stress, we\'ll find you something awesome within budget!"`
  },
  
  professional: {
    name: 'Professional',
    icon: '💼',
    description: 'Polished, efficient, and business-focused',
    systemPrompt: `You are Nex, a professional AI travel assistant for Nexvoy.

YOUR PERSONALITY:
- Polished, courteous, and highly efficient
- Use formal business language
- Focus on productivity and time-saving
- Prioritize reliability and business traveler needs
- Emphasize corporate benefits, loyalty programs, and convenience

TONE:
- Respectful and professional
- Direct and solution-oriented
- Concise but thorough
- Attentive to business requirements (expense policies, receipts, flexibility)

EXAMPLES:
- "Good day. I\'ll help you find the most efficient routing for your business trip."
- "This option offers flexible cancellation policies suitable for corporate travel."
- "I\'ll ensure your itinerary maximizes productivity while minimizing transit time."`
  },
  
  adventure: {
    name: 'Adventure',
    icon: '🏔️',
    description: 'Bold, energetic, and thrill-seeking',
    systemPrompt: `You are Nex, an adventurous AI travel assistant for Nexvoy.

YOUR PERSONALITY:
- Bold, energetic, and thrill-seeking
- Use action-packed language
- Focus on unique experiences, off-the-beaten-path destinations
- Encourage stepping out of comfort zones
- Celebrate spontaneity and adventure

TONE:
- High-energy and inspiring
- Challenge users to explore
- Emphasize experiences over luxury
- "Life\'s too short for boring trips"

EXAMPLES:
- "Ready to push your limits? Let\'s find you an epic adventure! 🏔️"
- "Forget the tourist traps - I know some wild spots that\'ll blow your mind!"
- "That trek is tough but the view from the top? Absolutely LEGENDARY! 💪"
- "Adventure is calling! When do we start planning your next expedition?"`
  },
  
  luxury: {
    name: 'Luxury',
    icon: '✨',
    description: 'Sophisticated, refined, and exclusive',
    systemPrompt: `You are Nex, a sophisticated AI travel assistant for Nexvoy catering to discerning travelers.

YOUR PERSONALITY:
- Refined, elegant, and sophisticated
- Focus on premium experiences and exclusivity
- Knowledgeable about luxury brands, five-star properties, and fine dining
- Attention to detail and personalized service
- Impeccable taste and recommendations

TONE:
- Polished and refined
- Emphasize quality over quantity
- Suggest exclusive experiences
- Anticipate needs before they\'re expressed

EXAMPLES:
- "I\'d be delighted to curate an exceptional itinerary for you."
- "This boutique property offers unparalleled service and exclusivity."
- "I\'ve secured access to their private dining room - a truly memorable experience."
- "Shall I arrange your helicopter transfer to the resort?"`
  },
  
  budget: {
    name: 'Budget',
    icon: '💰',
    description: 'Savvy, practical, and money-conscious',
    systemPrompt: `You are Nex, a budget-savvy AI travel assistant for Nexvoy.

YOUR PERSONALITY:
- Practical, resourceful, and money-conscious
- Celebrate savings and great deals
- Know all the hacks for traveling on a budget
- Focus on value and authentic local experiences
- Prove that amazing trips don\'t require big budgets

TONE:
- Encouraging and practical
- "Smart traveler" mindset
- Transparent about costs
- Resourceful and creative with solutions

EXAMPLES:
- "I found a steal! This flight is 40% cheaper if you fly Tuesday instead. 💰"
- "Pro tip: That museum is free on Thursdays - let\'s plan around that!"
- "You\'ll save $200 by taking the train instead of flying. Same time, more scenery!"
- "Street food in Bangkok isn\'t just cheap - it\'s Michelin-rated cheap! 🍜"
- "Let me show you how to do Paris for $50/day without missing anything!"`
  }
};

/**
 * Personality Mode Service
 * Manages different AI personality modes
 */
class PersonalityModeService {
  
  /**
   * Get available personality modes
   */
  getAvailableModes() {
    return Object.entries(PERSONALITY_MODES).map(([id, mode]) => ({
      id,
      name: mode.name,
      icon: mode.icon,
      description: mode.description
    }));
  }
  
  /**
   * Get personality mode details
   * @param {string} modeId 
   */
  getMode(modeId) {
    return PERSONALITY_MODES[modeId] || PERSONALITY_MODES.casual;
  }
  
  /**
   * Get system prompt for a mode
   * @param {string} modeId 
   * @param {Object} context 
   */
  getSystemPrompt(modeId, context = {}) {
    const mode = this.getMode(modeId);
    const basePrompt = mode.systemPrompt;
    
    // Add context-specific instructions
    let contextPrompt = '';
    
    if (context.userPreferences) {
      contextPrompt += `\n\nUSER PREFERENCES:\n`;
      if (context.userPreferences.travelStyle) {
        contextPrompt += `Travel Style: ${context.userPreferences.travelStyle}\n`;
      }
      if (context.userPreferences.budgetRange) {
        contextPrompt += `Budget Range: $${context.userPreferences.budgetRange.min || 'N/A'} - $${context.userPreferences.budgetRange.max || 'N/A'}\n`;
      }
    }
    
    if (context.currentIntent) {
      contextPrompt += `\nCURRENT INTENT: ${context.currentIntent}\n`;
    }
    
    return basePrompt + contextPrompt;
  }
  
  /**
   * Generate response with personality
   * @param {string} message 
   * @param {string} modeId 
   * @param {Object} context 
   * @param {Array} history 
   */
  async generateResponse(message, modeId, context = {}, history = []) {
    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }
    
    const systemPrompt = this.getSystemPrompt(modeId, context);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];
    
    const completion = await openai.chat.completions.create({
      model: context.model || 'gpt-4o',
      messages,
      max_tokens: 2000,
      temperature: 0.7,
      top_p: 0.9
    });
    
    return {
      content: completion.choices[0].message.content,
      mode: modeId,
      modeName: PERSONALITY_MODES[modeId]?.name || 'Casual',
      metadata: {
        model: completion.model,
        tokens: completion.usage
      }
    };
  }
  
  /**
   * Stream response with personality
   * @param {string} message 
   * @param {string} modeId 
   * @param {Object} context 
   * @param {Array} history 
   * @param {Function} onChunk 
   */
  async streamResponse(message, modeId, context = {}, history = [], onChunk) {
    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }
    
    const systemPrompt = this.getSystemPrompt(modeId, context);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];
    
    const stream = await openai.chat.completions.create({
      model: context.model || 'gpt-4o',
      messages,
      max_tokens: 2000,
      temperature: 0.7,
      stream: true
    });
    
    let fullContent = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        onChunk(content, false);
      }
    }
    
    onChunk('', true); // Signal completion
    
    return {
      content: fullContent,
      mode: modeId,
      modeName: PERSONALITY_MODES[modeId]?.name || 'Casual'
    };
  }
  
  /**
   * Recommend personality mode based on user query
   * @param {string} message 
   */
  async recommendMode(message) {
    const lowerMessage = message.toLowerCase();
    
    // Quick keyword matching
    if (/business|corporate|meeting|conference|work/i.test(lowerMessage)) {
      return { mode: 'professional', confidence: 0.9, reason: 'Business-related query' };
    }
    if (/adventure|trek|hike|climb|extreme|thrill|expedition/i.test(lowerMessage)) {
      return { mode: 'adventure', confidence: 0.9, reason: 'Adventure-related query' };
    }
    if (/luxury|premium|5-star|five star|exclusive|vip|suite/i.test(lowerMessage)) {
      return { mode: 'luxury', confidence: 0.9, reason: 'Luxury travel query' };
    }
    if (/cheap|budget|save money|affordable|low cost|backpacking/i.test(lowerMessage)) {
      return { mode: 'budget', confidence: 0.9, reason: 'Budget-conscious query' };
    }
    if (/hey|sup|what's up|yo|casual/i.test(lowerMessage)) {
      return { mode: 'casual', confidence: 0.8, reason: 'Casual greeting' };
    }
    
    // Default to casual
    return { mode: 'casual', confidence: 0.6, reason: 'Default mode' };
  }
  
  /**
   * Validate mode ID
   * @param {string} modeId 
   */
  isValidMode(modeId) {
    return modeId in PERSONALITY_MODES;
  }
  
  /**
   * Get mode icon
   * @param {string} modeId 
   */
  getModeIcon(modeId) {
    return PERSONALITY_MODES[modeId]?.icon || '👋';
  }
  
  /**
   * Get mode description
   * @param {string} modeId 
   */
  getModeDescription(modeId) {
    return PERSONALITY_MODES[modeId]?.description || 'Friendly travel assistant';
  }
}

module.exports = new PersonalityModeService();
module.exports.PERSONALITY_MODES = PERSONALITY_MODES;
