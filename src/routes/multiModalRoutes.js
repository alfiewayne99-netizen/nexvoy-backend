/**
 * Multi-Modal Chat Routes
 * API endpoints for voice, image, document, and screenshot processing
 */

const express = require('express');
const multer = require('multer');
const multiModalChatService = require('../services/multiModalChatService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Max 5 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Accept images, audio, PDFs, and common document types
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not supported`), false);
    }
  }
});

/**
 * @route   POST /api/multimodal/voice
 * @desc    Process voice input
 * @access  Private
 */
router.post('/voice', authenticate, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided'
      });
    }
    
    const result = await multiModalChatService.processVoiceInput(
      req.file.buffer,
      {
        duration: req.body.duration,
        language: req.body.language
      }
    );
    
    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: result.error
      });
    }
    
    // Save attachment metadata
    const attachment = await multiModalChatService.saveAttachment({
      messageId: req.body.messageId,
      userId: req.user.id,
      sessionId: req.body.sessionId,
      type: 'voice',
      filename: req.file.originalname,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      metadata: {
        voice: {
          duration: req.body.duration,
          transcript: result.text,
          language: result.language
        }
      }
    });
    
    res.json({
      success: true,
      data: {
        transcript: result.text,
        language: result.language,
        attachmentId: attachment._id
      }
    });
  } catch (error) {
    console.error('Voice processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/multimodal/image
 * @desc    Process image upload (for image search/analysis)
 * @access  Private
 */
router.post('/image', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }
    
    // Process image with AI
    const result = await multiModalChatService.processImage(
      req.file.buffer,
      {
        mimeType: req.file.mimetype,
        width: req.body.width,
        height: req.body.height
      }
    );
    
    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: result.error
      });
    }
    
    // Save attachment metadata
    const attachment = await multiModalChatService.saveAttachment({
      messageId: req.body.messageId,
      userId: req.user.id,
      sessionId: req.body.sessionId,
      type: 'image',
      filename: req.file.originalname,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      metadata: {
        image: {
          width: req.body.width,
          height: req.body.height,
          format: req.file.mimetype.split('/')[1],
          ...result.analysis
        }
      },
      aiAnalysis: {
        analyzedAt: new Date(),
        model: 'gpt-4o-vision',
        summary: result.analysis.description,
        suggestions: result.analysis.suggestions || []
      }
    });
    
    res.json({
      success: true,
      data: {
        analysis: result.analysis,
        attachmentId: attachment._id,
        suggestions: multiModalChatService.generateImageSuggestions(result.analysis)
      }
    });
  } catch (error) {
    console.error('Image processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/multimodal/screenshot
 * @desc    Process screenshot (for extracting travel website data)
 * @access  Private
 */
router.post('/screenshot', authenticate, upload.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No screenshot provided'
      });
    }
    
    // Process screenshot with AI
    const result = await multiModalChatService.processScreenshot(
      req.file.buffer,
      {
        mimeType: req.file.mimetype,
        width: req.body.width,
        height: req.body.height
      }
    );
    
    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: result.error
      });
    }
    
    // Save attachment metadata
    const attachment = await multiModalChatService.saveAttachment({
      messageId: req.body.messageId,
      userId: req.user.id,
      sessionId: req.body.sessionId,
      type: 'screenshot',
      filename: req.file.originalname,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      metadata: {
        image: {
          width: req.body.width,
          height: req.body.height
        }
      },
      aiAnalysis: {
        analyzedAt: new Date(),
        model: 'gpt-4o-vision',
        extractedEntities: result.analysis.extractedData,
        summary: result.analysis.description
      }
    });
    
    res.json({
      success: true,
      data: {
        analysis: result.analysis,
        attachmentId: attachment._id,
        extractedData: result.analysis.extractedData
      }
    });
  } catch (error) {
    console.error('Screenshot processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/multimodal/document
 * @desc    Process document upload
 * @access  Private
 */
router.post('/document', authenticate, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No document provided'
      });
    }
    
    // Process document with AI
    const result = await multiModalChatService.processDocument(
      req.file.buffer,
      {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      }
    );
    
    if (!result.success) {
      return res.status(422).json({
        success: false,
        error: result.error
      });
    }
    
    // Save attachment metadata
    const attachment = await multiModalChatService.saveAttachment({
      messageId: req.body.messageId,
      userId: req.user.id,
      sessionId: req.body.sessionId,
      type: 'document',
      filename: req.file.originalname,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      metadata: {
        document: {
          documentType: result.analysis.documentType,
          ...result.analysis.extractedInfo
        }
      },
      aiAnalysis: {
        analyzedAt: new Date(),
        model: 'gpt-4o',
        summary: result.analysis.description,
        suggestions: result.analysis.suggestions
      }
    });
    
    res.json({
      success: true,
      data: {
        analysis: result.analysis,
        attachmentId: attachment._id
      }
    });
  } catch (error) {
    console.error('Document processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/multimodal/chat
 * @desc    Send message with attachments
 * @access  Private
 */
router.post('/chat', authenticate, upload.array('attachments', 5), async (req, res) => {
  try {
    const { message, context, history } = req.body;
    const attachments = req.files || [];
    
    // Process any attachments
    const processedAttachments = [];
    for (const file of attachments) {
      let result;
      
      if (file.mimetype.startsWith('image/')) {
        // Determine if it's a screenshot or regular image
        const isScreenshot = req.body.isScreenshot === 'true' || 
                            file.originalname.toLowerCase().includes('screenshot');
        
        if (isScreenshot) {
          result = await multiModalChatService.processScreenshot(file.buffer, {
            mimeType: file.mimetype
          });
        } else {
          result = await multiModalChatService.processImage(file.buffer, {
            mimeType: file.mimetype
          });
        }
      } else if (file.mimetype.startsWith('audio/')) {
        result = await multiModalChatService.processVoiceInput(file.buffer);
      } else {
        result = await multiModalChatService.processDocument(file.buffer, {
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size
        });
      }
      
      if (result.success) {
        processedAttachments.push({
          type: file.mimetype.startsWith('image/') ? (req.body.isScreenshot ? 'screenshot' : 'image') :
                file.mimetype.startsWith('audio/') ? 'voice' : 'document',
          ...result
        });
      }
    }
    
    // Generate response
    const response = await multiModalChatService.generateMultimodalResponse(
      message,
      processedAttachments,
      context
    );
    
    res.json({
      success: true,
      data: {
        message: response.content,
        attachments: processedAttachments.map((att, i) => ({
          index: i,
          type: att.type,
          analysis: att.analysis
        })),
        metadata: response.metadata
      }
    });
  } catch (error) {
    console.error('Multimodal chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/multimodal/attachments
 * @desc    Get user's attachments
 * @access  Private
 */
router.get('/attachments', authenticate, async (req, res) => {
  try {
    const { type, limit = 50 } = req.query;
    
    const attachments = await multiModalChatService.getUserAttachments(
      req.user.id,
      { type, limit: parseInt(limit) }
    );
    
    res.json({
      success: true,
      data: attachments,
      meta: { count: attachments.length }
    });
  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/multimodal/attachments/:id
 * @desc    Get specific attachment
 * @access  Private
 */
router.get('/attachments/:id', authenticate, async (req, res) => {
  try {
    const attachment = await multiModalChatService.getAttachment(req.params.id);
    
    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found'
      });
    }
    
    // Check ownership
    if (attachment.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: attachment
    });
  } catch (error) {
    console.error('Get attachment error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/multimodal/attachments/:id
 * @desc    Delete attachment
 * @access  Private
 */
router.delete('/attachments/:id', authenticate, async (req, res) => {
  try {
    const result = await multiModalChatService.deleteAttachment(
      req.params.id,
      req.user.id
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/multimodal/search-images
 * @desc    Search images by description
 * @access  Private
 */
router.get('/search-images', authenticate, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }
    
    const images = await multiModalChatService.searchImages(query, req.user.id);
    
    res.json({
      success: true,
      data: images,
      meta: { count: images.length }
    });
  } catch (error) {
    console.error('Search images error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
