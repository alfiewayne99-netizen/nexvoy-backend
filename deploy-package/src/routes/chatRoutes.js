/**
 * Chat Routes
 * WebSocket and HTTP routes for AI chat functionality
 */

const express = require('express');
const WebSocket = require('ws');

/**
 * Create chat routes
 */
function createChatRoutes(chatController) {
  const router = express.Router();

  // ============================================================================
  // HTTP Routes
  // ============================================================================
  
  /**
   * @route   POST /api/chat/message
   * @desc    Send a message and get AI response
   * @access  Public
   */
  router.post('/message', chatController.sendMessage.bind(chatController));

  /**
   * @route   GET /api/chat/history/:userId/:sessionId
   * @desc    Get conversation history
   * @access  Public
   */
  router.get('/history/:userId/:sessionId', chatController.getHistory.bind(chatController));

  /**
   * @route   DELETE /api/chat/history/:userId/:sessionId
   * @desc    Clear conversation history
   * @access  Public
   */
  router.delete('/history/:userId/:sessionId', chatController.clearHistory.bind(chatController));

  /**
   * @route   GET /api/chat/context/:userId/:sessionId
   * @desc    Get user context and preferences
   * @access  Public
   */
  router.get('/context/:userId/:sessionId', chatController.getContext.bind(chatController));

  /**
   * @route   PUT /api/chat/preferences/:userId/:sessionId
   * @desc    Update user preferences
   * @access  Public
   */
  router.put('/preferences/:userId/:sessionId', chatController.updatePreferences.bind(chatController));

  return router;
}

/**
 * Setup WebSocket server for chat
 */
function setupChatWebSocket(server, chatController) {
  const wss = new WebSocket.Server({ 
    server,
    path: '/api/chat/ws',
    verifyClient: (info, cb) => {
      // Allow all connections (in production, verify auth token here)
      cb(true);
    }
  });

  wss.on('connection', (ws, req) => {
    chatController.handleWebSocket(ws, req);
  });

  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  return wss;
}

module.exports = {
  createChatRoutes,
  setupChatWebSocket
};
