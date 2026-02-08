/**
 * Destination Model
 * Mongoose schema for destination database with vector search support
 */

const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema({
  // Basic info
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  country: {
    type: String,
    required: true,
    trim: true
  },
  continent: {
    type: String,
    enum: ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica'],
    required: true
  },
  
  // Description and content
  description: {
    type: String,
    required: true
  },
  overview: {
    type: String,
    default: ''
  },
  highlights: [{
    type: String
  }],
  
  // Travel information
  bestTimeToVisit: {
    description: String,
    months: [{
      month: String,
      rating: { type: Number, min: 1, max: 10 }, // 1-10 rating
      weather: String,
      crowdLevel: { type: String, enum: ['low', 'moderate', 'high', 'peak'] }
    }]
  },
  
  weatherByMonth: {
    type: Map,
    of: {
      tempHigh: Number,
      tempLow: Number,
      rainfall: Number, // mm
      description: String
    }
  },
  
  // Practical information
  visaRequirements: {
    type: Map, // key: nationality code, value: requirement
    of: {
      required: Boolean,
      visaFreeDays: Number,
      evisaAvailable: Boolean,
      notes: String
    }
  },
  
  localTransport: [{
    type: String
  }],
  
  popularAttractions: [{
    name: String,
    description: String,
    category: { type: String, enum: ['landmark', 'museum', 'nature', 'entertainment', 'shopping', 'food'] },
    rating: { type: Number, min: 1, max: 5 }
  }],
  
  // Costs
  estimatedCosts: {
    budget: {
      accommodation: Number,
      food: Number,
      transport: Number,
      activities: Number,
      dailyTotal: Number
    },
    mid: {
      accommodation: Number,
      food: Number,
      transport: Number,
      activities: Number,
      dailyTotal: Number
    },
    luxury: {
      accommodation: Number,
      food: Number,
      transport: Number,
      activities: Number,
      dailyTotal: Number
    },
    currency: { type: String, default: 'USD' }
  },
  
  // Safety and culture
  safetyInfo: {
    overallRating: { type: Number, min: 1, max: 10 },
    generalTips: String,
    areasToAvoid: [String],
    emergencyNumbers: {
      police: String,
      ambulance: String,
      fire: String
    }
  },
  
  culturalTips: [{
    type: String
  }],
  
  // Local info
  currency: {
    code: String,
    name: String,
    symbol: String
  },
  
  languages: [{
    type: String
  }],
  
  timezone: {
    name: String,
    offset: String
  },
  
  // Vector embedding for semantic search
  embedding: {
    type: [Number],
    index: false // Set up vector index separately if using MongoDB Atlas
  },
  
  // Metadata
  tags: [{
    type: String,
    index: true
  }],
  
  categories: [{
    type: String,
    enum: ['beach', 'mountain', 'city', 'countryside', 'historical', 'adventure', 'relaxation', 'family', 'romantic', 'business']
  }],
  
  // AI-generated flag
  generatedByAI: {
    type: Boolean,
    default: false
  },
  
  // Statistics
  popularityScore: {
    type: Number,
    default: 0
  },
  
  searchCount: {
    type: Number,
    default: 0
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
destinationSchema.index({ name: 'text', description: 'text', country: 'text' });
destinationSchema.index({ country: 1, continent: 1 });
destinationSchema.index({ categories: 1 });
destinationSchema.index({ tags: 1 });
destinationSchema.index({ popularityScore: -1 });

/**
 * Find destinations by text search
 * @param {string} query 
 * @param {Object} options 
 * @returns {Promise<Array>}
 */
destinationSchema.statics.searchByText = async function(query, options = {}) {
  const { limit = 10, filters = {} } = options;
  
  const searchQuery = {
    $text: { $search: query },
    ...filters
  };
  
  return this.find(searchQuery)
    .select({
      score: { $meta: 'textScore' },
      name: 1,
      country: 1,
      description: 1,
      highlights: 1,
      bestTimeToVisit: 1,
      estimatedCosts: 1
    })
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit);
};

/**
 * Find similar destinations using vector similarity
 * @param {Array} embedding 
 * @param {Object} options 
 * @returns {Promise<Array>}
 */
destinationSchema.statics.findSimilar = async function(embedding, options = {}) {
  const { limit = 5, excludeId = null } = options;
  
  // Use MongoDB aggregation pipeline for vector similarity
  const pipeline = [
    {
      $addFields: {
        similarity: {
          $let: {
            vars: {
              dotProduct: {
                $sum: {
                  $map: {
                    input: { $range: [0, { $size: embedding }] },
                    as: 'i',
                    in: {
                      $multiply: [
                        { $arrayElemAt: ['$embedding', '$$i'] },
                        { $arrayElemAt: [embedding, '$$i'] }
                      ]
                    }
                  }
                }
              }
            },
            in: '$$dotProduct'
          }
        }
      }
    },
    { $match: { embedding: { $exists: true } } },
    ...(excludeId ? [{ $match: { _id: { $ne: excludeId } } }] : []),
    { $sort: { similarity: -1 } },
    { $limit: limit },
    {
      $project: {
        name: 1,
        country: 1,
        description: 1,
        highlights: 1,
        similarity: 1
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

/**
 * Get destination recommendations based on preferences
 * @param {Object} preferences 
 * @returns {Promise<Array>}
 */
destinationSchema.statics.getRecommendations = async function(preferences = {}) {
  const { 
    travelStyle, 
    pastDestinations = [], 
    budget,
    interests = [] 
  } = preferences;
  
  const query = {
    _id: { $nin: pastDestinations }
  };
  
  if (travelStyle) {
    query.categories = { $in: [travelStyle] };
  }
  
  if (interests.length > 0) {
    query.tags = { $in: interests };
  }
  
  if (budget === 'budget') {
    query['estimatedCosts.budget.dailyTotal'] = { $lt: 100 };
  } else if (budget === 'luxury') {
    query['estimatedCosts.luxury.dailyTotal'] = { $gt: 300 };
  }
  
  return this.find(query)
    .sort({ popularityScore: -1 })
    .limit(6);
};

/**
 * Increment search count
 */
destinationSchema.methods.incrementSearchCount = async function() {
  this.searchCount += 1;
  await this.save();
};

/**
 * Get formatted info for AI responses
 * @returns {Object}
 */
destinationSchema.methods.toAIFormat = function() {
  return {
    name: this.name,
    country: this.country,
    description: this.overview || this.description,
    highlights: this.highlights,
    bestTimeToVisit: this.bestTimeToVisit?.description,
    estimatedCosts: {
      budget: this.estimatedCosts?.budget?.dailyTotal,
      mid: this.estimatedCosts?.mid?.dailyTotal,
      luxury: this.estimatedCosts?.luxury?.dailyTotal,
      currency: this.estimatedCosts?.currency
    },
    currency: this.currency?.code,
    languages: this.languages,
    timezone: this.timezone?.name
  };
};

/**
 * Get visa requirements for a nationality
 * @param {string} nationality 
 * @returns {Object|null}
 */
destinationSchema.methods.getVisaRequirements = function(nationality) {
  return this.visaRequirements?.get(nationality.toUpperCase()) || null;
};

module.exports = mongoose.model('Destination', destinationSchema);
