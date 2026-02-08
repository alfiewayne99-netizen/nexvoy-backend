const TripPlan = require('../models/TripPlan');
const { OpenAI } = require('openai');
const axios = require('axios');

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 60000
}) : null;

/**
 * Trip Planning Service
 * Generates comprehensive AI-powered trip plans
 */
class TripPlanningService {
  
  /**
   * Generate a complete trip plan
   * @param {Object} params - Trip parameters
   */
  async generateTripPlan(params) {
    const {
      origin,
      destinations,
      startDate,
      duration,
      budget,
      travelers,
      tripType = 'leisure',
      preferences = {},
      userId
    } = params;
    
    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }
    
    // Generate AI trip plan
    const prompt = this.buildTripPlanPrompt(params);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: 'You are an expert travel planner. Create detailed, practical trip plans with real recommendations. Always return valid JSON.'
      }, {
        role: 'user',
        content: prompt
      }],
      response_format: { type: 'json_object' },
      max_tokens: 4000
    });
    
    const planData = JSON.parse(completion.choices[0].message.content);
    
    // Enhance with real data
    const enhancedPlan = await this.enhanceWithRealData(planData, params);
    
    // Save to database
    const tripPlan = new TripPlan({
      userId,
      name: planData.name || `${duration}-day trip to ${destinations[0]}`,
      description: planData.description,
      parameters: {
        origin,
        destinations: destinations.map((d, i) => ({
          city: d,
          country: planData.destinations?.[i]?.country || '',
          duration: Math.floor(duration / destinations.length),
          order: i
        })),
        startDate: new Date(startDate),
        endDate: new Date(new Date(startDate).getTime() + duration * 24 * 60 * 60 * 1000),
        duration,
        travelers,
        budget: {
          total: budget,
          currency: 'USD',
          breakdown: enhancedPlan.budgetBreakdown || {}
        },
        tripType,
        preferences
      },
      itinerary: enhancedPlan.itinerary || [],
      insights: enhancedPlan.insights || {},
      aiMetadata: {
        model: 'gpt-4o',
        generatedAt: new Date(),
        confidence: 0.85
      }
    });
    
    await tripPlan.save();
    return tripPlan;
  }
  
  /**
   * Build the prompt for trip planning
   */
  buildTripPlanPrompt(params) {
    const { origin, destinations, duration, budget, travelers, tripType, preferences } = params;
    
    return `Create a detailed ${duration}-day trip plan with the following parameters:

ORIGIN: ${origin}
DESTINATIONS: ${destinations.join(', ')}
DURATION: ${duration} days
BUDGET: $${budget} USD
TRAVELERS: ${travelers.adults} adults${travelers.children > 0 ? `, ${travelers.children} children` : ''}
TRIP TYPE: ${tripType}
PREFERENCES: ${JSON.stringify(preferences)}

Create a comprehensive JSON response with this exact structure:
{
  "name": "Catchy trip plan name",
  "description": "Brief overview of the trip",
  "destinations": [
    {
      "city": "City name",
      "country": "Country",
      "days": number,
      "highlights": ["highlight1", "highlight2"]
    }
  ],
  "itinerary": [
    {
      "day": 1,
      "destination": "City name",
      "summary": "Brief day summary",
      "highlights": ["highlight1", "highlight2"],
      "activities": [
        {
          "time": "9:00 AM",
          "title": "Activity name",
          "description": "What to do",
          "type": "sightseeing|dining|activity|transport|accommodation|free_time",
          "duration": "2 hours",
          "cost": {"amount": 50, "currency": "USD"},
          "tips": "Pro tip for this activity"
        }
      ],
      "meals": {
        "breakfast": {"included": true, "recommendation": "Where to eat"},
        "lunch": {"included": false, "recommendation": "Local spot"},
        "dinner": {"included": false, "recommendation": "Nice restaurant"}
      },
      "estimatedCost": {"amount": 150, "currency": "USD"}
    }
  ],
  "budgetBreakdown": {
    "flights": 500,
    "accommodation": 800,
    "activities": 400,
    "food": 300,
    "transport": 200,
    "miscellaneous": 100
  },
  "insights": {
    "bestTimeToVisit": "Why this timing is good",
    "weatherExpectations": "What weather to expect",
    "culturalTips": ["tip1", "tip2"],
    "moneySavingTips": ["tip1", "tip2"],
    "packingSuggestions": ["item1", "item2"],
    "localCustoms": ["custom1", "custom2"],
    "emergencyContacts": [
      {"name": "Police", "number": "local number"}
    ]
  }
}

Make the itinerary realistic, considering travel time between cities. Include a mix of popular attractions and local experiences. Stay within the $${budget} budget. Provide practical tips and specific recommendations.`;
  }
  
  /**
   * Enhance plan with real data
   */
  async enhanceWithRealData(planData, params) {
    // In a real implementation, this would:
    // 1. Fetch real flight prices
    // 2. Get hotel recommendations from APIs
    // 3. Verify attraction availability
    // 4. Get real-time pricing
    
    // For now, return the AI-generated plan
    return planData;
  }
  
  /**
   * Optimize multi-city itinerary
   * @param {Array} destinations - Array of destination names
   * @param {Object} constraints - Optimization constraints
   */
  async optimizeMultiCityRoute(destinations, constraints = {}) {
    const { origin, maxDuration, priorities = [] } = constraints;
    
    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }
    
    const prompt = `Optimize this multi-city trip route:

ORIGIN: ${origin}
DESTINATIONS: ${destinations.join(', ')}
MAX DURATION: ${maxDuration || 'flexible'} days
PRIORITIES: ${priorities.join(', ') || 'balanced travel'}

Provide the optimal order to visit these cities, considering:
1. Geographic proximity (minimize backtracking)
2. Transport connections between cities
3. Logical flow of the journey
4. Time spent in each location

Return JSON format:
{
  "optimizedRoute": [
    {"city": "name", "days": number, "reason": "why this order"}
  ],
  "transportOptions": [
    {"from": "city1", "to": "city2", "mode": "train|flight|bus", "duration": "X hours", "estimatedCost": 100}
  ],
  "alternativeRoutes": [
    {"description": "Alternative option", "cities": ["city1", "city2"]}
  ],
  "tips": ["tip1", "tip2"]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 2000
    });
    
    return JSON.parse(completion.choices[0].message.content);
  }
  
  /**
   * Generate bleisure (business + leisure) suggestions
   * @param {Object} params - Business trip parameters
   */
  async generateBleisurePlan(params) {
    const { origin, businessDestination, businessDates, extraDays, interests } = params;
    
    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }
    
    const prompt = `Create a bleisure (business + leisure) trip plan:

BUSINESS TRIP TO: ${businessDestination}
BUSINESS DATES: ${businessDates}
EXTRA DAYS AVAILABLE: ${extraDays}
INTERESTS: ${interests?.join(', ') || 'general sightseeing'}

Create a plan that:
1. Maximizes leisure time around business commitments
2. Suggests nearby destinations for the extra days
3. Includes activities that complement a business trip
4. Considers proximity to business district/hotel

Return JSON format:
{
  "recommendedApproach": "Extend before/after business",
  "leisureDestinations": [
    {"name": "destination", "distance": "X hours", "daysRecommended": number, "highlights": []}
  ],
  "itinerary": [
    {"day": 1, "type": "leisure|business|mixed", "activities": []}
  ],
  "tips": ["how to maximize bleisure time"],
  "packingSuggestions": ["business casual items", "leisure items"]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 2000
    });
    
    return JSON.parse(completion.choices[0].message.content);
  }
  
  /**
   * Generate budget-based suggestions
   * @param {string} destination 
   * @param {number} budget 
   * @param {number} days 
   */
  async generateBudgetTrip(destination, budget, days) {
    const budgetPerDay = Math.floor(budget / days);
    
    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }
    
    const prompt = `Create a budget trip plan for:

DESTINATION: ${destination}
TOTAL BUDGET: $${budget} USD
DURATION: ${days} days
DAILY BUDGET: ~$${budgetPerDay} USD/day

Create a realistic budget trip plan that includes:
1. Affordable accommodation options (hostels, budget hotels, airbnb)
2. Free/cheap activities and attractions
3. Budget dining options (street food, markets, local spots)
4. Money-saving transport tips
5. Estimated costs for everything

Return JSON format:
{
  "destination": "${destination}",
  "budget": ${budget},
  "duration": ${days},
  "dailyBudget": ${budgetPerDay},
  "accommodation": {
    "recommendedAreas": ["area1", "area2"],
    "options": [{"type": "hostel", "estimatedCost": 30}]
  },
  "dailyItinerary": [
    {
      "day": 1,
      "activities": [{"name": "Free walking tour", "cost": 0}],
      "meals": [{"type": "street food", "cost": 10}],
      "transport": {"cost": 5},
      "totalDayCost": 45
    }
  ],
  "moneySavingTips": ["tip1", "tip2"],
  "freeActivities": ["activity1", "activity2"],
  "budgetBreakdown": {
    "accommodation": 300,
    "food": 200,
    "activities": 150,
    "transport": 100,
    "buffer": 50
  }
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 3000
    });
    
    return JSON.parse(completion.choices[0].message.content);
  }
  
  /**
   * Fork an existing trip plan
   * @param {string} planId 
   * @param {string} newUserId 
   * @param {string} newName 
   */
  async forkPlan(planId, newUserId, newName) {
    const originalPlan = await TripPlan.findById(planId);
    if (!originalPlan) {
      throw new Error('Plan not found');
    }
    
    if (!originalPlan.isPublic && originalPlan.userId !== newUserId) {
      throw new Error('Plan is not public');
    }
    
    const forked = originalPlan.fork(newUserId, newName);
    await forked.save();
    
    // Update forks list on original
    originalPlan.forks.push(newUserId);
    await originalPlan.save();
    
    return forked;
  }
  
  /**
   * Get public trip plans
   */
  async getPublicPlans(limit = 10) {
    return TripPlan.find({ isPublic: true })
      .sort({ rating: -1, createdAt: -1 })
      .limit(limit);
  }
  
  /**
   * Get user's trip plans
   * @param {string} userId 
   */
  async getUserPlans(userId) {
    return TripPlan.find({ userId })
      .sort({ createdAt: -1 });
  }
  
  /**
   * Update trip plan status
   * @param {string} planId 
   * @param {string} status 
   */
  async updatePlanStatus(planId, status) {
    return TripPlan.findByIdAndUpdate(
      planId,
      { status },
      { new: true }
    );
  }
}

module.exports = new TripPlanningService();
