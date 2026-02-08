/**
 * Traveler Model for Nexvoy
 * Manages passenger/guest profiles for bookings
 */

const crypto = require('crypto');

/**
 * Traveler Schema Definition
 */
const TravelerSchema = {
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true }, // Owner user
  
  // Basic information
  type: { 
    type: String, 
    required: true, 
    enum: ['adult', 'child', 'infant'],
    default: 'adult'
  },
  title: { 
    type: String, 
    enum: ['mr', 'mrs', 'ms', 'miss', 'dr', 'prof']
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  middleName: { type: String },
  
  // Date of birth
  dateOfBirth: { type: Date },
  
  // Nationality and documentation
  nationality: { type: String }, // ISO country code
  passportNumber: { type: String },
  passportExpiry: { type: Date },
  passportCountry: { type: String }, // ISO country code
  passportIssuedDate: { type: Date },
  
  // Additional IDs
  nationalId: { type: String }, // For domestic travel
  driversLicense: { type: String }, // For car rentals
  driversLicenseExpiry: { type: Date },
  driversLicenseCountry: { type: String },
  
  // Contact information
  email: { type: String },
  phone: { type: String },
  countryCode: { type: String },
  
  // Frequent flyer programs
  frequentFlyerNumbers: [{
    airline: { type: String }, // Airline code
    airlineName: { type: String },
    number: { type: String },
    tier: { type: String } // e.g., 'silver', 'gold'
  }],
  
  // Hotel loyalty programs
  hotelLoyaltyNumbers: [{
    chain: { type: String },
    chainName: { type: String },
    number: { type: String },
    tier: { type: String }
  }],
  
  // Car rental loyalty
  carRentalLoyaltyNumbers: [{
    company: { type: String },
    companyName: { type: String },
    number: { type: String }
  }],
  
  // Preferences
  preferences: {
    // Flight preferences
    seatPreference: { 
      type: String, 
      enum: ['window', 'aisle', 'middle', 'no_preference']
    },
    mealPreference: {
      type: String,
      enum: ['standard', 'vegetarian', 'vegan', 'kosher', 'halal', 'gluten_free', 'diabetic', 'child']
    },
    specialAssistance: [{ 
      type: String,
      enum: ['wheelchair', 'visual_impairment', 'hearing_impairment', 'mobility_assistance', 'medical_equipment']
    }],
    
    // Hotel preferences
    roomPreference: {
      smoking: { type: Boolean, default: false },
      highFloor: { type: Boolean, default: false },
      nearElevator: { type: Boolean, default: false },
      quietRoom: { type: Boolean, default: false }
    },
    bedPreference: {
      type: String,
      enum: ['king', 'queen', 'twin', 'double', 'single', 'no_preference']
    },
    
    // Car rental preferences
    carPreferences: {
      transmission: { type: String, enum: ['manual', 'automatic', 'no_preference'] },
      fuelType: { type: String, enum: ['petrol', 'diesel', 'electric', 'hybrid', 'no_preference'] },
      gps: { type: Boolean, default: false },
      childSeat: { type: Boolean, default: false }
    },
    
    // Communication preferences
    language: { type: String, default: 'en' },
    marketingConsent: { type: Boolean, default: false },
    smsNotifications: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true }
  },
  
  // Emergency contact
  emergencyContact: {
    name: { type: String },
    relationship: { type: String },
    phone: { type: String },
    email: { type: String }
  },
  
  // Special requests / notes
  specialRequests: { type: String },
  medicalNotes: { type: String },
  dietaryRequirements: { type: String },
  
  // Profile metadata
  isPrimary: { type: Boolean, default: false }, // Primary traveler for user
  isSaved: { type: Boolean, default: true }, // Save for future bookings
  profilePicture: { type: String }, // URL to image
  
  // Validation status
  validationStatus: {
    passportValid: { type: Boolean },
    passportExpiresSoon: { type: Boolean }, // Within 6 months
    ageVerified: { type: Boolean },
    documentationComplete: { type: Boolean }
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastUsed: { type: Date },
  usageCount: { type: Number, default: 0 }
};

/**
 * Traveler Model Class
 */
class Traveler {
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID();
    this.userId = data.userId;
    
    this.type = data.type || 'adult';
    this.title = data.title;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.middleName = data.middleName;
    
    this.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    
    this.nationality = data.nationality;
    this.passportNumber = data.passportNumber;
    this.passportExpiry = data.passportExpiry ? new Date(data.passportExpiry) : null;
    this.passportCountry = data.passportCountry;
    this.passportIssuedDate = data.passportIssuedDate ? new Date(data.passportIssuedDate) : null;
    
    this.nationalId = data.nationalId;
    this.driversLicense = data.driversLicense;
    this.driversLicenseExpiry = data.driversLicenseExpiry ? new Date(data.driversLicenseExpiry) : null;
    this.driversLicenseCountry = data.driversLicenseCountry;
    
    this.email = data.email;
    this.phone = data.phone;
    this.countryCode = data.countryCode;
    
    this.frequentFlyerNumbers = data.frequentFlyerNumbers || [];
    this.hotelLoyaltyNumbers = data.hotelLoyaltyNumbers || [];
    this.carRentalLoyaltyNumbers = data.carRentalLoyaltyNumbers || [];
    
    this.preferences = {
      seatPreference: data.preferences?.seatPreference || 'no_preference',
      mealPreference: data.preferences?.mealPreference || 'standard',
      specialAssistance: data.preferences?.specialAssistance || [],
      roomPreference: {
        smoking: data.preferences?.roomPreference?.smoking || false,
        highFloor: data.preferences?.roomPreference?.highFloor || false,
        nearElevator: data.preferences?.roomPreference?.nearElevator || false,
        quietRoom: data.preferences?.roomPreference?.quietRoom || false
      },
      bedPreference: data.preferences?.bedPreference || 'no_preference',
      carPreferences: {
        transmission: data.preferences?.carPreferences?.transmission || 'no_preference',
        fuelType: data.preferences?.carPreferences?.fuelType || 'no_preference',
        gps: data.preferences?.carPreferences?.gps || false,
        childSeat: data.preferences?.carPreferences?.childSeat || false
      },
      language: data.preferences?.language || 'en',
      marketingConsent: data.preferences?.marketingConsent || false,
      smsNotifications: data.preferences?.smsNotifications || true,
      emailNotifications: data.preferences?.emailNotifications || true
    };
    
    this.emergencyContact = data.emergencyContact || {};
    
    this.specialRequests = data.specialRequests || '';
    this.medicalNotes = data.medicalNotes || '';
    this.dietaryRequirements = data.dietaryRequirements || '';
    
    this.isPrimary = data.isPrimary || false;
    this.isSaved = data.isSaved !== false;
    this.profilePicture = data.profilePicture || '';
    
    this.validationStatus = {
      passportValid: false,
      passportExpiresSoon: false,
      ageVerified: false,
      documentationComplete: false,
      ...data.validationStatus
    };
    
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    this.lastUsed = data.lastUsed ? new Date(data.lastUsed) : null;
    this.usageCount = data.usageCount || 0;
    
    this.validate();
  }
  
  /**
   * Get full name
   */
  getFullName() {
    const parts = [];
    if (this.title) parts.push(this.title.charAt(0).toUpperCase() + this.title.slice(1));
    parts.push(this.firstName);
    if (this.middleName) parts.push(this.middleName);
    parts.push(this.lastName);
    return parts.join(' ');
  }
  
  /**
   * Get display name (first + last)
   */
  getDisplayName() {
    return `${this.firstName} ${this.lastName}`;
  }
  
  /**
   * Calculate age
   */
  getAge() {
    if (!this.dateOfBirth) return null;
    const today = new Date();
    let age = today.getFullYear() - this.dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - this.dateOfBirth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < this.dateOfBirth.getDate())) {
      age--;
    }
    return age;
  }
  
  /**
   * Check if passenger is an infant (under 2 years)
   */
  isInfant() {
    const age = this.getAge();
    return age !== null && age < 2;
  }
  
  /**
   * Check if passenger is a child (2-11 years)
   */
  isChild() {
    const age = this.getAge();
    return age !== null && age >= 2 && age < 12;
  }
  
  /**
   * Check if passport is valid
   */
  isPassportValid(travelDate = new Date()) {
    if (!this.passportExpiry) return false;
    
    // Passport must be valid for at least 6 months after travel
    const minValidityDate = new Date(travelDate);
    minValidityDate.setMonth(minValidityDate.getMonth() + 6);
    
    return this.passportExpiry > minValidityDate;
  }
  
  /**
   * Check if passport expires soon
   */
  passportExpiresSoon() {
    if (!this.passportExpiry) return false;
    
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    
    return this.passportExpiry < sixMonthsFromNow;
  }
  
  /**
   * Update validation status
   */
  updateValidationStatus() {
    this.validationStatus = {
      passportValid: this.isPassportValid(),
      passportExpiresSoon: this.passportExpiresSoon(),
      ageVerified: this.dateOfBirth !== null,
      documentationComplete: this.hasRequiredDocumentation()
    };
    return this.validationStatus;
  }
  
  /**
   * Check if traveler has required documentation
   */
  hasRequiredDocumentation() {
    // Basic check: needs passport number for international travel
    return !!this.passportNumber && !!this.passportExpiry;
  }
  
  /**
   * Validate traveler data
   */
  validate() {
    const errors = [];
    
    if (!this.userId) errors.push('User ID is required');
    if (!this.firstName) errors.push('First name is required');
    if (!this.lastName) errors.push('Last name is required');
    
    if (this.email && !this.isValidEmail(this.email)) {
      errors.push('Invalid email format');
    }
    
    if (this.dateOfBirth) {
      const age = this.getAge();
      if (age !== null && age < 0) {
        errors.push('Date of birth cannot be in the future');
      }
      if (age !== null && age > 120) {
        errors.push('Invalid date of birth');
      }
    }
    
    return errors;
  }
  
  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /**
   * Mark as used (increment usage count)
   */
  markUsed() {
    this.usageCount++;
    this.lastUsed = new Date();
    this.updatedAt = new Date();
  }
  
  /**
   * Add frequent flyer number
   */
  addFrequentFlyerNumber(airline, number, tier = null) {
    const existing = this.frequentFlyerNumbers.find(ff => ff.airline === airline);
    if (existing) {
      existing.number = number;
      if (tier) existing.tier = tier;
    } else {
      this.frequentFlyerNumbers.push({ airline, number, tier });
    }
    this.updatedAt = new Date();
  }
  
  /**
   * Get frequent flyer number for airline
   */
  getFrequentFlyerNumber(airline) {
    const ff = this.frequentFlyerNumbers.find(f => f.airline === airline);
    return ff ? ff.number : null;
  }
  
  /**
   * Convert to booking passenger format
   */
  toPassenger() {
    return {
      travelerId: this.id,
      type: this.type,
      title: this.title,
      firstName: this.firstName,
      lastName: this.lastName,
      dateOfBirth: this.dateOfBirth,
      passportNumber: this.passportNumber,
      passportExpiry: this.passportExpiry,
      passportCountry: this.passportCountry,
      nationality: this.nationality,
      specialMeal: this.preferences?.mealPreference,
      seatPreference: this.preferences?.seatPreference,
      specialRequests: this.specialRequests,
      frequentFlyerNumber: this.frequentFlyerNumbers[0]?.number
    };
  }
  
  /**
   * Convert to driver format for car rental
   */
  toDriver() {
    return {
      title: this.title,
      firstName: this.firstName,
      lastName: this.lastName,
      dateOfBirth: this.dateOfBirth,
      licenseNumber: this.driversLicense,
      licenseCountry: this.driversLicenseCountry,
      licenseExpiry: this.driversLicenseExpiry,
      phone: this.phone,
      email: this.email
    };
  }
  
  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      type: this.type,
      title: this.title,
      firstName: this.firstName,
      lastName: this.lastName,
      middleName: this.middleName,
      dateOfBirth: this.dateOfBirth,
      nationality: this.nationality,
      passportNumber: this.passportNumber,
      passportExpiry: this.passportExpiry,
      passportCountry: this.passportCountry,
      passportIssuedDate: this.passportIssuedDate,
      nationalId: this.nationalId,
      driversLicense: this.driversLicense,
      driversLicenseExpiry: this.driversLicenseExpiry,
      driversLicenseCountry: this.driversLicenseCountry,
      email: this.email,
      phone: this.phone,
      countryCode: this.countryCode,
      frequentFlyerNumbers: this.frequentFlyerNumbers,
      hotelLoyaltyNumbers: this.hotelLoyaltyNumbers,
      carRentalLoyaltyNumbers: this.carRentalLoyaltyNumbers,
      preferences: this.preferences,
      emergencyContact: this.emergencyContact,
      specialRequests: this.specialRequests,
      medicalNotes: this.medicalNotes,
      dietaryRequirements: this.dietaryRequirements,
      isPrimary: this.isPrimary,
      isSaved: this.isSaved,
      profilePicture: this.profilePicture,
      validationStatus: this.validationStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastUsed: this.lastUsed,
      usageCount: this.usageCount
    };
  }
}

/**
 * Traveler Repository
 */
class TravelerRepository {
  constructor(database = null) {
    this.db = database;
    this.travelers = new Map();
    this.travelersByUser = new Map();
  }
  
  async create(travelerData) {
    const traveler = new Traveler(travelerData);
    const errors = traveler.validate();
    
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    this.travelers.set(traveler.id, traveler);
    
    if (!this.travelersByUser.has(traveler.userId)) {
      this.travelersByUser.set(traveler.userId, new Set());
    }
    this.travelersByUser.get(traveler.userId).add(traveler.id);
    
    if (this.db) {
      try {
        await this.db.collection('travelers').insertOne(traveler.toJSON());
      } catch (error) {
        console.error('Failed to store traveler in MongoDB:', error);
      }
    }
    
    return traveler;
  }
  
  async findById(id) {
    if (this.travelers.has(id)) {
      return this.travelers.get(id);
    }
    
    if (this.db) {
      const data = await this.db.collection('travelers').findOne({ id });
      if (data) {
        const traveler = new Traveler(data);
        this.travelers.set(id, traveler);
        return traveler;
      }
    }
    
    return null;
  }
  
  async findByUser(userId, options = {}) {
    const { includeArchived = false, limit = 50 } = options;
    
    const travelerIds = this.travelersByUser.get(userId);
    if (!travelerIds) return [];
    
    let travelers = Array.from(travelerIds)
      .map(id => this.travelers.get(id))
      .filter(t => t !== undefined && (includeArchived || t.isSaved));
    
    // Sort by most recently used
    travelers.sort((a, b) => (b.lastUsed || b.createdAt) - (a.lastUsed || a.createdAt));
    
    return travelers.slice(0, limit);
  }
  
  async findPrimaryForUser(userId) {
    const travelers = await this.findByUser(userId);
    return travelers.find(t => t.isPrimary) || travelers[0] || null;
  }
  
  async update(id, updates) {
    const traveler = await this.findById(id);
    if (!traveler) return null;
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'userId') {
        traveler[key] = updates[key];
      }
    });
    
    traveler.updatedAt = new Date();
    
    if (this.db) {
      await this.db.collection('travelers').updateOne(
        { id },
        { $set: updates, $currentDate: { updatedAt: true } }
      );
    }
    
    return traveler;
  }
  
  async delete(id) {
    const traveler = this.travelers.get(id);
    if (traveler) {
      this.travelers.delete(id);
      this.travelersByUser.get(traveler.userId)?.delete(id);
    }
    
    if (this.db) {
      await this.db.collection('travelers').deleteOne({ id });
    }
    
    return true;
  }
  
  async setPrimary(userId, travelerId) {
    // Unset existing primary
    const existingTravelers = await this.findByUser(userId);
    for (const traveler of existingTravelers) {
      if (traveler.isPrimary && traveler.id !== travelerId) {
        traveler.isPrimary = false;
        if (this.db) {
          await this.db.collection('travelers').updateOne(
            { id: traveler.id },
            { $set: { isPrimary: false } }
          );
        }
      }
    }
    
    // Set new primary
    const newPrimary = await this.findById(travelerId);
    if (newPrimary && newPrimary.userId === userId) {
      newPrimary.isPrimary = true;
      if (this.db) {
        await this.db.collection('travelers').updateOne(
          { id: travelerId },
          { $set: { isPrimary: true } }
        );
      }
    }
    
    return newPrimary;
  }
}

module.exports = {
  Traveler,
  TravelerRepository,
  TravelerSchema
};