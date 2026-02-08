/**
 * Price Tracking Service
 * Monitors prices and triggers alerts
 */

const cron = require('node-cron');
const { PriceAlertRepository, AlertStatus } = require('../models/PriceAlert');
const emailService = require('./emailService');

class PriceTrackingService {
  constructor(priceService, database = null) {
    this.priceService = priceService;
    this.alertRepo = new PriceAlertRepository(database);
    this.isRunning = false;
    this.cronJob = null;
    this.checkInterval = process.env.PRICE_CHECK_INTERVAL || '0 */6 * * *'; // Every 6 hours
  }
  
  /**
   * Start the price tracking service
   */
  start() {
    if (this.isRunning) {
      console.log('Price tracking service already running');
      return;
    }
    
    console.log('Starting price tracking service...');
    this.isRunning = true;
    
    // Schedule regular price checks
    this.cronJob = cron.schedule(this.checkInterval, async () => {
      console.log('Running scheduled price check...');
      await this.checkAllAlerts();
    });
    
    // Run initial check
    this.checkAllAlerts();
  }
  
  /**
   * Stop the price tracking service
   */
  stop() {
    if (!this.isRunning) return;
    
    console.log('Stopping price tracking service...');
    if (this.cronJob) {
      this.cronJob.stop();
    }
    this.isRunning = false;
  }
  
  /**
   * Check all active alerts
   */
  async checkAllAlerts() {
    try {
      const activeAlerts = await this.alertRepo.findActiveAlerts();
      console.log(`Checking ${activeAlerts.length} active alerts...`);
      
      for (const alert of activeAlerts) {
        await this.checkAlert(alert);
      }
      
      console.log('Price check completed');
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }
  
  /**
   * Check a single alert
   */
  async checkAlert(alert) {
    try {
      // Check if expired
      if (alert.checkExpiry()) {
        await this.alertRepo.update(alert.id, {
          status: AlertStatus.EXPIRED,
          updatedAt: new Date()
        });
        return;
      }
      
      // Get current price
      const currentPrice = await this.getCurrentPrice(alert);
      
      if (currentPrice === null) {
        console.log(`Could not get price for alert ${alert.id}`);
        return;
      }
      
      // Check if price meets criteria
      const shouldTrigger = alert.checkPrice(currentPrice);
      
      // Update alert with new price
      await this.alertRepo.update(alert.id, {
        currentPrice: alert.currentPrice,
        priceHistory: alert.priceHistory,
        checkCount: alert.checkCount,
        lastCheckedAt: alert.lastCheckedAt,
        status: alert.status,
        triggeredAt: alert.triggeredAt,
        triggeredPrice: alert.triggeredPrice
      });
      
      // Send notification if triggered
      if (shouldTrigger && !alert.notificationSent) {
        await this.sendAlertNotification(alert);
      }
      
    } catch (error) {
      console.error(`Error checking alert ${alert.id}:`, error);
    }
  }
  
  /**
   * Get current price for an alert
   */
  async getCurrentPrice(alert) {
    try {
      let searchParams;
      
      switch (alert.type) {
        case 'flight':
          searchParams = {
            origin: alert.originCode || alert.origin,
            destination: alert.destinationCode || alert.destination,
            departureDate: alert.departureDate.toISOString().split('T')[0],
            returnDate: alert.returnDate ? alert.returnDate.toISOString().split('T')[0] : null,
            adults: alert.adults,
            children: alert.children,
            infants: alert.infants,
            cabinClass: alert.cabinClass
          };
          
          const flightResults = await this.priceService.searchFlights(searchParams);
          
          // Get the lowest price
          if (flightResults?.results?.length > 0) {
            const lowestPrice = Math.min(...flightResults.results.map(r => r.price));
            return lowestPrice;
          }
          break;
          
        case 'hotel':
          searchParams = {
            destination: alert.destination,
            checkIn: alert.departureDate.toISOString().split('T')[0],
            checkOut: alert.returnDate ? alert.returnDate.toISOString().split('T')[0] : null,
            guests: alert.adults + alert.children
          };
          
          const hotelResults = await this.priceService.searchHotels(searchParams);
          
          if (hotelResults?.results?.length > 0) {
            const lowestPrice = Math.min(...hotelResults.results.map(r => r.price));
            return lowestPrice;
          }
          break;
          
        default:
          console.log(`Price checking not implemented for type: ${alert.type}`);
          return null;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting current price:', error);
      return null;
    }
  }
  
  /**
   * Send alert notification
   */
  async sendAlertNotification(alert) {
    try {
      if (!alert.notifications.email || !alert.notifications.emailAddress) {
        console.log(`Email notifications disabled for alert ${alert.id}`);
        return;
      }
      
      await emailService.sendPriceAlert(
        alert,
        alert.triggeredPrice,
        alert.originalPrice
      );
      
      // Mark as sent
      alert.markNotificationSent();
      await this.alertRepo.update(alert.id, {
        notificationSent: alert.notificationSent,
        notificationSentAt: alert.notificationSentAt
      });
      
      console.log(`Alert notification sent for ${alert.id}`);
    } catch (error) {
      console.error('Error sending alert notification:', error);
    }
  }
  
  /**
   * Get price history for a route
   */
  async getPriceHistory(origin, destination, options = {}) {
    try {
      const { type = 'flight', days = 30 } = options;
      
      // This would typically query a price history database
      // For now, return mock data
      const history = [];
      const today = new Date();
      
      for (let i = days; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        // Generate realistic price variation
        const basePrice = 500;
        const variation = Math.sin(i * 0.5) * 100 + Math.random() * 50;
        
        history.push({
          date: date.toISOString().split('T')[0],
          price: Math.round(basePrice + variation),
          currency: 'USD'
        });
      }
      
      return history;
    } catch (error) {
      console.error('Error getting price history:', error);
      return [];
    }
  }
  
  /**
   * Predict future prices
   */
  async predictPrices(origin, destination, options = {}) {
    try {
      const { type = 'flight', days = 30 } = options;
      
      // Get historical data
      const history = await this.getPriceHistory(origin, destination, { type, days: 90 });
      
      if (history.length < 7) {
        return { prediction: 'insufficient_data', confidence: 0 };
      }
      
      // Simple moving average prediction
      const prices = history.map(h => h.price);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const currentPrice = prices[prices.length - 1];
      
      // Calculate trend
      const recentPrices = prices.slice(-7);
      const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
      const olderPrices = prices.slice(-14, -7);
      const olderAvg = olderPrices.reduce((a, b) => a + b, 0) / olderPrices.length;
      
      let prediction;
      let confidence;
      
      if (recentAvg < olderAvg * 0.95) {
        prediction = 'decrease';
        confidence = Math.min(0.9, (olderAvg - recentAvg) / olderAvg + 0.5);
      } else if (recentAvg > olderAvg * 1.05) {
        prediction = 'increase';
        confidence = Math.min(0.9, (recentAvg - olderAvg) / olderAvg + 0.5);
      } else {
        prediction = 'stable';
        confidence = 0.7;
      }
      
      return {
        prediction,
        confidence,
        currentPrice,
        averagePrice: Math.round(avgPrice),
        trend: recentAvg < olderAvg ? 'down' : recentAvg > olderAvg ? 'up' : 'stable',
        recommendation: this.getRecommendation(prediction, currentPrice, avgPrice)
      };
    } catch (error) {
      console.error('Error predicting prices:', error);
      return { prediction: 'error', confidence: 0 };
    }
  }
  
  /**
   * Get booking recommendation
   */
  getRecommendation(prediction, currentPrice, averagePrice) {
    if (prediction === 'decrease') {
      if (currentPrice < averagePrice * 0.85) {
        return 'buy_now';
      }
      return 'wait';
    }
    if (prediction === 'increase') {
      return 'buy_now';
    }
    if (currentPrice < averagePrice * 0.9) {
      return 'good_deal';
    }
    return 'fair_price';
  }
  
  /**
   * Get similar deals
   */
  async getSimilarDeals(origin, destination, options = {}) {
    try {
      const { type = 'flight', budget } = options;
      
      // Search for deals on similar routes
      // This would typically query the database for similar routes with good prices
      
      return {
        deals: [],
        message: 'Similar deals feature coming soon'
      };
    } catch (error) {
      console.error('Error getting similar deals:', error);
      return { deals: [] };
    }
  }
}

module.exports = PriceTrackingService;
