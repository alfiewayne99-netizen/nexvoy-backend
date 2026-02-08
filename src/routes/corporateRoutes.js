/**
 * Corporate Routes
 * B2B corporate travel management routes
 */

const express = require('express');
const router = express.Router();
const corporateController = require('../controllers/corporateController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Company registration
router.post('/register', corporateController.registerCompany);

// Dashboard
router.get('/:companyId/dashboard', authenticate, corporateController.getDashboardStats);
router.get('/:companyId/bookings', authenticate, corporateController.getRecentBookings);

// Approvals
router.get('/:companyId/approvals/pending', authenticate, corporateController.getPendingApprovals);
router.post('/approvals', authenticate, corporateController.createApproval);
router.post('/approvals/:approvalId/approve', authenticate, corporateController.approveBooking);
router.post('/approvals/:approvalId/reject', authenticate, corporateController.rejectBooking);

// Expense Reports
router.get('/:companyId/expenses', authenticate, corporateController.getExpenseReports);
router.post('/expenses', authenticate, corporateController.submitExpenseReport);
router.post('/expenses/:reportId/approve', authenticate, corporateController.approveExpenseReport);

// Travel Policy
router.get('/:companyId/policy', authenticate, corporateController.getTravelPolicy);
router.put('/:companyId/policy', authenticate, requireAdmin, corporateController.updateTravelPolicy);
router.post('/:companyId/policy/validate', authenticate, corporateController.validateBooking);

// Employee Management
router.get('/:companyId/employees', authenticate, corporateController.getEmployees);
router.post('/:companyId/employees', authenticate, requireAdmin, corporateController.addEmployee);

module.exports = router;
