/**
 * Corporate Controller
 * Handles B2B corporate travel management
 */

const { CorporateRepository } = require('../models/Corporate');

const corporateRepo = new CorporateRepository();

/**
 * Register a new corporate account
 */
exports.registerCompany = async (req, res) => {
  try {
    const companyData = req.body;
    const company = await corporateRepo.registerCompany(companyData);
    
    res.status(201).json({
      success: true,
      data: company.toJSON()
    });
  } catch (error) {
    console.error('Failed to register company:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get company dashboard stats
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const { companyId } = req.params;
    const stats = await corporateRepo.getCompanyStats(companyId, req.query.period);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Failed to get dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get recent bookings for company
 */
exports.getRecentBookings = async (req, res) => {
  try {
    const { companyId } = req.params;
    // This would typically fetch from BookingRepository with company filter
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    console.error('Failed to get recent bookings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get pending approvals
 */
exports.getPendingApprovals = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { approverId } = req.query;
    
    const approvals = await corporateRepo.getPendingApprovals(companyId, approverId);
    
    res.json({
      success: true,
      data: approvals.map(a => a.toJSON())
    });
  } catch (error) {
    console.error('Failed to get pending approvals:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Create booking approval request
 */
exports.createApproval = async (req, res) => {
  try {
    const approvalData = req.body;
    const approval = await corporateRepo.createApproval(approvalData);
    
    res.status(201).json({
      success: true,
      data: approval.toJSON()
    });
  } catch (error) {
    console.error('Failed to create approval:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Approve booking
 */
exports.approveBooking = async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { approverId, notes } = req.body;
    
    const approval = corporateRepo.approvals.get(approvalId);
    if (!approval) {
      return res.status(404).json({
        success: false,
        error: 'Approval not found'
      });
    }
    
    approval.approve(approverId, notes);
    
    res.json({
      success: true,
      data: approval.toJSON()
    });
  } catch (error) {
    console.error('Failed to approve booking:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Reject booking
 */
exports.rejectBooking = async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { approverId, reason } = req.body;
    
    const approval = corporateRepo.approvals.get(approvalId);
    if (!approval) {
      return res.status(404).json({
        success: false,
        error: 'Approval not found'
      });
    }
    
    approval.reject(approverId, reason);
    
    res.json({
      success: true,
      data: approval.toJSON()
    });
  } catch (error) {
    console.error('Failed to reject booking:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get expense reports
 */
exports.getExpenseReports = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { employeeId, status } = req.query;
    
    const reports = await corporateRepo.getExpenseReports(companyId, employeeId, status);
    
    res.json({
      success: true,
      data: reports.map(r => r.toJSON())
    });
  } catch (error) {
    console.error('Failed to get expense reports:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Submit expense report
 */
exports.submitExpenseReport = async (req, res) => {
  try {
    const reportData = req.body;
    const report = await corporateRepo.createExpenseReport(reportData);
    
    res.status(201).json({
      success: true,
      data: report.toJSON()
    });
  } catch (error) {
    console.error('Failed to submit expense report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Approve expense report
 */
exports.approveExpenseReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { reviewerId } = req.body;
    
    const report = corporateRepo.expenseReports.get(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }
    
    report.approve(reviewerId);
    
    res.json({
      success: true,
      data: report.toJSON()
    });
  } catch (error) {
    console.error('Failed to approve expense report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get travel policy
 */
exports.getTravelPolicy = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await corporateRepo.getCompany(companyId);
    
    if (!company || !company.travelPolicy.policyId) {
      return res.json({
        success: true,
        data: null
      });
    }
    
    const policy = corporateRepo.policies.get(company.travelPolicy.policyId);
    
    res.json({
      success: true,
      data: policy ? policy.toJSON() : null
    });
  } catch (error) {
    console.error('Failed to get travel policy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Update travel policy
 */
exports.updateTravelPolicy = async (req, res) => {
  try {
    const { companyId } = req.params;
    const policyData = req.body;
    
    const policy = await corporateRepo.createPolicy({
      ...policyData,
      companyId
    });
    
    res.json({
      success: true,
      data: policy.toJSON()
    });
  } catch (error) {
    console.error('Failed to update travel policy:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Validate booking against policy
 */
exports.validateBooking = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { bookingType, details } = req.body;
    
    const company = await corporateRepo.getCompany(companyId);
    if (!company || !company.travelPolicy.policyId) {
      return res.json({
        success: true,
        data: { compliant: true, violations: [] }
      });
    }
    
    const policy = corporateRepo.policies.get(company.travelPolicy.policyId);
    if (!policy) {
      return res.json({
        success: true,
        data: { compliant: true, violations: [] }
      });
    }
    
    const result = policy.validateBooking(bookingType, details);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Failed to validate booking:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get company employees
 */
exports.getEmployees = async (req, res) => {
  try {
    const { companyId } = req.params;
    const employees = await corporateRepo.getEmployeesByCompany(companyId);
    
    res.json({
      success: true,
      data: employees.map(e => e.toJSON())
    });
  } catch (error) {
    console.error('Failed to get employees:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Add employee
 */
exports.addEmployee = async (req, res) => {
  try {
    const { companyId } = req.params;
    const employeeData = req.body;
    
    const employee = await corporateRepo.addEmployee({
      ...employeeData,
      companyId
    });
    
    res.status(201).json({
      success: true,
      data: employee.toJSON()
    });
  } catch (error) {
    console.error('Failed to add employee:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
