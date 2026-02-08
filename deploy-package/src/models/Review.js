/**
 * Review Model for Nexvoy
 * Manages user reviews and ratings for experiences, hotels, flights, destinations
 */

const crypto = require('crypto');

/**
 * Review Schema Definition
 */
const ReviewSchema = {
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  
  // Review target
  targetType: { 
    type: String, 
    required: true, 
    enum: ['experience', 'hotel', 'flight', 'destination', 'restaurant', 'activity', 'tour'],
    index: true
  },
  targetId: { type: String, required: true, index: true }, // ID of the item being reviewed
  targetName: { type: String, required: true }, // Display name
  
  // Rating (1-5 stars)
  rating: { type: Number, required: true, min: 1, max: 5 },
  
  // Review content
  title: { type: String, required: true, maxLength: 200 },
  content: { type: String, required: true, maxLength: 5000 },
  
  // Categories rated
  categoryRatings: {
    valueForMoney: { type: Number, min: 1, max: 5 },
    service: { type: Number, min: 1, max: 5 },
    cleanliness: { type: Number, min: 1, max: 5 },
    location: { type: Number, min: 1, max: 5 },
    amenities: { type: Number, min: 1, max: 5 },
    food: { type: Number, min: 1, max: 5 },
    comfort: { type: Number, min: 1, max: 5 }
  },
  
  // Travel context
  travelContext: {
    travelDate: { type: Date },
    tripType: { type: String, enum: ['solo', 'couple', 'family', 'friends', 'business'] },
    duration: { type: Number }, // nights for hotels, hours for experiences
    roomType: { type: String }, // for hotels
    bookingSource: { type: String } // where they booked
  },
  
  // Photos
  photos: [{
    id: { type: String },
    url: { type: String },
    thumbnailUrl: { type: String },
    caption: { type: String, maxLength: 200 },
    uploadedAt: { type: Date, default: Date.now },
    width: { type: Number },
    height: { type: Number }
  }],
  
  // Verification
  verified: { type: Boolean, default: false }, // Verified purchase/stay
  verifiedAt: { type: Date },
  verifiedBy: { type: String }, // booking ID or verification method
  
  // Badges earned on this review
  badges: [{ type: String }],
  
  // Engagement
  helpfulCount: { type: Number, default: 0 },
  unhelpfulCount: { type: Number, default: 0 },
  helpfulVotes: [{ userId: String, helpful: Boolean, votedAt: Date }],
  
  // Comments on review
  comments: [{
    id: { type: String },
    userId: { type: String },
    content: { type: String },
    createdAt: { type: Date, default: Date.now },
    isOwnerResponse: { type: Boolean, default: false }
  }],
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'flagged'], 
    default: 'pending',
    index: true
  },
  moderationNotes: { type: String },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  editedAt: { type: Date },
  isEdited: { type: Boolean, default: false },
  viewCount: { type: Number, default: 0 }
};

/**
 * Review Model Class
 */
class Review {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.userId = data.userId;
    
    this.targetType = data.targetType;
    this.targetId = data.targetId;
    this.targetName = data.targetName;
    
    this.rating = data.rating;
    this.title = data.title;
    this.content = data.content;
    
    this.categoryRatings = {
      valueForMoney: data.categoryRatings?.valueForMoney || null,
      service: data.categoryRatings?.service || null,
      cleanliness: data.categoryRatings?.cleanliness || null,
      location: data.categoryRatings?.location || null,
      amenities: data.categoryRatings?.amenities || null,
      food: data.categoryRatings?.food || null,
      comfort: data.categoryRatings?.comfort || null
    };
    
    this.travelContext = {
      travelDate: data.travelContext?.travelDate ? new Date(data.travelContext.travelDate) : null,
      tripType: data.travelContext?.tripType || null,
      duration: data.travelContext?.duration || null,
      roomType: data.travelContext?.roomType || null,
      bookingSource: data.travelContext?.bookingSource || null
    };
    
    this.photos = data.photos || [];
    
    this.verified = data.verified || false;
    this.verifiedAt = data.verifiedAt ? new Date(data.verifiedAt) : null;
    this.verifiedBy = data.verifiedBy || null;
    
    this.badges = data.badges || [];
    
    this.helpfulCount = data.helpfulCount || 0;
    this.unhelpfulCount = data.unhelpfulCount || 0;
    this.helpfulVotes = data.helpfulVotes || [];
    
    this.comments = data.comments || [];
    
    this.status = data.status || 'pending';
    this.moderationNotes = data.moderationNotes || '';
    
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    this.editedAt = data.editedAt ? new Date(data.editedAt) : null;
    this.isEdited = data.isEdited || false;
    this.viewCount = data.viewCount || 0;
    
    this.validate();
  }
  
  /**
   * Validate review data
   */
  validate() {
    const errors = [];
    
    if (!this.userId) errors.push('User ID is required');
    if (!this.targetType) errors.push('Target type is required');
    if (!this.targetId) errors.push('Target ID is required');
    if (!this.targetName) errors.push('Target name is required');
    if (!this.rating || this.rating < 1 || this.rating > 5) {
      errors.push('Rating must be between 1 and 5');
    }
    if (!this.title || this.title.length < 5) {
      errors.push('Title must be at least 5 characters');
    }
    if (!this.content || this.content.length < 20) {
      errors.push('Content must be at least 20 characters');
    }
    
    return errors;
  }
  
  /**
   * Get average category rating
   */
  getAverageCategoryRating() {
    const ratings = Object.values(this.categoryRatings).filter(r => r !== null);
    if (ratings.length === 0) return null;
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  }
  
  /**
   * Add a photo
   */
  addPhoto(photoData) {
    const photo = {
      id: crypto.randomUUID(),
      url: photoData.url,
      thumbnailUrl: photoData.thumbnailUrl || photoData.url,
      caption: photoData.caption || '',
      uploadedAt: new Date(),
      width: photoData.width,
      height: photoData.height
    };
    this.photos.push(photo);
    this.updatedAt = new Date();
    return photo;
  }
  
  /**
   * Remove a photo
   */
  removePhoto(photoId) {
    const index = this.photos.findIndex(p => p.id === photoId);
    if (index > -1) {
      this.photos.splice(index, 1);
      this.updatedAt = new Date();
      return true;
    }
    return false;
  }
  
  /**
   * Mark as verified
   */
  verify(bookingId) {
    this.verified = true;
    this.verifiedAt = new Date();
    this.verifiedBy = bookingId;
    this.status = 'approved';
    this.updatedAt = new Date();
  }
  
  /**
   * Vote helpful/unhelpful
   */
  voteHelpful(userId, helpful) {
    const existingVote = this.helpfulVotes.find(v => v.userId === userId);
    
    if (existingVote) {
      // Change vote
      if (existingVote.helpful) {
        this.helpfulCount--;
      } else {
        this.unhelpfulCount--;
      }
      existingVote.helpful = helpful;
    } else {
      // New vote
      this.helpfulVotes.push({
        userId,
        helpful,
        votedAt: new Date()
      });
    }
    
    if (helpful) {
      this.helpfulCount++;
    } else {
      this.unhelpfulCount++;
    }
    
    this.updatedAt = new Date();
  }
  
  /**
   * Add comment
   */
  addComment(userId, content, isOwnerResponse = false) {
    const comment = {
      id: crypto.randomUUID(),
      userId,
      content,
      createdAt: new Date(),
      isOwnerResponse
    };
    this.comments.push(comment);
    this.updatedAt = new Date();
    return comment;
  }
  
  /**
   * Update review content
   */
  update(updates) {
    if (updates.title) this.title = updates.title;
    if (updates.content) this.content = updates.content;
    if (updates.rating) this.rating = updates.rating;
    if (updates.categoryRatings) {
      this.categoryRatings = { ...this.categoryRatings, ...updates.categoryRatings };
    }
    if (updates.travelContext) {
      this.travelContext = { ...this.travelContext, ...updates.travelContext };
    }
    
    this.isEdited = true;
    this.editedAt = new Date();
    this.updatedAt = new Date();
  }
  
  /**
   * Get sentiment score based on rating and content
   */
  getSentimentScore() {
    // Simple sentiment: rating * 20 (gives score 20-100)
    let score = this.rating * 20;
    
    // Boost for detailed reviews
    if (this.content.length > 200) score += 5;
    if (this.content.length > 500) score += 5;
    
    // Boost for photos
    score += this.photos.length * 2;
    
    // Boost for helpful votes
    const totalVotes = this.helpfulCount + this.unhelpfulCount;
    if (totalVotes > 0) {
      const helpfulRatio = this.helpfulCount / totalVotes;
      score += helpfulRatio * 10;
    }
    
    return Math.min(100, score);
  }
  
  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      targetType: this.targetType,
      targetId: this.targetId,
      targetName: this.targetName,
      rating: this.rating,
      title: this.title,
      content: this.content,
      categoryRatings: this.categoryRatings,
      travelContext: this.travelContext,
      photos: this.photos,
      verified: this.verified,
      verifiedAt: this.verifiedAt,
      badges: this.badges,
      helpfulCount: this.helpfulCount,
      unhelpfulCount: this.unhelpfulCount,
      commentCount: this.comments.length,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isEdited: this.isEdited,
      viewCount: this.viewCount,
      sentimentScore: this.getSentimentScore()
    };
  }
}

/**
 * Review Repository
 */
class ReviewRepository {
  constructor(database = null) {
    this.db = database;
    this.reviews = new Map();
    this.reviewsByTarget = new Map();
    this.reviewsByUser = new Map();
  }
  
  async create(reviewData) {
    const review = new Review(reviewData);
    const errors = review.validate();
    
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    this.reviews.set(review.id, review);
    
    // Index by target
    const targetKey = `${review.targetType}:${review.targetId}`;
    if (!this.reviewsByTarget.has(targetKey)) {
      this.reviewsByTarget.set(targetKey, new Set());
    }
    this.reviewsByTarget.get(targetKey).add(review.id);
    
    // Index by user
    if (!this.reviewsByUser.has(review.userId)) {
      this.reviewsByUser.set(review.userId, new Set());
    }
    this.reviewsByUser.get(review.userId).add(review.id);
    
    if (this.db) {
      try {
        await this.db.collection('reviews').insertOne(review.toJSON());
      } catch (error) {
        console.error('Failed to store review in MongoDB:', error);
      }
    }
    
    return review;
  }
  
  async findById(id) {
    if (this.reviews.has(id)) {
      return this.reviews.get(id);
    }
    
    if (this.db) {
      const data = await this.db.collection('reviews').findOne({ id });
      if (data) {
        const review = new Review(data);
        this.reviews.set(id, review);
        return review;
      }
    }
    
    return null;
  }
  
  async findByTarget(targetType, targetId, options = {}) {
    const { status = 'approved', sortBy = 'newest', limit = 20, offset = 0 } = options;
    
    const targetKey = `${targetType}:${targetId}`;
    const reviewIds = this.reviewsByTarget.get(targetKey) || new Set();
    
    let reviews = Array.from(reviewIds)
      .map(id => this.reviews.get(id))
      .filter(r => r && (status === 'all' || r.status === status));
    
    // Sort
    if (sortBy === 'newest') {
      reviews.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortBy === 'oldest') {
      reviews.sort((a, b) => a.createdAt - b.createdAt);
    } else if (sortBy === 'highest') {
      reviews.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'lowest') {
      reviews.sort((a, b) => a.rating - b.rating);
    } else if (sortBy === 'helpful') {
      reviews.sort((a, b) => b.helpfulCount - a.helpfulCount);
    }
    
    const total = reviews.length;
    reviews = reviews.slice(offset, offset + limit);
    
    return { reviews, total };
  }
  
  async findByUser(userId, options = {}) {
    const { limit = 20, offset = 0 } = options;
    
    const reviewIds = this.reviewsByUser.get(userId) || new Set();
    let reviews = Array.from(reviewIds)
      .map(id => this.reviews.get(id))
      .filter(r => r !== undefined);
    
    reviews.sort((a, b) => b.createdAt - a.createdAt);
    
    const total = reviews.length;
    reviews = reviews.slice(offset, offset + limit);
    
    return { reviews, total };
  }
  
  async getRatingSummary(targetType, targetId) {
    const { reviews } = await this.findByTarget(targetType, targetId, { status: 'approved', limit: 1000 });
    
    if (reviews.length === 0) {
      return {
        average: 0,
        total: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }
    
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => distribution[r.rating]++);
    
    return {
      average: (sum / reviews.length).toFixed(1),
      total: reviews.length,
      distribution
    };
  }
  
  async update(id, updates) {
    const review = await this.findById(id);
    if (!review) return null;
    
    review.update(updates);
    
    if (this.db) {
      await this.db.collection('reviews').updateOne(
        { id },
        { $set: updates, $currentDate: { updatedAt: true, editedAt: true } }
      );
    }
    
    return review;
  }
  
  async delete(id) {
    const review = this.reviews.get(id);
    if (review) {
      this.reviews.delete(id);
      
      const targetKey = `${review.targetType}:${review.targetId}`;
      this.reviewsByTarget.get(targetKey)?.delete(id);
      this.reviewsByUser.get(review.userId)?.delete(id);
    }
    
    if (this.db) {
      await this.db.collection('reviews').deleteOne({ id });
    }
    
    return true;
  }
  
  async approve(id, moderatorNotes = '') {
    const review = await this.findById(id);
    if (!review) return null;
    
    review.status = 'approved';
    review.moderationNotes = moderatorNotes;
    review.updatedAt = new Date();
    
    if (this.db) {
      await this.db.collection('reviews').updateOne(
        { id },
        { $set: { status: 'approved', moderationNotes }, $currentDate: { updatedAt: true } }
      );
    }
    
    return review;
  }
}

module.exports = {
  Review,
  ReviewRepository,
  ReviewSchema
};
