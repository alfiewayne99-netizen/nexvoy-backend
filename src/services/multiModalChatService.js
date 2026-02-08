const ChatAttachment = require('../models/ChatAttachment');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 60000
}) : null;

/**
 * Multi-Modal Chat Service
 * Handles voice, images, documents, and screenshots in chat
 */
class MultiModalChatService {
  
  /**
   * Process voice input
   * @param {Buffer} audioBuffer 
   * @param {Object} metadata 
   */
  async processVoiceInput(audioBuffer, metadata = {}) {
    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }
    
    try {
      // Create a temporary file for the audio
      const tempFile = path.join('/tmp', `voice_${Date.now()}.webm`);
      fs.writeFileSync(tempFile, audioBuffer);
      
      // Transcribe using Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: 'whisper-1',
        language: metadata.language || 'en'
      });
      
      // Clean up temp file
      fs.unlinkSync(tempFile);
      
      return {
        success: true,
        text: transcription.text,
        language: transcription.language,
        duration: metadata.duration || null
      };
    } catch (error) {
      console.error('Voice processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Process image (search or analysis)
   * @param {Buffer} imageBuffer 
   * @param {Object} metadata 
   */
  async processImage(imageBuffer, metadata = {}) {
    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }
    
    try {
      // Convert buffer to base64
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:${metadata.mimeType || 'image/jpeg'};base64,${base64Image}`;
      
      // Use GPT-4 Vision to analyze image
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a travel assistant analyzing images. Identify destinations, landmarks, travel documents, or travel-related content. Return structured JSON.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this image for travel purposes. Identify: 1) What is shown (destination, landmark, document type), 2) Any text visible, 3) Travel-related insights. Return JSON with fields: type, description, location (if identifiable), landmarks, extractedText, travelRelevance, suggestions' },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000
      });
      
      const analysis = JSON.parse(completion.choices[0].message.content);
      
      return {
        success: true,
        analysis,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format
        }
      };
    } catch (error) {
      console.error('Image processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Process document upload
   * @param {Buffer} documentBuffer 
   * @param {Object} metadata 
   */
  async processDocument(documentBuffer, metadata = {}) {
    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }
    
    try {
      // For now, we'll analyze based on filename and metadata
      // In production, you'd extract text from PDFs, parse images, etc.
      
      const prompt = `Analyze this travel document:
Filename: ${metadata.originalName || 'document'}
MIME Type: ${metadata.mimeType}
Size: ${metadata.size} bytes

Determine:
1. Document type (passport, visa, ticket, itinerary, boarding_pass, hotel_voucher, insurance, receipt, other)
2. What information is likely contained
3. Travel relevance
4. Suggestions for the user

Return JSON format:
{
  "documentType": "type",
  "confidence": 0.9,
  "description": "What's in this document",
  "extractedInfo": { "possible fields": "values" },
  "travelRelevance": "How this relates to their trip",
  "suggestions": ["suggestion1", "suggestion2"],
  "warnings": ["Any warnings about validity, dates, etc"]
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 800
      });
      
      const analysis = JSON.parse(completion.choices[0].message.content);
      
      return {
        success: true,
        analysis,
        metadata: {
          filename: metadata.originalName,
          mimeType: metadata.mimeType,
          size: metadata.size
        }
      };
    } catch (error) {
      console.error('Document processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Process screenshot (special case of image)
   * @param {Buffer} screenshotBuffer 
   * @param {Object} metadata 
   */
  async processScreenshot(screenshotBuffer, metadata = {}) {
    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }
    
    try {
      const base64Image = screenshotBuffer.toString('base64');
      const dataUrl = `data:${metadata.mimeType || 'image/png'};base64,${base64Image}`;
      
      // Use GPT-4 Vision with focus on extracting travel data from screenshots
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You analyze travel-related screenshots. Extract all relevant travel information like prices, dates, flight details, hotel info. Return structured JSON.'
          },
          {
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: 'This is a screenshot from a travel website/app. Extract all travel details: trip type, origin, destination, dates, prices, airline/hotel names, times, any visible options or filters. Return JSON with: isTravelScreenshot (boolean), platform (if identifiable), extractedData (all details), prices (array of price objects), recommendations (what the user should know). Be thorough!' 
              },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500
      });
      
      const analysis = JSON.parse(completion.choices[0].message.content);
      
      return {
        success: true,
        analysis,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          processedAt: new Date()
        }
      };
    } catch (error) {
      console.error('Screenshot processing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Generate text response based on multimodal input
   * @param {string} text 
   * @param {Array} attachments 
   * @param {Object} context 
   */
  async generateMultimodalResponse(text, attachments, context = {}) {
    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }
    
    const attachmentContexts = attachments.map(att => {
      switch (att.type) {
        case 'voice':
          return `[Voice message transcribed]: "${att.transcript}"`;
        case 'image':
          return `[Image uploaded showing: ${att.analysis?.description || 'travel-related content'}]`;
        case 'screenshot':
          return `[Screenshot showing: ${att.analysis?.extractedData ? JSON.stringify(att.analysis.extractedData) : 'travel website/app'}]`;
        case 'document':
          return `[Document uploaded: ${att.analysis?.documentType || 'travel document'}]`;
        default:
          return `[${att.type} uploaded]`;
      }
    }).join('\n');
    
    const fullMessage = `${text || 'What do you think about this?'}

${attachmentContexts}`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are Nex, a helpful travel assistant. The user has uploaded media alongside their message. Respond helpfully using the information from their uploads. ${context.systemPrompt || ''}`
        },
        {
          role: 'user',
          content: fullMessage
        }
      ],
      max_tokens: 1500,
      temperature: 0.7
    });
    
    return {
      content: completion.choices[0].message.content,
      usedAttachments: attachments.length,
      metadata: {
        model: completion.model,
        tokens: completion.usage
      }
    };
  }
  
  /**
   * Save attachment metadata to database
   * @param {Object} attachmentData 
   */
  async saveAttachment(attachmentData) {
    const attachment = new ChatAttachment({
      ...attachmentData,
      processingStatus: 'completed'
    });
    
    await attachment.save();
    return attachment;
  }
  
  /**
   * Get attachment by ID
   * @param {string} attachmentId 
   */
  async getAttachment(attachmentId) {
    return ChatAttachment.findById(attachmentId);
  }
  
  /**
   * Get user's attachments
   * @param {string} userId 
   * @param {Object} filters 
   */
  async getUserAttachments(userId, filters = {}) {
    const query = { userId };
    
    if (filters.type) query.type = filters.type;
    if (filters.sessionId) query.sessionId = filters.sessionId;
    
    return ChatAttachment.find(query)
      .sort({ uploadedAt: -1 })
      .limit(filters.limit || 50);
  }
  
  /**
   * Delete attachment
   * @param {string} attachmentId 
   * @param {string} userId 
   */
  async deleteAttachment(attachmentId, userId) {
    const attachment = await ChatAttachment.findOne({ _id: attachmentId, userId });
    if (!attachment) {
      throw new Error('Attachment not found');
    }
    
    // In production, delete from cloud storage here
    
    await attachment.deleteOne();
    return { success: true };
  }
  
  /**
   * Search images by content description
   * @param {string} query 
   * @param {string} userId 
   */
  async searchImages(query, userId) {
    // This would integrate with vector search in production
    // For now, return recent image attachments
    return ChatAttachment.find({
      userId,
      type: { $in: ['image', 'screenshot'] }
    })
    .sort({ uploadedAt: -1 })
    .limit(20);
  }
  
  /**
   * Generate travel suggestions from image
   * @param {Object} imageAnalysis 
   */
  generateImageSuggestions(imageAnalysis) {
    const suggestions = [];
    
    if (imageAnalysis.location) {
      suggestions.push({
        type: 'destination',
        text: `Learn more about ${imageAnalysis.location}`,
        action: 'search_destination'
      });
    }
    
    if (imageAnalysis.landmarks?.length > 0) {
      suggestions.push({
        type: 'landmark',
        text: `Visit ${imageAnalysis.landmarks[0]}`,
        action: 'search_landmark'
      });
    }
    
    if (imageAnalysis.type === 'travel_document') {
      suggestions.push({
        type: 'document_help',
        text: 'Get document travel tips',
        action: 'document_help'
      });
    }
    
    return suggestions;
  }
}

module.exports = new MultiModalChatService();
