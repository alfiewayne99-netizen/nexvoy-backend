/**
 * Affiliate Controller
 * Handles creator/affiliate program
 */

const { AffiliateRepository } = require('../models/Affiliate');

const affiliateRepo = new AffiliateRepository();

/**
 * Apply to become an affiliate
 */
exports.apply = async (req, res) => {
  try {
    const applicationData = req.body;
    const creator = await affiliateRepo.apply(applicationData);
    
    res.status(201).json({
      success: true,
      data: {
        creatorId: creator.creatorId,
        status: creator.status,
        appliedAt: creator.appliedAt
      }
    });
  } catch (error) {
    console.error('Failed to apply:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get application status
 */
exports.getApplicationStatus = async (req, res) => {
  try {
    const { email } = req.query;
    // In production, query by email
    
    res.json({
      success: true,
      data: {
        status: 'pending',
        message: 'Application under review'
      }
    });
  } catch (error) {
    console.error('Failed to get status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get creator dashboard
 */
exports.getDashboard = async (req, res) => {
  try {
    const { creatorId } = req.params;
    const creator = await affiliateRepo.getCreator(creatorId);
    
    if (!creator) {
      return res.status(404).json({
        success: false,
        error: 'Creator not found'
      });
    }
    
    const stats = await affiliateRepo.getCreatorStats(creatorId);
    const links = creator.generateTrackingLinks();
    
    res.json({
      success: true,
      data: {
        creator: {
          id: creator.creatorId,
          name: creator.name,
          handle: creator.handle,
          platform: creator.platform,
          tier: creator.tier,
          commissionRate: creator.getEffectiveRate(),
          status: creator.status
        },
        stats: stats || creator.stats,
        trackingLinks: links,
        promoCode: creator.promoCode
      }
    });
  } catch (error) {
    console.error('Failed to get dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get creator stats
 */
exports.getStats = async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { period } = req.query;
    
    const stats = await affiliateRepo.getCreatorStats(creatorId, period);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Failed to get stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get tracking links
 */
exports.getTrackingLinks = async (req, res) => {
  try {
    const { creatorId } = req.params;
    const creator = await affiliateRepo.getCreator(creatorId);
    
    if (!creator) {
      return res.status(404).json({
        success: false,
        error: 'Creator not found'
      });
    }
    
    res.json({
      success: true,
      data: creator.generateTrackingLinks()
    });
  } catch (error) {
    console.error('Failed to get links:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Record click
 */
exports.recordClick = async (req, res) => {
  try {
    const { trackingId } = req.params;
    const clickData = {
      ...req.body,
      trackingId,
      creatorId: req.body.creatorId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      referrerUrl: req.headers.referer
    };
    
    const click = await affiliateRepo.recordClick(clickData);
    
    res.json({
      success: true,
      data: { clickId: click.clickId }
    });
  } catch (error) {
    console.error('Failed to record click:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get bookings
 */
exports.getBookings = async (req, res) => {
  try {
    const { creatorId } = req.params;
    const bookings = Array.from(affiliateRepo.bookings.values())
      .filter(b => b.creatorId === creatorId)
      .sort((a, b) => b.bookingDate - a.bookingDate);
    
    res.json({
      success: true,
      data: bookings.map(b => b.toJSON())
    });
  } catch (error) {
    console.error('Failed to get bookings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get payouts
 */
exports.getPayouts = async (req, res) => {
  try {
    const { creatorId } = req.params;
    const payouts = Array.from(affiliateRepo.payouts.values())
      .filter(p => p.creatorId === creatorId)
      .sort((a, b) => b.createdAt - a.createdAt);
    
    res.json({
      success: true,
      data: payouts
    });
  } catch (error) {
    console.error('Failed to get payouts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Request payout
 */
exports.requestPayout = async (req, res) => {
  try {
    const { creatorId } = req.params;
    const creator = await affiliateRepo.getCreator(creatorId);
    
    if (!creator) {
      return res.status(404).json({
        success: false,
        error: 'Creator not found'
      });
    }
    
    // Check minimum threshold
    const pendingAmount = await affiliateRepo.getPendingPayouts(creatorId);
    if (pendingAmount < creator.payoutThreshold) {
      return res.status(400).json({
        success: false,
        error: `Minimum payout threshold is $${creator.payoutThreshold}`
      });
    }
    
    // Create payout
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const payout = await affiliateRepo.createPayout(creatorId, startOfMonth, now);
    
    res.json({
      success: true,
      data: payout
    });
  } catch (error) {
    console.error('Failed to request payout:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get leaderboard
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const leaderboard = await affiliateRepo.getLeaderboard(parseInt(limit));
    
    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Failed to get leaderboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Approve creator application (admin)
 */
exports.approveCreator = async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { adminId } = req.body;
    
    const creator = await affiliateRepo.approve(creatorId, adminId);
    
    if (!creator) {
      return res.status(404).json({
        success: false,
        error: 'Creator not found'
      });
    }
    
    res.json({
      success: true,
      data: creator.toJSON()
    });
  } catch (error) {
    console.error('Failed to approve creator:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get marketing assets
 */
exports.getAssets = async (req, res) => {
  try {
    const { creatorId } = req.params;
    const creator = await affiliateRepo.getCreator(creatorId);
    
    if (!creator) {
      return res.status(404).json({
        success: false,
        error: 'Creator not found'
      });
    }
    
    // Return asset URLs based on creator tier
    const assets = {
      logos: creator.assetsAccess.logos ? [
        { name: 'Logo - Primary', url: '/assets/logos/nexvoy-primary.png' },
        { name: 'Logo - White', url: '/assets/logos/nexvoy-white.png' }
      ] : [],
      templates: creator.assetsAccess.templates ? [
        { name: 'Instagram Story', url: '/assets/templates/instagram-story.psd' },
        { name: 'TikTok Template', url: '/assets/templates/tiktok-template.psd' }
      ] : [],
      photos: creator.assetsAccess.photos ? [
        { name: 'Destination Photos', url: '/assets/photos/destinations.zip' }
      ] : [],
      videos: creator.assetsAccess.videos ? [
        { name: 'B-Roll Footage', url: '/assets/videos/broll.zip' }
      ] : []
    };
    
    res.json({
      success: true,
      data: assets
    });
  } catch (error) {
    console.error('Failed to get assets:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
