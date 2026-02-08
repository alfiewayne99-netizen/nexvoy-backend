const ProactiveSuggestion = require('../models/ProactiveSuggestion');
const UserPreference = require('../models/UserPreference');
const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000
}) : null;

/**
 * Proactive Suggestion Service
 * Generates personalized, timely suggestions for users
 */
class ProactiveSuggestionService {
  
  /**
   * Generate price drop suggestions
   * @param {string} userId 
   * @param {Object} priceData 
   */
  async generatePriceDropSuggestion(userId, priceData) {
    const { origin, destination, originalPrice, currentPrice, currency = 'USD' } = priceData;
    const percentChange = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    
    // Skip if price drop is less than 10%
    if (percentChange < 10) return null;
    
    const title = `✈️ ${percentChange}% cheaper flights to ${destination}`;
    const message = `Great news! Flights from ${origin} to ${destination} are now ${percentChange}% cheaper at ${currency} ${currentPrice} (was ${currency} ${originalPrice}). Book now before prices go back up!`;
    
    return ProactiveSuggestion.create({
      userId,
      type: 'price_drop',
      priority: percentChange > 25 ? 'high' : 'medium',
      title,
      message,
      data: {
        route: {
          origin,
          destination,
          originalPrice,
          currentPrice,
          currency,
          percentChange
        }
      },
      actions: [
        { label: 'Search Flights', type: 'search', payload: { origin, destination } },
        { label: 'Set Price Alert', type: 'remind_later' },
        { label: 'Dismiss', type: 'dismiss' }
      ],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
  }
  
  /**
   * Generate weather alert suggestions
   * @param {string} userId 
   * @param {Object} weatherData 
   */
  async generateWeatherAlert(userId, weatherData) {
    const { destination, condition, temperature, alerts, dates } = weatherData;
    
    let title, message, priority;
    
    if (alerts?.length > 0) {
      title = `⚠️ Weather Alert for ${destination}`;
      message = `Heads up! There's ${alerts.join(', ')} expected in ${destination} during your trip (${dates.start} to ${dates.end}). Temperature around ${temperature}°C. Consider adjusting your plans.`;
      priority = 'high';
    } else {
      title = `🌤️ Weather Update: ${destination}`;
      message = `Perfect weather ahead! ${destination} will have ${condition} during your visit with temperatures around ${temperature}°C. Great time for outdoor activities!`;
      priority = 'low';
    }
    
    return ProactiveSuggestion.create({
      userId,
      type: 'weather_alert',
      priority,
      title,
      message,
      data: {
        weather: {
          destination,
          condition,
          temperature,
          alerts: alerts || [],
          dates
        }
      },
      actions: [
        { label: 'View Details', type: 'view_details' },
        { label: 'Adjust Itinerary', type: 'search' },
        { label: 'Dismiss', type: 'dismiss' }
      ],
      expiresAt: new Date(dates.end)
    });
  }
  
  /**
   * Generate passport expiry warning
   * @param {string} userId 
   * @param {Object} passportData 
   */
  async generatePassportExpiryWarning(userId, passportData) {
    const { expiryDate, country = 'your country' } = passportData;
    const daysUntilExpiry = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry > 180) return null; // More than 6 months, no urgency
    
    let priority, title, message;
    
    if (daysUntilExpiry < 30) {
      priority = 'urgent';
      title = '🚨 Passport Expires Soon!';
      message = `Your passport expires in ${daysUntilExpiry} days (${expiryDate}). Most countries require 6 months validity. Renew immediately to avoid travel disruptions!`;
    } else if (daysUntilExpiry < 90) {
      priority = 'high';
      title = '⚠️ Passport Expiring in 3 Months';
      message = `Your passport expires on ${expiryDate} (${daysUntilExpiry} days). Start your renewal process soon to ensure smooth travel.`;
    } else {
      priority = 'medium';
      title = '📅 Passport Renewal Reminder';
      message = `Your passport expires in ${daysUntilExpiry} days. Consider renewing if you have upcoming international travel plans.`;
    }
    
    return ProactiveSuggestion.create({
      userId,
      type: 'passport_expiry',
      priority,
      title,
      message,
      data: {
        document: {
          type: 'passport',
          expiryDate,
          daysUntilExpiry,
          country
        }
      },
      actions: [
        { label: 'Find Renewal Info', type: 'search', payload: { query: 'passport renewal' } },
        { label: 'Remind Me Later', type: 'remind_later' },
        { label: 'I\'ve Renewed', type: 'dismiss' }
      ],
      expiresAt: new Date(expiryDate)
    });
  }
  
  /**
   * Generate visa requirement suggestion
   * @param {string} userId 
   * @param {Object} visaData 
   */
  async generateVisaRequirement(userId, visaData) {
    const { destination, nationality, requirement, processingTime } = visaData;
    
    const title = `📋 Visa Required for ${destination}`;
    const message = `As a ${nationality} passport holder, you need a visa to visit ${destination}. Processing time: ${processingTime}. Apply well in advance of your trip!`;
    
    return ProactiveSuggestion.create({
      userId,
      type: 'visa_required',
      priority: 'high',
      title,
      message,
      data: {
        document: {
          type: 'visa',
          country: destination,
          requirement,
          processingTime
        }
      },
      actions: [
        { label: 'Apply for Visa', type: 'search', payload: { query: `${destination} visa application` } },
        { label: 'Learn More', type: 'view_details' },
        { label: 'Dismiss', type: 'dismiss' }
      ]
    });
  }
  
  /**
   * Generate deal alert
   * @param {string} userId 
   * @param {Object} dealData 
   */
  async generateDealAlert(userId, dealData) {
    const { destination, discount, validUntil, imageUrl } = dealData;
    
    const title = `🔥 ${discount}% Off ${destination} Packages`;
    const message = `Limited time offer! Save ${discount}% on flights and hotels to ${destination}. Valid until ${new Date(validUntil).toLocaleDateString()}.`;
    
    return ProactiveSuggestion.create({
      userId,
      type: 'deal_alert',
      priority: 'medium',
      title,
      message,
      data: {
        deal: {
          destination,
          discount,
          validUntil,
          imageUrl
        }
      },
      actions: [
        { label: 'View Deal', type: 'book', url: dealData.bookingUrl },
        { label: 'Save for Later', type: 'remind_later' },
        { label: 'Dismiss', type: 'dismiss' }
      ],
      expiresAt: new Date(validUntil)
    });
  }
  
  /**
   * Generate rebooking opportunity suggestion
   * @param {string} userId 
   * @param {Object} rebookingData 
   */
  async generateRebookingOpportunity(userId, rebookingData) {
    const { originalBooking, betterOption, savings } = rebookingData;
    
    const title = `💰 Save ${savings.currency} ${savings.amount} with Better Flight`;
    const message = `Found a better option for your ${originalBooking.destination} trip! Same dates, better times, save ${savings.currency} ${savings.amount}. Would you like to rebook?`;
    
    return ProactiveSuggestion.create({
      userId,
      type: 'rebooking_opportunity',
      priority: 'medium',
      title,
      message,
      data: {
        route: {
          destination: originalBooking.destination,
          originalPrice: originalBooking.price,
          currentPrice: originalBooking.price - savings.amount,
          currency: savings.currency,
          percentChange: Math.round((savings.amount / originalBooking.price) * 100)
        }
      },
      actions: [
        { label: 'View New Option', type: 'view_details' },
        { label: 'Keep Original', type: 'dismiss' }
      ],
      expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days
    });
  }
  
  /**
   * Generate seasonal destination suggestion
   * @param {string} userId 
   * @param {Object} userPrefs 
   */
  async generateSeasonalSuggestion(userId, userPrefs) {
    const month = new Date().toLocaleString('default', { month: 'long' });
    const suggestions = {
      'January': ['Thailand', 'Australia', 'Dubai'],
      'February': ['Maldives', 'New Zealand', 'Vietnam'],
      'March': ['Japan', 'Morocco', 'Peru'],
      'April': ['Netherlands', 'Turkey', 'Nepal'],
      'May': ['Italy', 'Greece', 'Indonesia'],
      'June': ['Iceland', 'Norway', 'Scotland'],
      'July': ['Canada', 'Kenya', 'Ecuador'],
      'August': ['Croatia', 'Portugal', 'Costa Rica'],
      'September': ['Spain', 'France', 'Bhutan'],
      'October': ['Germany', 'USA', 'Mexico'],
      'November': ['India', 'Egypt', 'Argentina'],
      'December': ['Finland', 'Austria', 'Malaysia']
    };
    
    const destinations = suggestions[month] || ['Europe', 'Asia'];
    const destination = destinations[Math.floor(Math.random() * destinations.length)];
    
    const title = `🌟 Best Time to Visit ${destination}`;
    const message = `${month} is one of the best months to visit ${destination}! Perfect weather, fewer crowds, and amazing experiences await. Start planning your trip now.`;
    
    // Use AI to personalize if available
    let personalizedMessage = message;
    if (openai && userPrefs?.pastDestinations?.length > 0) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Create a personalized travel suggestion for ${destination} in ${month}. User has previously visited: ${userPrefs.pastDestinations.map(d => d.destination).join(', ')}. Style: ${userPrefs.travelStyle || 'general'}. Keep it under 100 words.`
          }],
          max_tokens: 150
        });
        personalizedMessage = completion.choices[0].message.content;
      } catch (e) {
        // Fallback to default message
      }
    }
    
    return ProactiveSuggestion.create({
      userId,
      type: 'seasonal_suggestion',
      priority: 'low',
      title,
      message: personalizedMessage,
      actions: [
        { label: 'Explore Deals', type: 'search', payload: { destination } },
        { label: 'Plan a Trip', type: 'search', payload: { query: `plan trip to ${destination}` } },
        { label: 'Not Interested', type: 'dismiss' }
      ],
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
    });
  }
  
  /**
   * Get all active suggestions for a user
   * @param {string} userId 
   */
  async getUserSuggestions(userId) {
    return ProactiveSuggestion.getUnreadForUser(userId);
  }
  
  /**
   * Get high priority suggestions
   * @param {string} userId 
   */
  async getHighPrioritySuggestions(userId) {
    return ProactiveSuggestion.getHighPriority(userId);
  }
  
  /**
   * Mark suggestion as read
   * @param {string} suggestionId 
   */
  async markAsRead(suggestionId) {
    const suggestion = await ProactiveSuggestion.findById(suggestionId);
    if (suggestion) {
      await suggestion.markAsRead();
    }
    return suggestion;
  }
  
  /**
   * Dismiss suggestion
   * @param {string} suggestionId 
   */
  async dismissSuggestion(suggestionId) {
    const suggestion = await ProactiveSuggestion.findById(suggestionId);
    if (suggestion) {
      await suggestion.dismiss();
    }
    return suggestion;
  }
  
  /**
   * Run scheduled checks for all users
   * This would be called by a cron job
   */
  async runScheduledChecks() {
    const users = await UserPreference.find({
      notifications: { dealAlerts: true }
    }).limit(100);
    
    for (const user of users) {
      // Check for expiring documents
      // Check for price drops on watched routes
      // Generate seasonal suggestions
      await this.generateSeasonalSuggestion(user.userId, user);
    }
  }
}

module.exports = new ProactiveSuggestionService();
