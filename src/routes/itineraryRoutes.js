/**
 * Itinerary Routes
 * CRUD operations for trip itineraries
 */

const express = require('express');
const { ItineraryRepository, ActivityType } = require('../models/Itinerary');

function createItineraryRoutes(database = null) {
  const router = express.Router();
  const repo = new ItineraryRepository(database);
  
  /**
   * Get all itineraries for user
   * GET /api/itineraries
   */
  router.get('/', async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const { status, limit = 50, offset = 0 } = req.query;
      
      const itineraries = await repo.findByUser(userId, {
        status,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.json({
        success: true,
        data: itineraries.map(i => i.getSummary()),
        meta: {
          total: itineraries.length
        }
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Create new itinerary
   * POST /api/itineraries
   */
  router.post('/', async (req, res, next) => {
    try {
      const userId = req.user?.id || req.body.userId;
      
      const itineraryData = {
        ...req.body,
        userId
      };
      
      const itinerary = await repo.create(itineraryData);
      
      res.status(201).json({
        success: true,
        data: itinerary.getSummary(),
        message: 'Itinerary created successfully'
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Get itinerary by ID
   * GET /api/itineraries/:id
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const itinerary = await repo.findById(id);
      
      if (!itinerary) {
        return res.status(404).json({ success: false, error: 'Itinerary not found' });
      }
      
      // Check access (owner or shared with)
      const isOwner = itinerary.userId === userId;
      const isShared = itinerary.sharedWith?.some(s => s.email === req.user?.email);
      const isPublic = itinerary.isPublic;
      
      if (!isOwner && !isShared && !isPublic) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      itinerary.recordView();
      await repo.update(id, { viewCount: itinerary.viewCount, lastViewedAt: itinerary.lastViewedAt });
      
      res.json({
        success: true,
        data: itinerary.toJSON(),
        access: isOwner ? 'owner' : isShared ? 'shared' : 'public'
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Update itinerary
   * PUT /api/itineraries/:id
   */
  router.put('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const updates = req.body;
      
      const itinerary = await repo.findById(id);
      
      if (!itinerary) {
        return res.status(404).json({ success: false, error: 'Itinerary not found' });
      }
      
      if (itinerary.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      // Don't allow changing critical fields
      delete updates.id;
      delete updates.userId;
      delete updates.createdAt;
      
      const updated = await repo.update(id, updates);
      
      res.json({
        success: true,
        data: updated.getSummary(),
        message: 'Itinerary updated successfully'
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Delete itinerary
   * DELETE /api/itineraries/:id
   */
  router.delete('/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const itinerary = await repo.findById(id);
      
      if (!itinerary) {
        return res.status(404).json({ success: false, error: 'Itinerary not found' });
      }
      
      if (itinerary.userId !== userId && !req.user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      await repo.delete(id);
      
      res.json({
        success: true,
        message: 'Itinerary deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Add activity to day
   * POST /api/itineraries/:id/days/:dayNumber/activities
   */
  router.post('/:id/days/:dayNumber/activities', async (req, res, next) => {
    try {
      const { id, dayNumber } = req.params;
      const userId = req.user?.id;
      const activityData = req.body;
      
      const itinerary = await repo.findById(id);
      
      if (!itinerary) {
        return res.status(404).json({ success: false, error: 'Itinerary not found' });
      }
      
      if (itinerary.userId !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      const activity = itinerary.addActivity(parseInt(dayNumber), activityData);
      await repo.update(id, { days: itinerary.days, budget: itinerary.budget });
      
      res.status(201).json({
        success: true,
        data: activity,
        message: 'Activity added successfully'
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Remove activity
   * DELETE /api/itineraries/:id/activities/:activityId
   */
  router.delete('/:id/activities/:activityId', async (req, res, next) => {
    try {
      const { id, activityId } = req.params;
      const { dayNumber } = req.query;
      const userId = req.user?.id;
      
      const itinerary = await repo.findById(id);
      
      if (!itinerary) {
        return res.status(404).json({ success: false, error: 'Itinerary not found' });
      }
      
      if (itinerary.userId !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      itinerary.removeActivity(parseInt(dayNumber), activityId);
      await repo.update(id, { days: itinerary.days, budget: itinerary.budget });
      
      res.json({
        success: true,
        message: 'Activity removed successfully'
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Reorder activities
   * PUT /api/itineraries/:id/days/:dayNumber/reorder
   */
  router.put('/:id/days/:dayNumber/reorder', async (req, res, next) => {
    try {
      const { id, dayNumber } = req.params;
      const userId = req.user?.id;
      const { activityIds } = req.body;
      
      const itinerary = await repo.findById(id);
      
      if (!itinerary) {
        return res.status(404).json({ success: false, error: 'Itinerary not found' });
      }
      
      if (itinerary.userId !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      itinerary.reorderActivities(parseInt(dayNumber), activityIds);
      await repo.update(id, { days: itinerary.days });
      
      res.json({
        success: true,
        message: 'Activities reordered successfully'
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Share itinerary
   * POST /api/itineraries/:id/share
   */
  router.post('/:id/share', async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { emails, password, isPublic } = req.body;
      
      const itinerary = await repo.findById(id);
      
      if (!itinerary) {
        return res.status(404).json({ success: false, error: 'Itinerary not found' });
      }
      
      if (itinerary.userId !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      // Generate share link
      const shareLink = itinerary.generateShareLink();
      
      // Add shared users
      if (emails && Array.isArray(emails)) {
        emails.forEach(email => {
          itinerary.sharedWith.push({
            email,
            permission: 'view',
            sharedAt: new Date()
          });
        });
      }
      
      if (password) {
        itinerary.sharePassword = password;
      }
      
      if (typeof isPublic === 'boolean') {
        itinerary.isPublic = isPublic;
      }
      
      await repo.update(id, {
        shareLink: itinerary.shareLink,
        isPublic: itinerary.isPublic,
        sharePassword: itinerary.sharePassword,
        sharedWith: itinerary.sharedWith
      });
      
      res.json({
        success: true,
        data: {
          shareLink,
          isPublic: itinerary.isPublic
        },
        message: 'Itinerary shared successfully'
      });
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Export itinerary as PDF
   * GET /api/itineraries/:id/pdf
   */
  router.get('/:id/pdf', async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const itinerary = await repo.findById(id);
      
      if (!itinerary) {
        return res.status(404).json({ success: false, error: 'Itinerary not found' });
      }
      
      if (itinerary.userId !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      // Generate PDF HTML
      const html = generateItineraryPDF(itinerary);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="itinerary-${itinerary.title.replace(/\s+/g, '-').toLowerCase()}.pdf"`);
      
      res.send(html);
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * Duplicate itinerary
   * POST /api/itineraries/:id/duplicate
   */
  router.post('/:id/duplicate', async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      const itinerary = await repo.findById(id);
      
      if (!itinerary) {
        return res.status(404).json({ success: false, error: 'Itinerary not found' });
      }
      
      if (itinerary.userId !== userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      // Create duplicate
      const duplicateData = {
        ...itinerary.toJSON(),
        id: undefined,
        title: `${itinerary.title} (Copy)`,
        status: 'draft',
        bookings: [],
        shareLink: null,
        isPublic: false,
        sharedWith: [],
        createdAt: undefined,
        updatedAt: undefined
      };
      
      const duplicate = await repo.create(duplicateData);
      
      res.status(201).json({
        success: true,
        data: duplicate.getSummary(),
        message: 'Itinerary duplicated successfully'
      });
    } catch (error) {
      next(error);
    }
  });
  
  return router;
}

/**
 * Generate itinerary PDF HTML
 */
function generateItineraryPDF(itinerary) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: itinerary.budget.currency
    }).format(amount);
  };
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${itinerary.title}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
        .header { text-align: center; border-bottom: 3px solid #667eea; padding-bottom: 20px; margin-bottom: 30px; }
        .title { font-size: 32px; color: #333; margin: 0; }
        .subtitle { font-size: 18px; color: #666; margin: 10px 0; }
        .date { font-size: 14px; color: #999; }
        .day { margin: 30px 0; page-break-inside: avoid; }
        .day-header { background: #667eea; color: white; padding: 15px; margin: -10px -10px 15px; }
        .day-title { font-size: 20px; margin: 0; }
        .day-date { font-size: 14px; opacity: 0.9; }
        .activity { border-left: 3px solid #667eea; padding: 15px; margin: 15px 0; background: #f9f9f9; }
        .activity-time { font-weight: bold; color: #667eea; font-size: 14px; }
        .activity-title { font-size: 16px; font-weight: bold; margin: 5px 0; }
        .activity-desc { color: #666; font-size: 14px; }
        .budget { margin-top: 40px; padding-top: 20px; border-top: 2px solid #667eea; }
        .budget-row { display: flex; justify-content: space-between; padding: 8px 0; }
        .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">${itinerary.title}</h1>
        <p class="subtitle">${itinerary.destination}</p>
        <p class="date">
          ${new Date(itinerary.startDate).toLocaleDateString()} - ${new Date(itinerary.endDate).toLocaleDateString()}
          (${itinerary.duration} days)
        </p>
      </div>
      
      ${itinerary.days.map(day => `
        <div class="day">
          <div class="day-header">
            <h2 class="day-title">Day ${day.dayNumber}: ${day.title || 'Untitled'}</h2>
            <p class="day-date">${new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          
          ${day.activities.length === 0 ? 
            '<p style="color: #999; font-style: italic;">No activities planned yet</p>' :
            day.activities.map(activity => `
              <div class="activity">
                <div class="activity-time">${activity.startTime || 'TBD'} - ${activity.endTime || 'TBD'}</div>
                <div class="activity-title">${activity.title}</div>
                ${activity.description ? `<div class="activity-desc">${activity.description}</div>` : ''}
                ${activity.location?.name ? `<div class="activity-desc">📍 ${activity.location.name}</div>` : ''}
                ${activity.booking?.price ? `<div class="activity-desc">💰 ${formatCurrency(activity.booking.price)}</div>` : ''}
              </div>
            `).join('')
          }
          
          ${day.notes ? `<p style="color: #666; font-style: italic; margin-top: 15px;">📝 ${day.notes}</p>` : ''}
        </div>
      `).join('')}
      
      <div class="budget">
        <h2>Budget Summary</h2>
        <div class="budget-row">
          <span>Total Budget:</span>
          <span>${formatCurrency(itinerary.budget.total || 0)}</span>
        </div>
        <div class="budget-row">
          <span>Spent:</span>
          <span>${formatCurrency(itinerary.budget.spent)}</span>
        </div>
        <div class="budget-row" style="font-weight: bold; border-top: 1px solid #ddd; margin-top: 10px; padding-top: 10px;">
          <span>Remaining:</span>
          <span>${formatCurrency((itinerary.budget.total || 0) - itinerary.budget.spent)}</span>
        </div>
      </div>
      
      <div class="footer">
        <p>Generated by Nexvoy - Your AI Travel Companion</p>
        <p>${new Date().toLocaleDateString()}</p>
      </div>
    </body>
    </html>
  `;
}

module.exports = createItineraryRoutes;
