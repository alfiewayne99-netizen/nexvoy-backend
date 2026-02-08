/**
 * Alert Service
 * Handles price alert creation, management, and notifications
 */

const { PriceAlertRepository, AlertStatus } = require('../models/PriceAlert');

class AlertService {
  constructor(database = null) {
    this.alertRepo = new PriceAlertRepository(database);
    this.activeAlerts = new Map();
  }

  /**
   * Create a new price alert
   * @param {Object} alertData - Alert configuration
   * @returns {Promise<Object>} Created alert
   */
  async createAlert(alertData) {
    const alert = await this.alertRepo.create(alertData);
    this.activeAlerts.set(alert.id, alert);
    return alert;
  }

  /**
   * Get alert by ID
   * @param {string} alertId - Alert ID
   * @returns {Promise<Object>} Alert object
   */
  async getAlert(alertId) {
    return this.alertRepo.findById(alertId);
  }

  /**
   * Get all alerts for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User's alerts
   */
  async getUserAlerts(userId) {
    return this.alertRepo.findByUser(userId);
  }

  /**
   * Get all active alerts
   * @returns {Promise<Array>} Active alerts
   */
  async getActiveAlerts() {
    return this.alertRepo.findActiveAlerts();
  }

  /**
   * Update an alert
   * @param {string} alertId - Alert ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated alert
   */
  async updateAlert(alertId, updates) {
    return this.alertRepo.update(alertId, updates);
  }

  /**
   * Delete an alert
   * @param {string} alertId - Alert ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteAlert(alertId) {
    this.activeAlerts.delete(alertId);
    await this.alertRepo.delete(alertId);
    return true;
  }

  /**
   * Pause an alert
   * @param {string} alertId - Alert ID
   * @returns {Promise<Object>} Updated alert
   */
  async pauseAlert(alertId) {
    const alert = await this.alertRepo.findById(alertId);
    if (alert) {
      alert.pause();
      return this.alertRepo.update(alertId, {
        status: alert.status,
        updatedAt: alert.updatedAt
      });
    }
    return null;
  }

  /**
   * Resume an alert
   * @param {string} alertId - Alert ID
   * @returns {Promise<Object>} Updated alert
   */
  async resumeAlert(alertId) {
    const alert = await this.alertRepo.findById(alertId);
    if (alert) {
      alert.resume();
      return this.alertRepo.update(alertId, {
        status: alert.status,
        updatedAt: alert.updatedAt
      });
    }
    return null;
  }

  /**
   * Check if price meets alert criteria
   * @param {Object} alert - Alert object
   * @param {number} currentPrice - Current price
   * @returns {boolean} Whether alert should trigger
   */
  checkPrice(alert, currentPrice) {
    return alert.checkPrice(currentPrice);
  }

  /**
   * Get alert statistics
   * @param {string} userId - User ID (optional)
   * @returns {Promise<Object>} Statistics
   */
  async getStats(userId) {
    return this.alertRepo.getStats(userId);
  }
}

module.exports = AlertService;
