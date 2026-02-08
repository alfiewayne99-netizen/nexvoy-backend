/**
 * Chat Controller
 * Handles WebSocket and HTTP chat endpoints
 */

const { getLogger } = require('../utils/logger');
const NexAIChatService = require('../services/chatService');

class ChatController {
  constructor(nexvoyEngine) {
    this.chatService = new NexAIChatService(nexvoyEngine);
    this.logger = getLogger();
    this.connections = new Map(); // WebSocket connections
    
    // Setup chat service event handlers
    this.setupEventHandlers();
    
    // Start periodic cleanup
    setInterval(() => this.chatService.cleanup(), 5 * 60 * 1000); // Every 5 minutes
  }

  setupEventHandlers() {
    // Forward typing indicators to connected clients
    this.chatService.on('typing', ({ userId, sessionId, isTyping }) => {
      const connection = this.findConnection(userId, sessionId);
      if (connection && connection.ws.readyState === 1) { // WebSocket.OPEN
        connection.ws.send(JSON.stringify({
          type: 'typing',
          data: { isTyping, timestamp: Date.now() }
        }));
      }
    });

    // Forward messages to connected clients
    this.chatService.on('message', ({ userId, sessionId, message }) => {
      const connection = this.findConnection(userId, sessionId);
      if (connection && connection.ws.readyState === 1) {
        connection.ws.send(JSON.stringify({
          type: 'message',
          data: message
        }));
      }
    });
  }

  findConnection(userId, sessionId) {
    const key = `${userId}:${sessionId}`;
    return this.connections.get(key);
  }

  /**
   * Handle WebSocket connection upgrade
   */
  handleWebSocket(ws, req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId') || 'anonymous';
    const sessionId = url.searchParams.get('sessionId') || this.generateSessionId();
    
    const key = `${userId}:${sessionId}`;
    
    this.logger.info('WebSocket connection established', { userId, sessionId });
    
    // Store connection
    this.connections.set(key, {
      ws,
      userId,
      sessionId,
      connectedAt: Date.now()
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      data: {
        sessionId,
        userId,
        timestamp: Date.now()
      }
    }));

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        await this.handleWebSocketMessage(ws, userId, sessionId, message);
      } catch (error) {
        this.logger.error('WebSocket message error', { error: error.message });
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' }
        }));
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      this.logger.info('WebSocket connection closed', { userId, sessionId });
      this.connections.delete(key);
    });

    // Handle errors
    ws.on('error', (error) => {
      this.logger.error('WebSocket error', { error: error.message, userId, sessionId });
    });
  }

  /**
   * Handle WebSocket messages
   */
  async handleWebSocketMessage(ws, userId, sessionId, message) {
    switch (message.type) {
      case 'chat':
        // Process chat message
        await this.chatService.processMessage(
          userId,
          sessionId,
          message.content,
          message.metadata || {}
        );
        break;

      case 'typing':
        // Echo typing status (could be used for "user is typing" indicators)
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      case 'clear_history':
        this.chatService.clearConversation(userId, sessionId);
        ws.send(JSON.stringify({
          type: 'history_cleared',
          timestamp: Date.now()
        }));
        break;

      case 'get_history':
        const history = this.chatService.getConversationHistory(userId, sessionId);
        ws.send(JSON.stringify({
          type: 'history',
          data: history
        }));
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: `Unknown message type: ${message.type}` }
        }));
    }
  }

  /**
   * HTTP: Send message and get response
   */
  async sendMessage(req, res, next) {
    try {
      const { userId = 'anonymous', sessionId = this.generateSessionId() } = req.body;
      const { message, metadata = {} } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Message is required',
          code: 'MISSING_MESSAGE'
        });
      }

      const response = await this.chatService.processMessage(
        userId,
        sessionId,
        message,
        metadata
      );

      res.json({
        success: true,
        data: {
          message: response,
          sessionId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * HTTP: Get conversation history
   */
  async getHistory(req, res, next) {
    try {
      const { userId, sessionId } = req.params;
      
      if (!userId || !sessionId) {
        return res.status(400).json({
          success: false,
          error: 'User ID and Session ID are required',
          code: 'MISSING_PARAMS'
        });
      }

      const history = this.chatService.getConversationHistory(userId, sessionId);

      res.json({
        success: true,
        data: {
          messages: history,
          userId,
          sessionId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * HTTP: Clear conversation history
   */
  async clearHistory(req, res, next) {
    try {
      const { userId, sessionId } = req.params;
      
      this.chatService.clearConversation(userId, sessionId);

      res.json({
        success: true,
        data: {
          message: 'Conversation history cleared',
          userId,
          sessionId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * HTTP: Get user context/preferences
   */
  async getContext(req, res, next) {
    try {
      const { userId, sessionId } = req.params;
      
      const context = this.chatService.getUserContext(userId, sessionId);

      res.json({
        success: true,
        data: {
          context,
          userId,
          sessionId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * HTTP: Update user preferences
   */
  async updatePreferences(req, res, next) {
    try {
      const { userId, sessionId } = req.params;
      const { preferences } = req.body;

      if (!preferences || typeof preferences !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Preferences object is required',
          code: 'MISSING_PREFERENCES'
        });
      }

      this.chatService.updateUserPreferences(userId, sessionId, preferences);

      res.json({
        success: true,
        data: {
          message: 'Preferences updated',
          preferences
        }
      });
    } catch (error) {
      next(error);
    }
  }

  generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = ChatController;
