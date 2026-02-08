/**
 * OpenAI Service - Specialized service for OpenAI integration
 * Handles fine-tuning, embeddings, and advanced OpenAI features
 */

const { OpenAI } = require('openai');

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 30000
}) : null;

/**
 * Generate embeddings for text (for vector search)
 * @param {string} text 
 * @returns {Promise<Array>} Embedding vector
 */
async function generateEmbedding(text) {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding Generation Error:', error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {Array<string>} texts 
 * @returns {Promise<Array>} Array of embedding vectors
 */
async function generateEmbeddingsBatch(texts) {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      encoding_format: 'float'
    });

    return response.data.map(d => d.embedding);
  } catch (error) {
    console.error('Batch Embedding Error:', error);
    throw error;
  }
}

/**
 * Generate travel summary/recommendation using GPT
 * @param {Object} options 
 * @returns {Promise<string>}
 */
async function generateTravelSummary({ 
  destination, 
  duration, 
  interests = [], 
  budget,
  travelers 
}) {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = `Create a personalized travel summary and recommendations for:
- Destination: ${destination}
- Duration: ${duration}
- Interests: ${interests.join(', ') || 'general tourism'}
- Budget: ${budget || 'moderate'}
- Travelers: ${travelers || 'solo/adults'}

Provide:
1. A brief overview of the destination
2. Top 3-5 must-see attractions
3. Local food recommendations
4. Transportation tips
5. One insider tip

Keep it concise but informative, with an enthusiastic tone.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800,
    temperature: 0.7
  });

  return response.choices[0].message.content;
}

/**
 * Analyze sentiment of user message
 * @param {string} message 
 * @returns {Promise<Object>} Sentiment analysis
 */
async function analyzeSentiment(message) {
  if (!openai) {
    return { sentiment: 'neutral', score: 0.5 };
  }

  const prompt = `Analyze the sentiment of this travel-related message. 
Respond with ONLY a JSON object: {"sentiment": "positive|negative|neutral", "score": 0.0-1.0, "urgency": "low|medium|high"}

Message: "${message}"`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.1
    });

    const jsonMatch = response.choices[0].message.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Sentiment Analysis Error:', error);
  }

  return { sentiment: 'neutral', score: 0.5, urgency: 'low' };
}

/**
 * Generate destination description
 * @param {string} destination 
 * @returns {Promise<Object>}
 */
async function generateDestinationDescription(destination) {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = `Create a comprehensive travel guide for ${destination}. 
Return ONLY a JSON object with this structure:
{
  "overview": "2-3 sentence description",
  "highlights": ["highlight1", "highlight2", "highlight3", "highlight4", "highlight5"],
  "bestTimeToVisit": "seasonal advice",
  "localTransport": ["transport option 1", "transport option 2"],
  "estimatedCosts": {
    "budget": "$-$$ daily estimate",
    "mid": "$$-$$$ daily estimate", 
    "luxury": "$$$-$$$$ daily estimate"
  },
  "culturalTips": ["tip1", "tip2"],
  "popularAttractions": ["attraction1", "attraction2", "attraction3"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7
    });

    const jsonMatch = response.choices[0].message.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Destination Description Error:', error);
  }

  return null;
}

/**
 * Moderate content for safety
 * @param {string} text 
 * @returns {Promise<Object>} Moderation result
 */
async function moderateContent(text) {
  if (!openai) {
    return { safe: true, flagged: false };
  }

  try {
    const response = await openai.moderations.create({
      input: text
    });

    const result = response.results[0];
    return {
      safe: !result.flagged,
      flagged: result.flagged,
      categories: result.categories,
      scores: result.category_scores
    };
  } catch (error) {
    console.error('Content Moderation Error:', error);
    return { safe: true, flagged: false };
  }
}

/**
 * Generate price prediction
 * @param {Object} flightData 
 * @returns {Promise<Object>} Price prediction
 */
async function predictPriceTrend(flightData) {
  if (!openai) {
    return { trend: 'stable', confidence: 0.5, recommendation: 'Book when ready' };
  }

  const prompt = `Based on typical flight pricing patterns, predict the price trend for:
Route: ${flightData.origin} to ${flightData.destination}
Dates: ${flightData.dates}
Current Price: ${flightData.currentPrice}
Days until departure: ${flightData.daysUntilDeparture}

Respond with JSON: {"trend": "rising|falling|stable", "confidence": 0.0-1.0, "recommendation": "advice"}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.3
    });

    const jsonMatch = response.choices[0].message.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Price Prediction Error:', error);
  }

  return { trend: 'stable', confidence: 0.5, recommendation: 'Book when ready' };
}

/**
 * Create fine-tuning dataset format
 * @param {Array} conversations 
 * @returns {Array} Formatted for fine-tuning
 */
function createFineTuningDataset(conversations) {
  return conversations.map(conv => ({
    messages: [
      { role: 'system', content: conv.system },
      ...conv.messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    ]
  }));
}

/**
 * Calculate similarity between two embeddings
 * @param {Array} embedding1 
 * @param {Array} embedding2 
 * @returns {number} Cosine similarity
 */
function cosineSimilarity(embedding1, embedding2) {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have same dimensions');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

module.exports = {
  generateEmbedding,
  generateEmbeddingsBatch,
  generateTravelSummary,
  analyzeSentiment,
  generateDestinationDescription,
  moderateContent,
  predictPriceTrend,
  createFineTuningDataset,
  cosineSimilarity,
  openai
};
