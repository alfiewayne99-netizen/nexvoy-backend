/**
 * Review Routes for Nexvoy
 * API endpoints for reviews and photos
 */

const express = require('express');
const { ReviewRepository } = require('../models/Review');

/**
 * Create review routes
 */
function createReviewRoutes(database = null) {
  const router = express.Router();
  const reviewRepo = new ReviewRepository(database);

  // ============================================================================
  // GET /api/reviews/target/:type/:id - Get reviews for a target
  // ============================================================================
  router.get('/target/:type/:id', async (req, res, next) => {
    try {
      const { type, id } = req.params;
      const { sort = 'newest', limit = 20, offset = 0, status = 'approved' } = req.query;
      
      const { reviews, total } = await reviewRepo.findByTarget(type, id, {
        status,
        sortBy: sort,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      // Get rating summary
      const summary = await reviewRepo.getRatingSummary(type, id);
      
      res.json({
        success: true,
        data: {
          reviews: reviews.map(r => r.toJSON()),
          summary,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: total > parseInt(offset) + reviews.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // GET /api/reviews/user/:userId - Get reviews by a user
  // ============================================================================
  router.get('/user/:userId', async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { limit = 20, offset = 0 } = req.query;
      
      const { reviews, total } = await reviewRepo.findByUser(userId, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.json({
        success: true,
        data: {
          reviews: reviews.map(r => r.toJSON()),
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: total > parseInt(offset) + reviews.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // GET /api/reviews/summary/:type/:id - Get rating summary
  // ============================================================================
  router.get('/summary/:type/:id', async (req, res, next) => {
    try {
      const { type, id } = req.params;
      const summary = await reviewRepo.getRatingSummary(type, id);
      
      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // POST /api/reviews - Create a new review
  // ============================================================================
  router.post('/', async (req, res, next) => {
    try {
      const reviewData = {
        ...req.body,
        userId: req.body.userId || req.user?.id // Use authenticated user if available
      };
      
      const review = await reviewRepo.create(reviewData);
      
      res.status(201).json({
        success: true,
        data: review.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // ============================================================================
  // GET /api/reviews/:id - Get a single review
  // ============================================================================
  router.get('/:id', async (req, res, next) => {
    try {
      const review = await reviewRepo.findById(req.params.id);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'Review not found'
        });
      }
      
      // Increment view count
      review.viewCount++;
      
      res.json({
        success: true,
        data: review.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // PUT /api/reviews/:id - Update a review
  // ============================================================================
  router.put('/:id', async (req, res, next) => {
    try {
      const review = await reviewRepo.update(req.params.id, req.body);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'Review not found'
        });
      }
      
      res.json({
        success: true,
        data: review.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // DELETE /api/reviews/:id - Delete a review
  // ============================================================================
  router.delete('/:id', async (req, res, next) => {
    try {
      await reviewRepo.delete(req.params.id);
      
      res.json({
        success: true,
        message: 'Review deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // POST /api/reviews/:id/helpful - Mark review as helpful
  // ============================================================================
  router.post('/:id/helpful', async (req, res, next) => {
    try {
      const { helpful = true } = req.body;
      const userId = req.body.userId || req.user?.id;
      
      const review = await reviewRepo.findById(req.params.id);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'Review not found'
        });
      }
      
      review.voteHelpful(userId, helpful);
      
      res.json({
        success: true,
        data: {
          helpfulCount: review.helpfulCount,
          unhelpfulCount: review.unhelpfulCount
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // POST /api/reviews/:id/photos - Add photo to review
  // ============================================================================
  router.post('/:id/photos', async (req, res, next) => {
    try {
      const review = await reviewRepo.findById(req.params.id);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'Review not found'
        });
      }
      
      const photo = review.addPhoto(req.body);
      
      res.status(201).json({
        success: true,
        data: photo
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // DELETE /api/reviews/:id/photos/:photoId - Remove photo from review
  // ============================================================================
  router.delete('/:id/photos/:photoId', async (req, res, next) => {
    try {
      const review = await reviewRepo.findById(req.params.id);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'Review not found'
        });
      }
      
      const removed = review.removePhoto(req.params.photoId);
      
      res.json({
        success: true,
        data: { removed }
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // POST /api/reviews/:id/verify - Verify a review
  // ============================================================================
  router.post('/:id/verify', async (req, res, next) => {
    try {
      const { bookingId } = req.body;
      
      const review = await reviewRepo.findById(req.params.id);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'Review not found'
        });
      }
      
      review.verify(bookingId);
      
      res.json({
        success: true,
        data: review.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // POST /api/reviews/:id/comments - Add comment to review
  // ============================================================================
  router.post('/:id/comments', async (req, res, next) => {
    try {
      const { content, isOwnerResponse = false } = req.body;
      const userId = req.body.userId || req.user?.id;
      
      const review = await reviewRepo.findById(req.params.id);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'Review not found'
        });
      }
      
      const comment = review.addComment(userId, content, isOwnerResponse);
      
      res.status(201).json({
        success: true,
        data: comment
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // POST /api/reviews/:id/approve - Approve a review (moderator)
  // ============================================================================
  router.post('/:id/approve', async (req, res, next) => {
    try {
      const { notes } = req.body;
      
      const review = await reviewRepo.approve(req.params.id, notes);
      
      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'Review not found'
        });
      }
      
      res.json({
        success: true,
        data: review.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createReviewRoutes;
