/**
 * Forum Model for Nexvoy
 * Manages community forums, discussions, and Q&A by destination
 */

const crypto = require('crypto');

/**
 * Forum/Topic Schema
 */
const ForumSchema = {
  id: { type: String, required: true, unique: true },
  
  // Forum details
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String },
  
  // Category
  category: { type: String, required: true, index: true },
  subcategory: { type: String },
  
  // Location (for destination forums)
  location: {
    type: { type: String, enum: ['country', 'city', 'region', 'global'] },
    country: { type: String },
    city: { type: String },
    region: { type: String }
  },
  
  // Forum type
  type: { type: String, enum: ['destination', 'topic', 'tips', 'qanda'], default: 'topic' },
  
  // Stats
  topicCount: { type: Number, default: 0 },
  postCount: { type: Number, default: 0 },
  subscriberCount: { type: Number, default: 0 },
  
  // Moderation
  moderators: [{ type: String }], // userIds
  rules: { type: String },
  
  // Status
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
};

/**
 * Topic/Thread Schema
 */
const TopicSchema = {
  id: { type: String, required: true, unique: true },
  forumId: { type: String, required: true, index: true },
  
  // Author
  authorId: { type: String, required: true },
  authorName: { type: String },
  
  // Content
  title: { type: String, required: true },
  content: { type: String, required: true },
  
  // Type
  type: { type: String, enum: ['discussion', 'question', 'tip', 'guide'], default: 'discussion' },
  
  // Tags
  tags: [{ type: String }],
  
  // Engagement
  viewCount: { type: Number, default: 0 },
  replyCount: { type: Number, default: 0 },
  likeCount: { type: Number, default: 0 },
  bookmarkCount: { type: Number, default: 0 },
  
  // Votes (for Q&A)
  voteCount: { type: Number, default: 0 },
  votes: [{ userId: String, value: Number, votedAt: Date }], // value: 1 or -1
  
  // Solution (for questions)
  solutionId: { type: String }, // ID of accepted answer
  
  // Status
  isPinned: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'closed', 'archived'], default: 'active' },
  
  // Last activity
  lastReplyAt: { type: Date },
  lastReplyBy: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
};

/**
 * Reply/Post Schema
 */
const ReplySchema = {
  id: { type: String, required: true, unique: true },
  topicId: { type: String, required: true, index: true },
  
  // Author
  authorId: { type: String, required: true },
  authorName: { type: String },
  
  // Content
  content: { type: String, required: true },
  
  // Parent for nested replies
  parentId: { type: String }, // null for top-level replies
  
  // Engagement
  likeCount: { type: Number, default: 0 },
  likes: [{ userId: String, likedAt: Date }],
  
  // Votes
  voteCount: { type: Number, default: 0 },
  votes: [{ userId: String, value: Number, votedAt: Date }],
  
  // Solution marking
  isSolution: { type: Boolean, default: false },
  
  // Status
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: String },
  
  // Edits
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date },
  editHistory: [{ content: String, editedAt: Date }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
};

/**
 * Forum Class
 */
class Forum {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    
    this.name = data.name;
    this.slug = data.slug || this.generateSlug(data.name);
    this.description = data.description || '';
    
    this.category = data.category;
    this.subcategory = data.subcategory || '';
    
    this.location = {
      type: data.location?.type || 'global',
      country: data.location?.country || '',
      city: data.location?.city || '',
      region: data.location?.region || ''
    };
    
    this.type = data.type || 'topic';
    
    this.topicCount = data.topicCount || 0;
    this.postCount = data.postCount || 0;
    this.subscriberCount = data.subscriberCount || 0;
    
    this.moderators = data.moderators || [];
    this.rules = data.rules || '';
    
    this.isActive = data.isActive !== false;
    this.isFeatured = data.isFeatured || false;
    
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }
  
  generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  
  incrementTopicCount() {
    this.topicCount++;
    this.updatedAt = new Date();
  }
  
  incrementPostCount() {
    this.postCount++;
    this.updatedAt = new Date();
  }
  
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      category: this.category,
      subcategory: this.subcategory,
      location: this.location,
      type: this.type,
      topicCount: this.topicCount,
      postCount: this.postCount,
      subscriberCount: this.subscriberCount,
      isActive: this.isActive,
      isFeatured: this.isFeatured,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Topic Class
 */
class Topic {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.forumId = data.forumId;
    
    this.authorId = data.authorId;
    this.authorName = data.authorName || '';
    
    this.title = data.title;
    this.content = data.content;
    
    this.type = data.type || 'discussion';
    this.tags = data.tags || [];
    
    this.viewCount = data.viewCount || 0;
    this.replyCount = data.replyCount || 0;
    this.likeCount = data.likeCount || 0;
    this.bookmarkCount = data.bookmarkCount || 0;
    
    this.voteCount = data.voteCount || 0;
    this.votes = data.votes || [];
    
    this.solutionId = data.solutionId || null;
    
    this.isPinned = data.isPinned || false;
    this.isLocked = data.isLocked || false;
    this.status = data.status || 'active';
    
    this.lastReplyAt = data.lastReplyAt ? new Date(data.lastReplyAt) : null;
    this.lastReplyBy = data.lastReplyBy || null;
    
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }
  
  /**
   * Record a view
   */
  view() {
    this.viewCount++;
  }
  
  /**
   * Add a reply
   */
  addReply() {
    this.replyCount++;
    this.lastReplyAt = new Date();
    this.updatedAt = new Date();
  }
  
  /**
   * Vote on topic
   */
  vote(userId, value) {
    const existingVote = this.votes.find(v => v.userId === userId);
    
    if (existingVote) {
      if (existingVote.value === value) {
        // Remove vote if same value
        this.votes = this.votes.filter(v => v.userId !== userId);
        this.voteCount -= value;
      } else {
        // Change vote
        this.voteCount += value * 2;
        existingVote.value = value;
        existingVote.votedAt = new Date();
      }
    } else {
      // New vote
      this.votes.push({ userId, value, votedAt: new Date() });
      this.voteCount += value;
    }
  }
  
  /**
   * Mark a reply as solution
   */
  markSolution(replyId) {
    this.solutionId = replyId;
    this.updatedAt = new Date();
  }
  
  toJSON() {
    return {
      id: this.id,
      forumId: this.forumId,
      authorId: this.authorId,
      authorName: this.authorName,
      title: this.title,
      content: this.content,
      type: this.type,
      tags: this.tags,
      viewCount: this.viewCount,
      replyCount: this.replyCount,
      likeCount: this.likeCount,
      bookmarkCount: this.bookmarkCount,
      voteCount: this.voteCount,
      solutionId: this.solutionId,
      isPinned: this.isPinned,
      isLocked: this.isLocked,
      status: this.status,
      lastReplyAt: this.lastReplyAt,
      lastReplyBy: this.lastReplyBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Reply Class
 */
class Reply {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.topicId = data.topicId;
    
    this.authorId = data.authorId;
    this.authorName = data.authorName || '';
    
    this.content = data.content;
    this.parentId = data.parentId || null;
    
    this.likeCount = data.likeCount || 0;
    this.likes = data.likes || [];
    
    this.voteCount = data.voteCount || 0;
    this.votes = data.votes || [];
    
    this.isSolution = data.isSolution || false;
    
    this.isDeleted = data.isDeleted || false;
    this.deletedAt = data.deletedAt ? new Date(data.deletedAt) : null;
    this.deletedBy = data.deletedBy || null;
    
    this.isEdited = data.isEdited || false;
    this.editedAt = data.editedAt ? new Date(data.editedAt) : null;
    this.editHistory = data.editHistory || [];
    
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }
  
  /**
   * Like the reply
   */
  like(userId) {
    const existingLike = this.likes.find(l => l.userId === userId);
    
    if (existingLike) {
      // Unlike
      this.likes = this.likes.filter(l => l.userId !== userId);
      this.likeCount--;
    } else {
      // Like
      this.likes.push({ userId, likedAt: new Date() });
      this.likeCount++;
    }
  }
  
  /**
   * Vote on reply
   */
  vote(userId, value) {
    const existingVote = this.votes.find(v => v.userId === userId);
    
    if (existingVote) {
      if (existingVote.value === value) {
        this.votes = this.votes.filter(v => v.userId !== userId);
        this.voteCount -= value;
      } else {
        this.voteCount += value * 2;
        existingVote.value = value;
        existingVote.votedAt = new Date();
      }
    } else {
      this.votes.push({ userId, value, votedAt: new Date() });
      this.voteCount += value;
    }
  }
  
  /**
   * Edit content
   */
  edit(newContent) {
    // Store in history
    this.editHistory.push({
      content: this.content,
      editedAt: new Date()
    });
    
    this.content = newContent;
    this.isEdited = true;
    this.editedAt = new Date();
    this.updatedAt = new Date();
  }
  
  /**
   * Soft delete
   */
  delete(deletedBy) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = deletedBy;
    this.updatedAt = new Date();
  }
  
  toJSON() {
    return {
      id: this.id,
      topicId: this.topicId,
      authorId: this.authorId,
      authorName: this.authorName,
      content: this.content,
      parentId: this.parentId,
      likeCount: this.likeCount,
      voteCount: this.voteCount,
      isSolution: this.isSolution,
      isDeleted: this.isDeleted,
      deletedAt: this.deletedAt,
      isEdited: this.isEdited,
      editedAt: this.editedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Forum Repository
 */
class ForumRepository {
  constructor(database = null) {
    this.db = database;
    this.forums = new Map();
    this.topics = new Map();
    this.replies = new Map();
  }
  
  async createForum(forumData) {
    const forum = new Forum(forumData);
    this.forums.set(forum.id, forum);
    
    if (this.db) {
      await this.db.collection('forums').insertOne(forum.toJSON());
    }
    
    return forum;
  }
  
  async findForumById(id) {
    return this.forums.get(id) || null;
  }
  
  async findForumBySlug(slug) {
    return Array.from(this.forums.values()).find(f => f.slug === slug) || null;
  }
  
  async findForums(options = {}) {
    const { category, type, featured, limit = 20, offset = 0 } = options;
    
    let forums = Array.from(this.forums.values())
      .filter(f => f.isActive);
    
    if (category) {
      forums = forums.filter(f => f.category === category);
    }
    
    if (type) {
      forums = forums.filter(f => f.type === type);
    }
    
    if (featured) {
      forums = forums.filter(f => f.isFeatured);
    }
    
    // Sort by featured first, then by post count
    forums.sort((a, b) => {
      if (a.isFeatured !== b.isFeatured) return b.isFeatured ? 1 : -1;
      return b.postCount - a.postCount;
    });
    
    const total = forums.length;
    forums = forums.slice(offset, offset + limit);
    
    return { forums, total };
  }
  
  async findForumsByDestination(country, city = null) {
    let forums = Array.from(this.forums.values())
      .filter(f => f.isActive && f.location.country === country);
    
    if (city) {
      forums = forums.filter(f => f.location.city === city);
    }
    
    return forums;
  }
  
  async createTopic(topicData) {
    const topic = new Topic(topicData);
    this.topics.set(topic.id, topic);
    
    // Update forum topic count
    const forum = this.forums.get(topic.forumId);
    if (forum) {
      forum.incrementTopicCount();
    }
    
    if (this.db) {
      await this.db.collection('topics').insertOne(topic.toJSON());
    }
    
    return topic;
  }
  
  async findTopicById(id) {
    return this.topics.get(id) || null;
  }
  
  async findTopicsByForum(forumId, options = {}) {
    const { sortBy = 'newest', limit = 20, offset = 0 } = options;
    
    let topics = Array.from(this.topics.values())
      .filter(t => t.forumId === forumId && t.status === 'active');
    
    // Sort
    if (sortBy === 'newest') {
      topics.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortBy === 'popular') {
      topics.sort((a, b) => b.viewCount - a.viewCount);
    } else if (sortBy === 'replies') {
      topics.sort((a, b) => b.replyCount - a.replyCount);
    } else if (sortBy === 'lastReply') {
      topics.sort((a, b) => (b.lastReplyAt || b.createdAt) - (a.lastReplyAt || a.createdAt));
    }
    
    // Pinned topics first
    topics.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    
    const total = topics.length;
    topics = topics.slice(offset, offset + limit);
    
    return { topics, total };
  }
  
  async searchTopics(query, options = {}) {
    const { limit = 20, offset = 0 } = options;
    
    const lowerQuery = query.toLowerCase();
    let topics = Array.from(this.topics.values())
      .filter(t => t.status === 'active')
      .filter(t => 
        t.title.toLowerCase().includes(lowerQuery) ||
        t.content.toLowerCase().includes(lowerQuery) ||
        t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    
    topics.sort((a, b) => b.createdAt - a.createdAt);
    
    const total = topics.length;
    topics = topics.slice(offset, offset + limit);
    
    return { topics, total };
  }
  
  async createReply(replyData) {
    const reply = new Reply(replyData);
    this.replies.set(reply.id, reply);
    
    // Update topic reply count
    const topic = this.topics.get(reply.topicId);
    if (topic) {
      topic.addReply();
    }
    
    // Update forum post count
    if (topic) {
      const forum = this.forums.get(topic.forumId);
      if (forum) {
        forum.incrementPostCount();
      }
    }
    
    if (this.db) {
      await this.db.collection('replies').insertOne(reply.toJSON());
    }
    
    return reply;
  }
  
  async findRepliesByTopic(topicId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    let replies = Array.from(this.replies.values())
      .filter(r => r.topicId === topicId && !r.isDeleted)
      .sort((a, b) => a.createdAt - b.createdAt);
    
    const total = replies.length;
    replies = replies.slice(offset, offset + limit);
    
    return { replies, total };
  }
  
  async getUserStats(userId) {
    const topics = Array.from(this.topics.values()).filter(t => t.authorId === userId);
    const replies = Array.from(this.replies.values()).filter(r => r.authorId === userId && !r.isDeleted);
    
    const totalVotes = topics.reduce((sum, t) => sum + t.voteCount, 0) +
                       replies.reduce((sum, r) => sum + r.voteCount, 0);
    
    const solutions = replies.filter(r => r.isSolution).length;
    
    return {
      topicCount: topics.length,
      replyCount: replies.length,
      totalVotes,
      solutions,
      reputation: (topics.length * 10) + (replies.length * 5) + totalVotes + (solutions * 25)
    };
  }
}

module.exports = {
  Forum,
  Topic,
  Reply,
  ForumRepository,
  ForumSchema,
  TopicSchema,
  ReplySchema
};
