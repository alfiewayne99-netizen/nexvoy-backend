const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

/**
 * Admin Routes - ALL routes require authentication AND admin role
 * 
 * Security: 
 * - authenticate: Validates JWT token, no bypass possible
 * - authorize('admin'): Ensures user has admin role
 */

// Apply authentication and admin authorization to ALL routes
router.use(authenticate);
router.use(authorize('admin'));

/**
 * GET /api/admin/dashboard
 * Admin dashboard stats
 */
router.get('/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Admin dashboard',
      adminUser: req.user.email,
      stats: {
        totalUsers: 150,
        activeUsers: 89,
        totalBookings: 342,
        revenue: 125000
      }
    }
  });
});

/**
 * GET /api/admin/users
 * List all users
 */
router.get('/users', (req, res) => {
  // In production, fetch from database with pagination
  const users = [
    { id: 'user-001', email: 'user@nexvoy.com', role: 'user', name: 'Regular User' },
    { id: 'user-002', email: 'user2@nexvoy.com', role: 'user', name: 'User Two' },
    { id: 'admin-001', email: 'admin@nexvoy.com', role: 'admin', name: 'Admin User' }
  ];

  res.json({
    success: true,
    data: {
      users,
      total: users.length,
      page: 1,
      limit: 10
    }
  });
});

/**
 * GET /api/admin/users/:id
 * Get specific user details
 */
router.get('/users/:id', (req, res) => {
  const { id } = req.params;
  
  // In production, fetch from database
  const user = {
    id: id,
    email: 'user@nexvoy.com',
    role: 'user',
    name: 'Regular User',
    createdAt: '2024-01-15T10:30:00Z',
    lastLogin: '2024-02-01T14:20:00Z',
    isActive: true
  };

  res.json({
    success: true,
    data: { user }
  });
});

/**
 * PUT /api/admin/users/:id
 * Update user
 */
router.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // In production, update in database
  res.json({
    success: true,
    message: 'User updated successfully',
    data: {
      userId: id,
      updates: Object.keys(updates)
    }
  });
});

/**
 * DELETE /api/admin/users/:id
 * Delete user
 */
router.delete('/users/:id', (req, res) => {
  const { id } = req.params;

  // Prevent self-deletion
  if (id === req.user.userId) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete your own account',
      code: 'SELF_DELETE_FORBIDDEN'
    });
  }

  // In production, delete from database
  res.json({
    success: true,
    message: 'User deleted successfully',
    data: { userId: id }
  });
});

/**
 * GET /api/admin/bookings
 * List all bookings
 */
router.get('/bookings', (req, res) => {
  const bookings = [
    { id: 'booking-001', userId: 'user-001', destination: 'Paris', amount: 1200, status: 'confirmed' },
    { id: 'booking-002', userId: 'user-002', destination: 'Tokyo', amount: 2500, status: 'pending' },
    { id: 'booking-003', userId: 'user-001', destination: 'London', amount: 800, status: 'cancelled' }
  ];

  res.json({
    success: true,
    data: {
      bookings,
      total: bookings.length,
      page: 1,
      limit: 10
    }
  });
});

/**
 * GET /api/admin/settings
 * Get admin settings
 */
router.get('/settings', (req, res) => {
  res.json({
    success: true,
    data: {
      settings: {
        siteName: 'Nexvoy',
        maintenanceMode: false,
        maxBookingsPerUser: 5,
        bookingTimeout: 900 // 15 minutes
      }
    }
  });
});

/**
 * PUT /api/admin/settings
 * Update admin settings
 */
router.put('/settings', (req, res) => {
  const newSettings = req.body;

  res.json({
    success: true,
    message: 'Settings updated successfully',
    data: { settings: newSettings }
  });
});

/**
 * GET /api/admin/audit-log
 * View audit log
 */
router.get('/audit-log', (req, res) => {
  const logs = [
    { id: 'log-001', action: 'USER_LOGIN', userId: 'user-001', timestamp: '2024-02-01T10:00:00Z', ip: '192.168.1.1' },
    { id: 'log-002', action: 'BOOKING_CREATED', userId: 'user-002', timestamp: '2024-02-01T11:30:00Z', ip: '192.168.1.2' },
    { id: 'log-003', action: 'USER_DELETED', userId: 'admin-001', timestamp: '2024-02-01T12:00:00Z', ip: '192.168.1.3' }
  ];

  res.json({
    success: true,
    data: {
      logs,
      total: logs.length,
      page: 1,
      limit: 50
    }
  });
});

module.exports = router;
