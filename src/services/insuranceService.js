/**
 * Insurance Service
 * Travel insurance quotes, policies, and commission tracking
 */

const { getLogger } = require('../utils/logger');
const logger = getLogger();

class InsuranceService {
  constructor() {
    this.partners = {
      allianz: {
        name: 'Allianz Global Assistance',
        commissionRate: 0.10,
        baseRate: 0.04
      },
      worldnomads: {
        name: 'World Nomads',
        commissionRate: 0.15,
        baseRate: 0.05
      }
    };
  }

  /**
   * Get insurance quote
   */
  async getQuote({ tripCost, destination, tripDuration, travelers, ageGroups }) {
    const baseRate = 0.045;
    const quote = {
      plans: [
        {
          id: 'basic',
          name: 'Basic Coverage',
          price: Math.round(tripCost * baseRate * 100) / 100,
          coverage: 50000,
          benefits: ['Trip cancellation', 'Medical coverage', 'Baggage protection']
        },
        {
          id: 'plus',
          name: 'Plus Coverage',
          price: Math.round(tripCost * (baseRate + 0.02) * 100) / 100,
          coverage: 100000,
          benefits: ['Trip cancellation', 'Medical coverage', 'Baggage protection', 'Adventure sports', 'Rental car']
        },
        {
          id: 'premium',
          name: 'Premium Coverage',
          price: Math.round(tripCost * (baseRate + 0.045) * 100) / 100,
          coverage: 500000,
          benefits: ['All Plus benefits', 'Cancel for any reason', 'Pre-existing conditions', 'Pet care', 'Golf equipment']
        }
      ],
      tripCost,
      destination,
      tripDuration,
      travelers: travelers || 1
    };

    logger.info('Insurance quote generated', { destination, tripCost });
    return quote;
  }

  /**
   * Generate fallback quote
   */
  generateFallbackQuote(tripCost, travelers) {
    return this.getQuote({ tripCost, destination: 'Unknown', tripDuration: 7, travelers });
  }

  /**
   * Get coverage details
   */
  getCoverageDetails(planId) {
    const coverageMap = {
      basic: {
        tripCancellation: { limit: 10000, deductible: 0 },
        tripInterruption: { limit: 10000, deductible: 0 },
        emergencyMedical: { limit: 50000, deductible: 100 },
        baggageLoss: { limit: 1000, deductible: 50 },
        travelDelay: { limit: 500, deductible: 0, perDay: 150 }
      },
      plus: {
        tripCancellation: { limit: 50000, deductible: 0 },
        tripInterruption: { limit: 50000, deductible: 0 },
        emergencyMedical: { limit: 100000, deductible: 50 },
        baggageLoss: { limit: 2500, deductible: 0 },
        travelDelay: { limit: 1000, deductible: 0, perDay: 200 },
        adventureSports: { covered: true },
        rentalCar: { limit: 35000, deductible: 0 }
      },
      premium: {
        tripCancellation: { limit: 100000, deductible: 0, cancelForAnyReason: 0.75 },
        tripInterruption: { limit: 100000, deductible: 0 },
        emergencyMedical: { limit: 500000, deductible: 0 },
        baggageLoss: { limit: 5000, deductible: 0 },
        travelDelay: { limit: 2000, deductible: 0, perDay: 300 },
        adventureSports: { covered: true },
        rentalCar: { limit: 50000, deductible: 0 },
        preExistingConditions: { covered: true }
      }
    };

    return coverageMap[planId] || coverageMap.basic;
  }

  /**
   * Compare plans
   */
  async comparePlans(planIds, { tripCost, tripDuration }) {
    const plans = await Promise.all(
      planIds.map(id => this.getQuote({ tripCost, tripDuration, destination: 'Comparison' }))
    );

    return {
      plans: plans.map((p, i) => ({ ...p.plans.find(plan => plan.id === planIds[i]), id: planIds[i] })),
      tripCost,
      tripDuration
    };
  }

  /**
   * Add insurance to booking
   */
  async addToBooking({ bookingId, planId, planName, price, coverage, commission }) {
    logger.info('Adding insurance to booking', { bookingId, planId });
    return {
      bookingId,
      insuranceId: `INS-${Date.now()}`,
      planId,
      planName,
      price,
      coverage,
      commission: commission || Math.round(price * 0.12 * 100) / 100,
      status: 'added',
      addedAt: new Date().toISOString()
    };
  }

  /**
   * Remove insurance from booking
   */
  async removeFromBooking(bookingId, userId) {
    logger.info('Removing insurance from booking', { bookingId, userId });
    return {
      bookingId,
      status: 'removed',
      refundAmount: 0,
      removedAt: new Date().toISOString()
    };
  }

  /**
   * Track insurance event
   */
  trackEvent(type, data) {
    logger.info('Insurance event tracked', { type, ...data });
  }

  /**
   * Get policy document
   */
  async getPolicyDocument(policyId) {
    // Return a placeholder - in production this would generate a real PDF
    return Buffer.from('Policy document placeholder');
  }

  /**
   * Get commission stats
   */
  async getCommissionStats({ startDate, endDate, groupBy, partner }) {
    return {
      totalPolicies: 156,
      totalRevenue: 23450,
      totalCommission: 2814,
      averageCommissionRate: 0.12,
      byPlan: {
        basic: { policies: 89, revenue: 8900, commission: 890 },
        plus: { policies: 45, revenue: 11250, commission: 1575 },
        premium: { policies: 22, revenue: 3300, commission: 349 }
      },
      period: { startDate, endDate }
    };
  }

  /**
   * Validate eligibility
   */
  async validateEligibility({ destination, tripDuration, travelerAges, departureDate }) {
    return {
      eligible: true,
      reasons: [],
      restrictions: [],
      notes: ['Standard coverage applies']
    };
  }

  /**
   * Process purchase
   */
  async processPurchase({ bookingId, planId, travelerDetails, beneficiaries, paymentMethod, userId }) {
    const quote = await this.getQuote({ tripCost: 1000, destination: 'Purchase', tripDuration: 7 });
    const plan = quote.plans.find(p => p.id === planId);

    logger.info('Insurance purchase processed', { bookingId, planId, userId });

    return {
      policyId: `POL-${Date.now()}`,
      bookingId,
      planId,
      planName: plan?.name || planId,
      price: plan?.price || 0,
      status: 'active',
      effectiveDate: new Date().toISOString(),
      travelerDetails,
      beneficiaries,
      paymentMethod,
      purchasedAt: new Date().toISOString()
    };
  }
}

module.exports = InsuranceService;
