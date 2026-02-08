/**
 * Forum Routes for Nexvoy
 * API endpoints for community forums
 */

const express = require('express');
const { ForumRepository } = require('../models/Forum');

/**
 * Create forum routes
 */
function createForumRoutes(database = null) {
  const router = express.Router();
  const forumRepo = new ForumRepository(database);

  // ============================================================================
  // Forum Routes
  // ============================================================================

  // GET /api/forums - List all forums
  router.get('/', async (req, res, next) => {
    try {
      const { category, type, featured, limit = 20, offset = 0 } = req.query;
      
      const { forums, total } = await forumRepo.findForums({
        category,
        type,
        featured: featured === 'true',
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.json({
        success: true,
        data: {
          forums: forums.map(f => f.toJSON()),
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: total > parseInt(offset) + forums.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/forums/destinations - List destination forums
  router.get('/destinations', async (req, res, next) => {
    try {
      const { country, city } = req.query;
      
      const forums = await forumRepo.findForumsByDestination(country, city);
      
      res.json({
        success: true,
        data: forums.map(f => f.toJSON())
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/forums - Create a new forum
  router.post('/', async (req, res, next) => {
    try {
      const forum = await forumRepo.createForum(req.body);
      
      res.status(201).json({
        success: true,
        data: forum.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // GET /api/forums/:id - Get forum by ID
  router.get('/:id', async (req, res, next) => {
    try {
      const forum = await forumRepo.findForumById(req.params.id);
      
      if (!forum) {
        return res.status(404).json({
          success: false,
          error: 'Forum not found'
        });
      }
      
      res.json({
        success: true,
        data: forum.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/forums/slug/:slug - Get forum by slug
  router.get('/slug/:slug', async (req, res, next) => {
    try {
      const forum = await forumRepo.findForumBySlug(req.params.slug);
      
      if (!forum) {
        return res.status(404).json({
          success: false,
          error: 'Forum not found'
        });
      }
      
      res.json({
        success: true,
        data: forum.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // Topic Routes
  // ============================================================================

  // GET /api/forums/:forumId/topics - List topics in forum
  router.get('/:forumId/topics', async (req, res, next) => {
    try {
      const { sort = 'newest', limit = 20, offset = 0 } = req.query;
      
      const { topics, total } = await forumRepo.findTopicsByForum(req.params.forumId, {
        sortBy: sort,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.json({
        success: true,
        data: {
          topics: topics.map(t => t.toJSON()),
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: total > parseInt(offset) + topics.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/forums/:forumId/topics - Create new topic
  router.post('/:forumId/topics', async (req, res, next) => {
    try {
      const topicData = {
        ...req.body,
        forumId: req.params.forumId
      };
      
      const topic = await forumRepo.createTopic(topicData);
      
      res.status(201).json({
        success: true,
        data: topic.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // GET /api/forums/topics/search - Search topics
  router.get('/topics/search', async (req, res, next) => {
    try {
      const { q, limit = 20, offset = 0 } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          error: 'Search query required'
        });
      }
      
      const { topics, total } = await forumRepo.searchTopics(q, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.json({
        success: true,
        data: {
          topics: topics.map(t => t.toJSON()),
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: total > parseInt(offset) + topics.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/forums/topics/:id - Get topic details
  router.get('/topics/:id', async (req, res, next) => {
    try {
      const topic = await forumRepo.findTopicById(req.params.id);
      
      if (!topic) {
        return res.status(404).json({
          success: false,
          error: 'Topic not found'
        });
      }
      
      // Increment view count
      topic.view();
      
      res.json({
        success: true,
        data: topic.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/forums/topics/:id - Update topic
  router.put('/topics/:id', async (req, res, next) => {
    try {
      const topic = await forumRepo.findTopicById(req.params.id);
      
      if (!topic) {
        return res.status(404).json({
          success: false,
          error: 'Topic not found'
        });
      }
      
      // Update fields
      Object.keys(req.body).forEach(key => {
        if (key !== 'id' && key !== 'forumId' && key !== 'createdAt') {
          topic[key] = req.body[key];
        }
      });
      
      topic.updatedAt = new Date();
      
      res.json({
        success: true,
        data: topic.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/forums/topics/:id/vote - Vote on topic
  router.post('/topics/:id/vote', async (req, res, next) => {
    try {
      const { value } = req.body; // 1 or -1
      const userId = req.body.userId || req.user?.id;
      
      const topic = await forumRepo.findTopicById(req.params.id);
      
      if (!topic) {
        return res.status(404).json({
          success: false,
          error: 'Topic not found'
        });
      }
      
      topic.vote(userId, value);
      
      res.json({
        success: true,
        data: {
          voteCount: topic.voteCount
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/forums/topics/:id/solution - Mark solution
  router.post('/topics/:id/solution', async (req, res, next) => {
    try {
      const { replyId } = req.body;
      
      const topic = await forumRepo.findTopicById(req.params.id);
      
      if (!topic) {
        return res.status(404).json({
          success: false,
          error: 'Topic not found'
        });
      }
      
      topic.markSolution(replyId);
      
      res.json({
        success: true,
        data: topic.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // Reply Routes
  // ============================================================================

  // GET /api/forums/topics/:topicId/replies - Get replies for topic
  router.get('/topics/:topicId/replies', async (req, res, next) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      const { replies, total } = await forumRepo.findRepliesByTopic(req.params.topicId, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.json({
        success: true,
        data: {
          replies: replies.map(r => r.toJSON()),
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: total > parseInt(offset) + replies.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/forums/topics/:topicId/replies - Create reply
  router.post('/topics/:topicId/replies', async (req, res, next) => {
    try {
      const replyData = {
        ...req.body,
        topicId: req.params.topicId
      };
      
      const reply = await forumRepo.createReply(replyData);
      
      res.status(201).json({
        success: true,
        data: reply.toJSON()
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });

  // POST /api/forums/replies/:id/like - Like/unlike reply
  router.post('/replies/:id/like', async (req, res, next) => {
    try {
      const userId = req.body.userId || req.user?.id;
      
      const reply = await forumRepo.replies.get(req.params.id);
      
      if (!reply) {
        return res.status(404).json({
          success: false,
          error: 'Reply not found'
        });
      }
      
      reply.like(userId);
      
      res.json({
        success: true,
        data: {
          likeCount: reply.likeCount
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/forums/replies/:id/vote - Vote on reply
  router.post('/replies/:id/vote', async (req, res, next) => {
    try {
      const { value } = req.body;
      const userId = req.body.userId || req.user?.id;
      
      const reply = await forumRepo.replies.get(req.params.id);
      
      if (!reply) {
        return res.status(404).json({
          success: false,
          error: 'Reply not found'
        });
      }
      
      reply.vote(userId, value);
      
      res.json({
        success: true,
        data: {
          voteCount: reply.voteCount
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/forums/replies/:id - Edit reply
  router.put('/replies/:id', async (req, res, next) => {
    try {
      const { content } = req.body;
      
      const reply = await forumRepo.replies.get(req.params.id);
      
      if (!reply) {
        return res.status(404).json({
          success: false,
          error: 'Reply not found'
        });
      }
      
      reply.edit(content);
      
      res.json({
        success: true,
        data: reply.toJSON()
      });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/forums/replies/:id - Delete reply
  router.delete('/replies/:id', async (req, res, next) => {
    try {
      const deletedBy = req.body.userId || req.user?.id;
      
      const reply = await forumRepo.replies.get(req.params.id);
      
      if (!reply) {
        return res.status(404).json({
          success: false,
          error: 'Reply not found'
        });
      }
      
      reply.delete(deletedBy);
      
      res.json({
        success: true,
        message: 'Reply deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  });

  // ============================================================================
  // User Stats
  // ============================================================================

  // GET /api/forums/users/:userId/stats - Get user forum stats
  router.get('/users/:userId/stats', async (req, res, next) => {
    try {
      const stats = await forumRepo.getUserStats(req.params.userId);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createForumRoutes;
