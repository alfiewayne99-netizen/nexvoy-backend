/**
 * Alert Controller
 * Handles price alert management endpoints
 */

const { PriceAlertRepository, AlertStatus } = require('../models/PriceAlert');
const PriceTrackingService = require('../services/priceTrackingService');

/**
 * Create alert controller with injected services
 */
function createAlertController(alertService, database = null) {
  const alertRepo = new PriceAlertRepository(database);
  const priceTracking = new PriceTrackingService(alertService, database);
  
  /**
   * Create a new price alert
   * POST /api/alerts
   */
  const createAlert = async (req, res, next) => {
    try {
      const userId = req.user?.id || req.body.userId;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      
      const alertData = {
        ...req.body,
        userId
      };
      
      const alert = await alertRepo.create(alertData);
      
      res.status(201).json({
        success: true,
        data: alert.getSummary(),
        message: 'Price alert created successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user's alerts
   * GET /api/alerts
   */
  const getUserAlerts = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      
      const { status, type, limit = 50, offset = 0 } = req.query;
      
      const alerts = await alertRepo.findByUser(userId, {
        status,
        type,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      const stats = await alertRepo.getStats(userId);
      
      res.json({
        success: true,
        data: alerts.map(a => ({
          ...a.getSummary(),
          priceHistory: a.priceHistory.slice(-10), // Last 10 price points
          trend: a.getPriceTrend(),
          lowestPrice: a.getLowestPrice(),
          highestPrice: a.getHighestPrice()
        })),
        meta: stats
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a specific alert
   * GET /api/alerts/:id
   */
  const getAlert = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const alert = await alertRepo.findById(id);
      
      if (!alert) {
        return res.status(404).json({ success: false, error: 'Alert not found' });
      }
      
      if (alert.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      res.json({
        success: true,
        data: {
          ...alert.toJSON(),
          trend: alert.getPriceTrend(),
          lowestPrice: alert.getLowestPrice(),
          highestPrice: alert.getHighestPrice(),
          averagePrice: alert.getAveragePrice(),
          priceChange: alert.getPriceChangePercentage()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update an alert
   * PUT /api/alerts/:id
   */
  const updateAlert = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const updates = req.body;
      
      const alert = await alertRepo.findById(id);
      
      if (!alert) {
        return res.status(404).json({ success: false, error: 'Alert not found' });
      }
      
      if (alert.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      // Don't allow changing critical fields
      delete updates.id;
      delete updates.userId;
      delete updates.createdAt;
      delete updates.priceHistory;
      
      const updated = await alertRepo.update(id, updates);
      
      res.json({
        success: true,
        data: updated.getSummary(),
        message: 'Alert updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete an alert
   * DELETE /api/alerts/:id
   */
  const deleteAlert = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const alert = await alertRepo.findById(id);
      
      if (!alert) {
        return res.status(404).json({ success: false, error: 'Alert not found' });
      }
      
      if (alert.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      await alertRepo.delete(id);
      
      res.json({
        success: true,
        message: 'Alert deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Pause an alert
   * POST /api/alerts/:id/pause
   */
  const pauseAlert = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const alert = await alertRepo.findById(id);
      
      if (!alert) {
        return res.status(404).json({ success: false, error: 'Alert not found' });
      }
      
      if (alert.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      alert.pause();
      const updated = await alertRepo.update(id, {
        status: alert.status,
        updatedAt: alert.updatedAt
      });
      
      res.json({
        success: true,
        data: updated.getSummary(),
        message: 'Alert paused successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Resume an alert
   * POST /api/alerts/:id/resume
   */
  const resumeAlert = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const alert = await alertRepo.findById(id);
      
      if (!alert) {
        return res.status(404).json({ success: false, error: 'Alert not found' });
      }
      
      if (alert.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      alert.resume();
      const updated = await alertRepo.update(id, {
        status: alert.status,
        updatedAt: alert.updatedAt
      });
      
      res.json({
        success: true,
        data: updated.getSummary(),
        message: 'Alert resumed successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get alert statistics
   * GET /api/alerts/stats
   */
  const getStatistics = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      
      const stats = await alertRepo.getStats(userId);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get price history for a route
   * GET /api/alerts/history
   */
  const getPriceHistory = async (req, res, next) => {
    try {
      const { origin, destination, type = 'flight', days = 30 } = req.query;
      
      if (!origin || !destination) {
        return res.status(400).json({ 
          success: false, 
          error: 'Origin and destination are required' 
        });
      }
      
      const history = await priceTracking.getPriceHistory(origin, destination, {
        type,
        days: parseInt(days)
      });
      
      res.json({
        success: true,
        data: {
          origin,
          destination,
          type,
          history
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get price prediction
   * GET /api/alerts/predict
   */
  const getPricePrediction = async (req, res, next) => {
    try {
      const { origin, destination, type = 'flight' } = req.query;
      
      if (!origin || !destination) {
        return res.status(400).json({ 
          success: false, 
          error: 'Origin and destination are required' 
        });
      }
      
      const prediction = await priceTracking.predictPrices(origin, destination, {
        type
      });
      
      res.json({
        success: true,
        data: {
          origin,
          destination,
          type,
          prediction
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Manually check an alert
   * POST /api/alerts/:id/check
   */
  const checkAlert = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const alert = await alertRepo.findById(id);
      
      if (!alert) {
        return res.status(404).json({ success: false, error: 'Alert not found' });
      }
      
      if (alert.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      // Check price immediately
      await priceTracking.checkAlert(alert);
      
      // Get updated alert
      const updated = await alertRepo.findById(id);
      
      res.json({
        success: true,
        data: {
          alert: updated.getSummary(),
          currentPrice: updated.currentPrice,
          triggered: updated.status === AlertStatus.TRIGGERED
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Export alerts
   * GET /api/alerts/export
   */
  const exportAlerts = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      
      const alerts = await alertRepo.findByUser(userId);
      
      const exportData = {
        exportedAt: new Date().toISOString(),
        userId,
        alerts: alerts.map(a => a.toJSON())
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="nexvoy-alerts-${Date.now()}.json"`);
      
      res.json(exportData);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Import alerts
   * POST /api/alerts/import
   */
  const importAlerts = async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      
      const { alerts } = req.body;
      
      if (!alerts || !Array.isArray(alerts)) {
        return res.status(400).json({ success: false, error: 'Invalid alerts data' });
      }
      
      const results = {
        imported: 0,
        failed: 0,
        errors: []
      };
      
      for (const alertData of alerts) {
        try {
          await alertRepo.create({
            ...alertData,
            userId,
            id: undefined, // Generate new ID
            createdAt: undefined,
            status: AlertStatus.ACTIVE
          });
          results.imported++;
        } catch (error) {
          results.failed++;
          results.errors.push({ alert: alertData.origin + '-' + alertData.destination, error: error.message });
        }
      }
      
      res.json({
        success: true,
        data: results,
        message: `Imported ${results.imported} alerts, ${results.failed} failed`
      });
    } catch (error) {
      next(error);
    }
  };

  return {
    createAlert,
    getUserAlerts,
    getAlert,
    updateAlert,
    deleteAlert,
    pauseAlert,
    resumeAlert,
    getStatistics,
    getPriceHistory,
    getPricePrediction,
    checkAlert,
    exportAlerts,
    importAlerts
  };
}

module.exports = { createAlertController };
