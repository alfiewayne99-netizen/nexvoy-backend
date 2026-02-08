/**
 * Travel Companion Routes for Nexvoy
 * API endpoints for travel companion matching and group trips
 */

const express = require('express');
const { TravelCompanionRepository } = require('../models/TravelCompanion');

/**
 * Create travel companion routes
 */
function createTravelCompanionRoutes(database = null) {
  const router = express.Router();
  const companionRepo = new TravelCompanionRepository(database);

  // ============================================================================
  // Profile Routes
  // ============================================================================

  // GET /api/companions/profile/:userId - Get traveler profile
  router.get('/profile/:userId', async (req, res, next) => {
    try {
      const profile = await companionRepo.findProfile(req.params.userId);
      
      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found'
        });
      }
      
      res.json({
        success: true,
        data: profile.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/companions/profile - Create or update profile
  router.post('/profile', async (req, res, next) => {
    try {
      const profile = await companionRepo.createProfile(req.body);
      
      res.status(201).json({
        success: true,
        data: profile.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // PUT /api/companions/profile/:userId - Update profile
  router.put('/profile/:userId', async (req, res, next) => {
    try {
      const profile = await companionRepo.findProfile(req.params.userId);
      
      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Profile not found'
        });
      }
      
      // Update fields
      Object.keys(req.body).forEach(key => {
        if (key !== 'userId' && key !== 'createdAt') {
          profile[key] = req.body[key];
        }
      });
      
      profile.updatedAt = new Date();
      
      res.json({
        success: true,
        data: profile.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/companions/matches/:userId - Find compatible travel companions
  router.get('/matches/:userId', async (req, res, next) => {
    try {
      const { destination, limit = 10 } = req.query;
      
      const matches = await companionRepo.findMatches(req.params.userId, {
        destination,
        limit: parseInt(limit)
      });
      
      res.json({
        success: true,
        data: matches
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // Trip Post Routes
  // ============================================================================

  // GET /api/companions/trips - List trip postings
  router.get('/trips', async (req, res, next) => {
    try {
      const { 
        destination, 
        type, 
        status = 'open', 
        limit = 20, 
        offset = 0 
      } = req.query;
      
      const { posts, total } = await companionRepo.findTripPosts({
        destination,
        type,
        status,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.json({
        success: true,
        data: {
          trips: posts.map(p => p.toJSON()),
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: total > parseInt(offset) + posts.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/companions/trips - Create trip posting
  router.post('/trips', async (req, res, next) => {
    try {
      const post = await companionRepo.createTripPost(req.body);
      
      res.status(201).json({
        success: true,
        data: post.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // GET /api/companions/trips/:id - Get trip details
  router.get('/trips/:id', async (req, res, next) => {
    try {
      const trip = await companionRepo.findTripById(req.params.id);
      
      if (!trip) {
        return res.status(404).json({
          success: false,
          error: 'Trip not found'
        });
      }
      
      res.json({
        success: true,
        data: trip.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/companions/trips/:id/apply - Apply to join a trip
  router.post('/trips/:id/apply', async (req, res, next) => {
    try {
      const { userId, message } = req.body;
      const trip = await companionRepo.findTripById(req.params.id);
      
      if (!trip) {
        return res.status(404).json({
          success: false,
          error: 'Trip not found'
        });
      }
      
      trip.apply(userId, message);
      
      res.json({
        success: true,
        data: trip.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // POST /api/companions/trips/:id/accept - Accept an application
  router.post('/trips/:id/accept', async (req, res, next) => {
    try {
      const { userId } = req.body;
      const trip = await companionRepo.findTripById(req.params.id);
      
      if (!trip) {
        return res.status(404).json({
          success: false,
          error: 'Trip not found'
        });
      }
      
      trip.acceptApplication(userId);
      
      res.json({
        success: true,
        data: trip.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // POST /api/companions/trips/:id/decline - Decline an application
  router.post('/trips/:id/decline', async (req, res, next) => {
    try {
      const { userId } = req.body;
      const trip = await companionRepo.findTripById(req.params.id);
      
      if (!trip) {
        return res.status(404).json({
          success: false,
          error: 'Trip not found'
        });
      }
      
      trip.declineApplication(userId);
      
      res.json({
        success: true,
        data: trip.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // ============================================================================
  // Expense Routes
  // ============================================================================

  // GET /api/companions/trips/:id/expenses - Get expenses for a trip
  router.get('/trips/:id/expenses', async (req, res, next) => {
    try {
      const expenses = await companionRepo.findExpensesByTrip(req.params.id);
      const balance = await companionRepo.getTripBalance(req.params.id);
      
      res.json({
        success: true,
        data: {
          expenses: expenses.map(e => e.toJSON()),
          balance
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/companions/expenses - Create expense
  router.post('/expenses', async (req, res, next) => {
    try {
      const expense = await companionRepo.createExpense(req.body);
      
      res.status(201).json({
        success: true,
        data: expense.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // POST /api/companions/expenses/:id/settle - Settle expense split
  router.post('/expenses/:id/settle', async (req, res, next) => {
    try {
      const { userId } = req.body;
      const expense = companionRepo.expenses.get(req.params.id);
      
      if (!expense) {
        return res.status(404).json({
          success: false,
          error: 'Expense not found'
        });
      }
      
      expense.settle(userId);
      
      res.json({
        success: true,
        data: expense.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/companions/expenses/:id/splits - Calculate fair splits
  router.get('/expenses/:id/splits', async (req, res, next) => {
    try {
      const { userIds } = req.query;
      const expense = companionRepo.expenses.get(req.params.id);
      
      if (!expense) {
        return res.status(404).json({
          success: false,
          error: 'Expense not found'
        });
      }
      
      const ids = userIds.split(',');
      expense.calculateEqualSplits(ids);
      
      res.json({
        success: true,
        data: expense.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createTravelCompanionRoutes;
