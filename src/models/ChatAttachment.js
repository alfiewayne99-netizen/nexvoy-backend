const mongoose = require('mongoose');

/**
 * ChatAttachment Schema
 * Stores metadata for uploaded files in chat
 */
const chatAttachmentSchema = new mongoose.Schema({
  // Reference
  messageId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true
  },
  
  // File metadata
  type: {
    type: String,
    required: true,
    enum: ['image', 'document', 'screenshot', 'voice', 'video']
  },
  
  // Storage
  storage: {
    provider: { type: String, enum: ['s3', 'gcs', 'azure', 'local'], default: 's3' },
    bucket: String,
    key: String,
    url: String,
    thumbnailUrl: String
  },
  
  // File details
  filename: String,
  originalName: String,
  mimeType: String,
  size: Number, // bytes
  
  // Type-specific metadata
  metadata: {
    // For images/screenshots
    image: {
      width: Number,
      height: Number,
      format: String,
      dominantColors: [String],
      hasText: { type: Boolean, default: false },
      extractedText: String,
      detectedObjects: [{
        label: String,
        confidence: Number,
        boundingBox: {
          x: Number,
          y: Number,
          width: Number,
          height: Number
        }
      }]
    },
    
    // For documents
    document: {
      pageCount: Number,
      textContent: String,
      extractedData: mongoose.Schema.Types.Mixed,
      documentType: { type: String, enum: ['passport', 'visa', 'ticket', 'itinerary', 
                                            'receipt', 'boarding_pass', 'hotel_voucher', 
                                            'insurance', 'other'] }
    },
    
    // For voice
    voice: {
      duration: Number, // seconds
      transcript: String,
      language: String,
      confidence: Number
    },
    
    // For video
    video: {
      duration: Number,
      width: Number,
      height: Number,
      thumbnailAt: Number // timestamp for thumbnail
    }
  },
  
  // AI analysis results
  aiAnalysis: {
    analyzedAt: Date,
    model: String,
    intent: String,
    extractedEntities: mongoose.Schema.Types.Mixed,
    summary: String,
    suggestions: [String]
  },
  
  // Processing status
  processingStatus: {
    type: String,
    enum: ['pending', 'uploading', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingError: String,
  
  // Timestamps
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  
  // Expiration (auto-delete after 30 days)
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }
}, {
  timestamps: true
});

// Indexes
chatAttachmentSchema.index({ messageId: 1 });
chatAttachmentSchema.index({ userId: 1, uploadedAt: -1 });
chatAttachmentSchema.index({ sessionId: 1 });
chatAttachmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Mark as processed
chatAttachmentSchema.methods.markProcessed = function(analysis) {
  this.processingStatus = 'completed';
  this.processedAt = new Date();
  if (analysis) {
    this.aiAnalysis = {
      ...analysis,
      analyzedAt: new Date()
    };
  }
  return this.save();
};

// Mark as failed
chatAttachmentSchema.methods.markFailed = function(error) {
  this.processingStatus = 'failed';
  this.processingError = error;
  return this.save();
};

module.exports = mongoose.model('ChatAttachment', chatAttachmentSchema);
