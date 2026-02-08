/**
 * B2B Corporate Model for Nexvoy
 * Handles corporate accounts, employee management, travel policies, and approvals
 */

const crypto = require('crypto');

/**
 * Corporate Account Schema
 */
const CorporateAccountSchema = {
  companyId: { type: String, required: true, unique: true },
  
  // Company details
  companyName: { type: String, required: true },
  legalName: { type: String },
  taxId: { type: String },
  industry: { type: String },
  companySize: { type: String, enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] },
  website: { type: String },
  
  // Address
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postalCode: { type: String }
  },
  
  // Billing
  billingEmail: { type: String },
  billingAddress: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postalCode: { type: String }
  },
  paymentTerms: { type: String, enum: ['immediate', 'net15', 'net30', 'net60'], default: 'net30' },
  creditLimit: { type: Number, default: 0 },
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'active', 'suspended', 'cancelled'],
    default: 'pending'
  },
  
  // Subscription
  plan: { 
    type: String, 
    enum: ['basic', 'professional', 'enterprise'],
    default: 'basic'
  },
  subscriptionStart: { type: Date },
  subscriptionEnd: { type: Date },
  
  // Admin users
  primaryAdminId: { type: String, required: true },
  adminIds: [{ type: String }],
  
  // Travel policy
  travelPolicy: {
    policyId: { type: String },
    enabled: { type: Boolean, default: true }
  },
  
  // Settings
  settings: {
    requireApproval: { type: Boolean, default: true },
    approvalThreshold: { type: Number, default: 500 }, // $500
    allowPersonalTravel: { type: Boolean, default: false },
    allowFamilyTravel: { type: Boolean, default: false },
    preferredAirlines: [{ type: String }],
    preferredHotels: [{ type: String }],
    preferredCarCompanies: [{ type: String }]
  },
  
  // Statistics
  stats: {
    totalEmployees: { type: Number, default: 0 },
    activeEmployees: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    totalSpend: { type: Number, default: 0 },
    ytdSpend: { type: Number, default: 0 }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
};

/**
 * Corporate Employee Schema
 */
const CorporateEmployeeSchema = {
  employeeId: { type: String, required: true, unique: true },
  companyId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  
  // Employee info
  employeeNumber: { type: String },
  department: { type: String },
  jobTitle: { type: String },
  managerId: { type: String },
  
  // Travel privileges
  travelClass: { 
    type: String, 
    enum: ['economy', 'premium_economy', 'business', 'first'],
    default: 'economy'
  },
  hotelCategory: { 
    type: String, 
    enum: ['budget', 'standard', 'premium', 'luxury'],
    default: 'standard'
  },
  
  // Spending limits
  dailyAllowance: { type: Number, default: 0 },
  tripAllowance: { type: Number, default: 0 },
  monthlyAllowance: { type: Number, default: 0 },
  
  // Approval workflow
  requiresApproval: { type: Boolean, default: true },
  approverId: { type: String },
  
  // Status
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  
  // Spending tracking
  spending: {
    currentMonth: { type: Number, default: 0 },
    currentQuarter: { type: Number, default: 0 },
    ytd: { type: Number, default: 0 }
  },
  
  addedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
};

/**
 * Travel Policy Schema
 */
const TravelPolicySchema = {
  policyId: { type: String, required: true, unique: true },
  companyId: { type: String, required: true },
  
  // Policy basics
  name: { type: String, required: true },
  description: { type: String },
  isDefault: { type: Boolean, default: false },
  
  // Flight policies
  flights: {
    enabled: { type: Boolean, default: true },
    maxPrice: { type: Number },
    advanceBookingDays: { type: Number, default: 14 },
    preferredAirlines: [{ type: String }],
    allowedClasses: [{ 
      type: String, 
      enum: ['economy', 'premium_economy', 'business', 'first'] 
    }],
    maxFlightDuration: { type: Number }, // hours
    requireApprovalOver: { type: Number }
  },
  
  // Hotel policies
  hotels: {
    enabled: { type: Boolean, default: true },
    maxPricePerNight: { type: Number },
    maxStars: { type: Number },
    preferredChains: [{ type: String }],
    requireApprovalOver: { type: Number }
  },
  
  // Car rental policies
  carRentals: {
    enabled: { type: Boolean, default: true },
    maxPricePerDay: { type: Number },
    allowedCategories: [{ 
      type: String, 
      enum: ['economy', 'compact', 'midsize', 'fullsize', 'suv'] 
    }],
    requireApprovalOver: { type: Number }
  },
  
  // Expense policies
  expenses: {
    enabled: { type: Boolean, default: true },
    maxDailyMeals: { type: Number, default: 75 },
    maxDailyGroundTransport: { type: Number, default: 100 },
    maxDailyIncidentals: { type: Number, default: 25 },
    receiptRequiredOver: { type: Number, default: 25 }
  },
  
  // Approval workflow
  approvalWorkflow: {
    enabled: { type: Boolean, default: true },
    autoApproveUnder: { type: Number, default: 500 },
    requireManagerApprovalOver: { type: Number, default: 1000 },
    requireFinanceApprovalOver: { type: Number, default: 5000 },
    escalationDays: { type: Number, default: 3 }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
};

/**
 * Booking Approval Schema
 */
const BookingApprovalSchema = {
  approvalId: { type: String, required: true, unique: true },
  bookingId: { type: String, required: true },
  companyId: { type: String, required: true },
  employeeId: { type: String, required: true },
  
  // Request details
  requestedAt: { type: Date, default: Date.now },
  requestedBy: { type: String },
  
  // Booking summary
  tripPurpose: { type: String },
  destination: { type: String },
  departureDate: { type: Date },
  returnDate: { type: Date },
  estimatedCost: { type: Number },
  currency: { type: String, default: 'USD' },
  
  // Policy compliance
  policyCompliant: { type: Boolean, default: true },
  violations: [{
    rule: { type: String },
    expected: { type: String },
    actual: { type: String }
  }],
  
  // Approval workflow
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'escalated', 'cancelled'],
    default: 'pending'
  },
  currentApproverId: { type: String },
  
  // Approval chain
  approvals: [{
    approverId: { type: String },
    level: { type: Number },
    status: { type: String, enum: ['pending', 'approved', 'rejected'] },
    decidedAt: { type: Date },
    comments: { type: String }
  }],
  
  // Final decision
  decidedAt: { type: Date },
  decidedBy: { type: String },
  comments: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
};

/**
 * Expense Report Schema
 */
const ExpenseReportSchema = {
  reportId: { type: String, required: true, unique: true },
  companyId: { type: String, required: true },
  employeeId: { type: String, required: true },
  
  // Report details
  tripName: { type: String },
  tripPurpose: { type: String },
  destination: { type: String },
  startDate: { type: Date },
  endDate: { type: Date },
  
  // Expenses
  expenses: [{
    expenseId: { type: String },
    date: { type: Date },
    category: { 
      type: String, 
      enum: ['flight', 'hotel', 'car', 'meal', 'transport', 'entertainment', 'other'] 
    },
    description: { type: String },
    amount: { type: Number },
    currency: { type: String, default: 'USD' },
    receiptUrl: { type: String },
    policyCompliant: { type: Boolean, default: true },
    violations: [{ type: String }]
  }],
  
  // Totals
  totalAmount: { type: Number, default: 0 },
  reimbursableAmount: { type: Number, default: 0 },
  
  // Status
  status: { 
    type: String, 
    enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'reimbursed'],
    default: 'draft'
  },
  
  // Approval
  submittedAt: { type: Date },
  reviewedBy: { type: String },
  reviewedAt: { type: Date },
  comments: { type: String },
  
  // Reimbursement
  reimbursementMethod: { type: String, enum: ['payroll', 'direct_deposit', 'check'] },
  reimbursedAt: { type: Date },
  reimbursementReference: { type: String },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
};

/**
 * Corporate Account Class
 */
class CorporateAccount {
  constructor(data = {}) {
    this.companyId = data.companyId || crypto.randomUUID();
    this.companyName = data.companyName;
    this.legalName = data.legalName || data.companyName;
    this.taxId = data.taxId || '';
    this.industry = data.industry || '';
    this.companySize = data.companySize || '1-10';
    this.website = data.website || '';
    this.address = data.address || {};
    this.billingEmail = data.billingEmail || '';
    this.billingAddress = data.billingAddress || {};
    this.paymentTerms = data.paymentTerms || 'net30';
    this.creditLimit = data.creditLimit || 0;
    this.status = data.status || 'pending';
    this.plan = data.plan || 'basic';
    this.subscriptionStart = data.subscriptionStart || null;
    this.subscriptionEnd = data.subscriptionEnd || null;
    this.primaryAdminId = data.primaryAdminId;
    this.adminIds = data.adminIds || [];
    this.travelPolicy = data.travelPolicy || { enabled: false };
    this.settings = data.settings || {
      requireApproval: true,
      approvalThreshold: 500,
      allowPersonalTravel: false,
      allowFamilyTravel: false,
      preferredAirlines: [],
      preferredHotels: [],
      preferredCarCompanies: []
    };
    this.stats = data.stats || {
      totalEmployees: 0,
      activeEmployees: 0,
      totalBookings: 0,
      totalSpend: 0,
      ytdSpend: 0
    };
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }
  
  /**
   * Activate account
   */
  activate() {
    this.status = 'active';
    this.subscriptionStart = new Date();
    this.updatedAt = new Date();
  }
  
  /**
   * Update spending stats
   */
  updateStats(amount) {
    this.stats.totalSpend += amount;
    this.stats.ytdSpend += amount;
    this.updatedAt = new Date();
  }
  
  /**
   * Check if booking requires approval
   */
  requiresApproval(amount, employeeId) {
    if (!this.settings.requireApproval) return false;
    return amount > this.settings.approvalThreshold;
  }
  
  toJSON() {
    return {
      companyId: this.companyId,
      companyName: this.companyName,
      legalName: this.legalName,
      taxId: this.taxId,
      industry: this.industry,
      companySize: this.companySize,
      website: this.website,
      address: this.address,
      billingEmail: this.billingEmail,
      billingAddress: this.billingAddress,
      paymentTerms: this.paymentTerms,
      creditLimit: this.creditLimit,
      status: this.status,
      plan: this.plan,
      subscriptionStart: this.subscriptionStart,
      subscriptionEnd: this.subscriptionEnd,
      primaryAdminId: this.primaryAdminId,
      adminIds: this.adminIds,
      travelPolicy: this.travelPolicy,
      settings: this.settings,
      stats: this.stats,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Corporate Employee Class
 */
class CorporateEmployee {
  constructor(data = {}) {
    this.employeeId = data.employeeId || crypto.randomUUID();
    this.companyId = data.companyId;
    this.userId = data.userId;
    this.employeeNumber = data.employeeNumber || '';
    this.department = data.department || '';
    this.jobTitle = data.jobTitle || '';
    this.managerId = data.managerId || null;
    this.travelClass = data.travelClass || 'economy';
    this.hotelCategory = data.hotelCategory || 'standard';
    this.dailyAllowance = data.dailyAllowance || 0;
    this.tripAllowance = data.tripAllowance || 0;
    this.monthlyAllowance = data.monthlyAllowance || 0;
    this.requiresApproval = data.requiresApproval !== false;
    this.approverId = data.approverId || null;
    this.status = data.status || 'active';
    this.spending = data.spending || {
      currentMonth: 0,
      currentQuarter: 0,
      ytd: 0
    };
    this.addedAt = data.addedAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }
  
  /**
   * Record spending
   */
  recordSpending(amount) {
    this.spending.currentMonth += amount;
    this.spending.currentQuarter += amount;
    this.spending.ytd += amount;
    this.updatedAt = new Date();
  }
  
  /**
   * Check if over budget
   */
  isOverBudget() {
    if (this.monthlyAllowance > 0 && this.spending.currentMonth > this.monthlyAllowance) {
      return true;
    }
    return false;
  }
  
  toJSON() {
    return {
      employeeId: this.employeeId,
      companyId: this.companyId,
      userId: this.userId,
      employeeNumber: this.employeeNumber,
      department: this.department,
      jobTitle: this.jobTitle,
      managerId: this.managerId,
      travelClass: this.travelClass,
      hotelCategory: this.hotelCategory,
      dailyAllowance: this.dailyAllowance,
      tripAllowance: this.tripAllowance,
      monthlyAllowance: this.monthlyAllowance,
      requiresApproval: this.requiresApproval,
      approverId: this.approverId,
      status: this.status,
      spending: this.spending,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Travel Policy Class
 */
class TravelPolicy {
  constructor(data = {}) {
    this.policyId = data.policyId || crypto.randomUUID();
    this.companyId = data.companyId;
    this.name = data.name || 'Default Policy';
    this.description = data.description || '';
    this.isDefault = data.isDefault || false;
    this.flights = data.flights || {
      enabled: true,
      advanceBookingDays: 14,
      allowedClasses: ['economy'],
      preferredAirlines: []
    };
    this.hotels = data.hotels || {
      enabled: true,
      preferredChains: []
    };
    this.carRentals = data.carRentals || {
      enabled: true,
      allowedCategories: ['economy', 'compact']
    };
    this.expenses = data.expenses || {
      enabled: true,
      maxDailyMeals: 75,
      maxDailyGroundTransport: 100,
      maxDailyIncidentals: 25,
      receiptRequiredOver: 25
    };
    this.approvalWorkflow = data.approvalWorkflow || {
      enabled: true,
      autoApproveUnder: 500,
      requireManagerApprovalOver: 1000,
      requireFinanceApprovalOver: 5000,
      escalationDays: 3
    };
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }
  
  /**
   * Validate booking against policy
   */
  validateBooking(bookingType, details) {
    const violations = [];
    
    if (bookingType === 'flight' && this.flights.enabled) {
      // Check advance booking
      if (this.flights.advanceBookingDays) {
        const daysUntilDeparture = Math.ceil(
          (new Date(details.departureDate) - new Date()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilDeparture < this.flights.advanceBookingDays) {
          violations.push({
            rule: 'Advance Booking',
            expected: `${this.flights.advanceBookingDays} days`,
            actual: `${daysUntilDeparture} days`
          });
        }
      }
      
      // Check cabin class
      if (this.flights.allowedClasses && !this.flights.allowedClasses.includes(details.cabinClass)) {
        violations.push({
          rule: 'Cabin Class',
          expected: this.flights.allowedClasses.join(', '),
          actual: details.cabinClass
        });
      }
      
      // Check price limit
      if (this.flights.maxPrice && details.price > this.flights.maxPrice) {
        violations.push({
          rule: 'Price Limit',
          expected: `$${this.flights.maxPrice}`,
          actual: `$${details.price}`
        });
      }
    }
    
    if (bookingType === 'hotel' && this.hotels.enabled) {
      if (this.hotels.maxPricePerNight && details.pricePerNight > this.hotels.maxPricePerNight) {
        violations.push({
          rule: 'Price Per Night',
          expected: `$${this.hotels.maxPricePerNight}`,
          actual: `$${details.pricePerNight}`
        });
      }
    }
    
    return {
      compliant: violations.length === 0,
      violations
    };
  }
  
  toJSON() {
    return {
      policyId: this.policyId,
      companyId: this.companyId,
      name: this.name,
      description: this.description,
      isDefault: this.isDefault,
      flights: this.flights,
      hotels: this.hotels,
      carRentals: this.carRentals,
      expenses: this.expenses,
      approvalWorkflow: this.approvalWorkflow,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Booking Approval Class
 */
class BookingApproval {
  constructor(data = {}) {
    this.approvalId = data.approvalId || crypto.randomUUID();
    this.bookingId = data.bookingId;
    this.companyId = data.companyId;
    this.employeeId = data.employeeId;
    this.requestedAt = data.requestedAt || new Date();
    this.requestedBy = data.requestedBy;
    this.tripPurpose = data.tripPurpose || '';
    this.destination = data.destination || '';
    this.departureDate = data.departureDate;
    this.returnDate = data.returnDate;
    this.estimatedCost = data.estimatedCost;
    this.currency = data.currency || 'USD';
    this.policyCompliant = data.policyCompliant !== false;
    this.violations = data.violations || [];
    this.status = data.status || 'pending';
    this.currentApproverId = data.currentApproverId || null;
    this.approvals = data.approvals || [];
    this.decidedAt = data.decidedAt || null;
    this.decidedBy = data.decidedBy || null;
    this.comments = data.comments || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }
  
  /**
   * Approve booking
   */
  approve(approverId, comments = '') {
    this.status = 'approved';
    this.decidedAt = new Date();
    this.decidedBy = approverId;
    this.comments = comments;
    this.updatedAt = new Date();
  }
  
  /**
   * Reject booking
   */
  reject(approverId, comments = '') {
    this.status = 'rejected';
    this.decidedAt = new Date();
    this.decidedBy = approverId;
    this.comments = comments;
    this.updatedAt = new Date();
  }
  
  toJSON() {
    return {
      approvalId: this.approvalId,
      bookingId: this.bookingId,
      companyId: this.companyId,
      employeeId: this.employeeId,
      requestedAt: this.requestedAt,
      requestedBy: this.requestedBy,
      tripPurpose: this.tripPurpose,
      destination: this.destination,
      departureDate: this.departureDate,
      returnDate: this.returnDate,
      estimatedCost: this.estimatedCost,
      currency: this.currency,
      policyCompliant: this.policyCompliant,
      violations: this.violations,
      status: this.status,
      currentApproverId: this.currentApproverId,
      approvals: this.approvals,
      decidedAt: this.decidedAt,
      decidedBy: this.decidedBy,
      comments: this.comments,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Expense Report Class
 */
class ExpenseReport {
  constructor(data = {}) {
    this.reportId = data.reportId || crypto.randomUUID();
    this.companyId = data.companyId;
    this.employeeId = data.employeeId;
    this.tripName = data.tripName || '';
    this.tripPurpose = data.tripPurpose || '';
    this.destination = data.destination || '';
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.expenses = data.expenses || [];
    this.totalAmount = data.totalAmount || 0;
    this.reimbursableAmount = data.reimbursableAmount || 0;
    this.status = data.status || 'draft';
    this.submittedAt = data.submittedAt || null;
    this.reviewedBy = data.reviewedBy || null;
    this.reviewedAt = data.reviewedAt || null;
    this.comments = data.comments || '';
    this.reimbursementMethod = data.reimbursementMethod || 'direct_deposit';
    this.reimbursedAt = data.reimbursedAt || null;
    this.reimbursementReference = data.reimbursementReference || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }
  
  /**
   * Add expense
   */
  addExpense(expense) {
    this.expenses.push({
      expenseId: crypto.randomUUID(),
      ...expense
    });
    this.recalculateTotals();
    this.updatedAt = new Date();
  }
  
  /**
   * Recalculate totals
   */
  recalculateTotals() {
    this.totalAmount = this.expenses.reduce((sum, e) => sum + e.amount, 0);
    this.reimbursableAmount = this.expenses
      .filter(e => e.policyCompliant !== false)
      .reduce((sum, e) => sum + e.amount, 0);
  }
  
  /**
   * Submit report
   */
  submit() {
    this.status = 'submitted';
    this.submittedAt = new Date();
    this.updatedAt = new Date();
  }
  
  /**
   * Approve report
   */
  approve(reviewerId, comments = '') {
    this.status = 'approved';
    this.reviewedBy = reviewerId;
    this.reviewedAt = new Date();
    this.comments = comments;
    this.updatedAt = new Date();
  }
  
  /**
   * Reject report
   */
  reject(reviewerId, comments = '') {
    this.status = 'rejected';
    this.reviewedBy = reviewerId;
    this.reviewedAt = new Date();
    this.comments = comments;
    this.updatedAt = new Date();
  }
  
  /**
   * Mark as reimbursed
   */
  markReimbursed(reference) {
    this.status = 'reimbursed';
    this.reimbursedAt = new Date();
    this.reimbursementReference = reference;
    this.updatedAt = new Date();
  }
  
  toJSON() {
    return {
      reportId: this.reportId,
      companyId: this.companyId,
      employeeId: this.employeeId,
      tripName: this.tripName,
      tripPurpose: this.tripPurpose,
      destination: this.destination,
      startDate: this.startDate,
      endDate: this.endDate,
      expenses: this.expenses,
      totalAmount: this.totalAmount,
      reimbursableAmount: this.reimbursableAmount,
      status: this.status,
      submittedAt: this.submittedAt,
      reviewedBy: this.reviewedBy,
      reviewedAt: this.reviewedAt,
      comments: this.comments,
      reimbursementMethod: this.reimbursementMethod,
      reimbursedAt: this.reimbursedAt,
      reimbursementReference: this.reimbursementReference,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Corporate Repository
 */
class CorporateRepository {
  constructor(database = null) {
    this.db = database;
    this.companies = new Map();
    this.employees = new Map();
    this.policies = new Map();
    this.approvals = new Map();
    this.expenseReports = new Map();
  }
  
  /**
   * Register company
   */
  async registerCompany(data) {
    const company = new CorporateAccount(data);
    this.companies.set(company.companyId, company);
    
    if (this.db) {
      await this.db.collection('corporate_accounts').insertOne(company.toJSON());
    }
    
    return company;
  }
  
  /**
   * Add employee
   */
  async addEmployee(data) {
    const employee = new CorporateEmployee(data);
    this.employees.set(employee.employeeId, employee);
    
    // Update company stats
    const company = this.companies.get(data.companyId);
    if (company) {
      company.stats.totalEmployees += 1;
      company.stats.activeEmployees += 1;
    }
    
    if (this.db) {
      await this.db.collection('corporate_employees').insertOne(employee.toJSON());
    }
    
    return employee;
  }
  
  /**
   * Create travel policy
   */
  async createPolicy(data) {
    const policy = new TravelPolicy(data);
    this.policies.set(policy.policyId, policy);
    
    if (this.db) {
      await this.db.collection('travel_policies').insertOne(policy.toJSON());
    }
    
    return policy;
  }
  
  /**
   * Create booking approval request
   */
  async createApproval(data) {
    const approval = new BookingApproval(data);
    this.approvals.set(approval.approvalId, approval);
    
    if (this.db) {
      await this.db.collection('booking_approvals').insertOne(approval.toJSON());
    }
    
    return approval;
  }
  
  /**
   * Create expense report
   */
  async createExpenseReport(data) {
    const report = new ExpenseReport(data);
    this.expenseReports.set(report.reportId, report);
    
    if (this.db) {
      await this.db.collection('expense_reports').insertOne(report.toJSON());
    }
    
    return report;
  }
  
  /**
   * Get company by ID
   */
  async getCompany(companyId) {
    return this.companies.get(companyId) || null;
  }
  
  /**
   * Get employee by ID
   */
  async getEmployee(employeeId) {
    return this.employees.get(employeeId) || null;
  }
  
  /**
   * Get employees by company
   */
  async getEmployeesByCompany(companyId) {
    return Array.from(this.employees.values())
      .filter(e => e.companyId === companyId);
  }
  
  /**
   * Get pending approvals
   */
  async getPendingApprovals(companyId, approverId = null) {
    return Array.from(this.approvals.values())
      .filter(a => 
        a.companyId === companyId && 
        a.status === 'pending' &&
        (!approverId || a.currentApproverId === approverId)
      );
  }
  
  /**
   * Get expense reports
   */
  async getExpenseReports(companyId, employeeId = null, status = null) {
    let reports = Array.from(this.expenseReports.values())
      .filter(r => r.companyId === companyId);
    
    if (employeeId) {
      reports = reports.filter(r => r.employeeId === employeeId);
    }
    
    if (status) {
      reports = reports.filter(r => r.status === status);
    }
    
    return reports.sort((a, b) => b.createdAt - a.createdAt);
  }
  
  /**
   * Get company dashboard stats
   */
  async getCompanyStats(companyId, period = '30d') {
    const company = this.companies.get(companyId);
    if (!company) return null;
    
    const days = parseInt(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const employees = await this.getEmployeesByCompany(companyId);
    const approvals = Array.from(this.approvals.values())
      .filter(a => a.companyId === companyId && a.requestedAt >= cutoff);
    
    return {
      companyId,
      period,
      totalEmployees: employees.length,
      activeEmployees: employees.filter(e => e.status === 'active').length,
      pendingApprovals: approvals.filter(a => a.status === 'pending').length,
      approvedBookings: approvals.filter(a => a.status === 'approved').length,
      totalSpend: company.stats.ytdSpend,
      policyViolations: approvals.filter(a => !a.policyCompliant).length
    };
  }
}

module.exports = {
  CorporateAccount,
  CorporateAccountSchema,
  CorporateEmployee,
  CorporateEmployeeSchema,
  TravelPolicy,
  TravelPolicySchema,
  BookingApproval,
  BookingApprovalSchema,
  ExpenseReport,
  ExpenseReportSchema,
  CorporateRepository
};