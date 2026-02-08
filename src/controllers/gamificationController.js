/**
 * Gamification Controller
 * Handles badges, challenges, and leaderboards
 */

const badges = [
  { id: 'B001', name: 'First Steps', description: 'Make your first booking', category: 'booking', rarity: 'common', points: 100 },
  { id: 'B002', name: 'Frequent Flyer', description: 'Book 10 flights', category: 'booking', rarity: 'rare', points: 500 },
  { id: 'B003', name: 'Hotel Hero', description: 'Stay at 5 hotels', category: 'booking', rarity: 'common', points: 200 },
  { id: 'B004', name: 'Explorer', description: 'Visit 3 countries', category: 'exploration', rarity: 'rare', points: 750 },
  { id: 'B005', name: 'World Traveler', description: 'Visit 10 countries', category: 'exploration', rarity: 'epic', points: 2500 },
  { id: 'B006', name: 'Deal Hunter', description: 'Save $100 on a booking', category: 'savings', rarity: 'common', points: 200 },
  { id: 'B007', name: 'Smart Saver', description: 'Save $500 total', category: 'savings', rarity: 'rare', points: 750 },
  { id: 'B008', name: 'Member', description: 'Join Nexvoy', category: 'loyalty', rarity: 'common', points: 50 },
  { id: 'B009', name: 'Nexvoy Legend', description: 'Earn 50,000 lifetime points', category: 'loyalty', rarity: 'legendary', points: 10000 }
];

const challenges = [
  {
    id: 'C001',
    name: 'Weekend Warrior',
    description: 'Book a trip for this weekend',
    type: 'booking',
    reward: { points: 500 },
    target: 1,
    difficulty: 'easy'
  },
  {
    id: 'C002',
    name: 'Referral Rush',
    description: 'Refer 3 friends who complete their first booking',
    type: 'referral',
    reward: { points: 2000, badge: 'Social Butterfly' },
    target: 3,
    difficulty: 'medium'
  },
  {
    id: 'C003',
    name: 'Streak Master',
    description: 'Maintain a 14-day booking streak',
    type: 'streak',
    reward: { points: 1000, badge: 'Dedicated' },
    target: 14,
    difficulty: 'hard'
  }
];

/**
 * Get user gamification progress
 */
exports.getUserProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // In production, fetch from database
    res.json({
      success: true,
      data: {
        badges: [],
        challenges: [],
        stats: {
          totalBadges: 0,
          completedChallenges: 0,
          currentStreak: 0
        }
      }
    });
  } catch (error) {
    console.error('Failed to get progress:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get user badges
 */
exports.getBadges = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // In production, fetch from database
    res.json({
      success: true,
      data: {
        earned: [],
        inProgress: []
      }
    });
  } catch (error) {
    console.error('Failed to get badges:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get all available badges
 */
exports.getAllBadges = async (req, res) => {
  try {
    res.json({
      success: true,
      data: badges
    });
  } catch (error) {
    console.error('Failed to get badges:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get challenges
 */
exports.getChallenges = async (req, res) => {
  try {
    const { userId } = req.params;
    
    res.json({
      success: true,
      data: {
        active: challenges,
        completed: [],
        upcoming: []
      }
    });
  } catch (error) {
    console.error('Failed to get challenges:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Claim challenge reward
 */
exports.claimChallenge = async (req, res) => {
  try {
    const { userId, challengeId } = req.params;
    
    res.json({
      success: true,
      data: {
        message: 'Challenge claimed successfully',
        pointsAwarded: 500
      }
    });
  } catch (error) {
    console.error('Failed to claim challenge:', error);
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
    const { period = 'monthly' } = req.query;
    
    // Mock leaderboard data
    const leaderboard = [
      { rank: 1, name: 'Sarah M.', tier: 'platinum', points: 89250, avatar: 'S' },
      { rank: 2, name: 'Mike T.', tier: 'platinum', points: 78400, avatar: 'M' },
      { rank: 3, name: 'Emma L.', tier: 'gold', points: 52300, avatar: 'E' },
      { rank: 4, name: 'John D.', tier: 'gold', points: 48900, avatar: 'J' },
      { rank: 5, name: 'Alex K.', tier: 'gold', points: 45600, avatar: 'A' }
    ];
    
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
 * Get exclusive deals
 */
exports.getExclusiveDeals = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const deals = [
      { id: 'D1', title: 'Gold Member Exclusive', discount: '20% off', description: 'Any flight booking', requiredTier: 'gold', expiresIn: '2 days' },
      { id: 'D2', title: 'Double Points Weekend', discount: '2x Points', description: 'All bookings this weekend', requiredTier: 'silver', expiresIn: '3 days' },
      { id: 'D3', title: 'Free Upgrade', discount: 'FREE', description: 'Hotel room upgrade', requiredTier: 'gold', expiresIn: '5 days' }
    ];
    
    res.json({
      success: true,
      data: deals
    });
  } catch (error) {
    console.error('Failed to get deals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Claim exclusive deal
 */
exports.claimDeal = async (req, res) => {
  try {
    const { userId, dealId } = req.params;
    
    res.json({
      success: true,
      data: {
        message: 'Deal claimed successfully',
        dealId
      }
    });
  } catch (error) {
    console.error('Failed to claim deal:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get streak
 */
exports.getStreak = async (req, res) => {
  try {
    const { userId } = req.params;
    
    res.json({
      success: true,
      data: {
        current: 12,
        longest: 28,
        lastActivity: '2024-02-05'
      }
    });
  } catch (error) {
    console.error('Failed to get streak:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Award badge to user
 */
exports.awardBadge = async (req, res) => {
  try {
    const { userId } = req.params;
    const { badgeId } = req.body;
    
    const badge = badges.find(b => b.id === badgeId);
    
    res.json({
      success: true,
      data: {
        message: 'Badge awarded successfully',
        badge: badge || { id: badgeId }
      }
    });
  } catch (error) {
    console.error('Failed to award badge:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
