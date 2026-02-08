/**
 * Nexvoy Error Handling Utilities
 * Standardized error classes and response format
 */

/**
 * Standard error response format:
 * {
 *   success: false,
 *   error: string,      // User-friendly error message
 *   code: string,       // Machine-readable error code
 *   details?: object    // Optional additional details
 * }
 */

/**
 * HTTP Status Codes Map
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

/**
 * Error Codes - Machine-readable identifiers
 */
const ERROR_CODES = {
  // Client errors (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  FLIGHT_NOT_FOUND: 'FLIGHT_NOT_FOUND',
  HOTEL_NOT_FOUND: 'HOTEL_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  ALERT_NOT_FOUND: 'ALERT_NOT_FOUND',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_ERROR: 'SERVICE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  
  // External service errors
  OTA_ERROR: 'OTA_ERROR',
  API_ERROR: 'API_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  
  // Business logic errors
  PRICE_ERROR: 'PRICE_ERROR',
  BOOKING_ERROR: 'BOOKING_ERROR',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA'
};

/**
 * User-friendly error messages
 */
const ERROR_MESSAGES = {
  [ERROR_CODES.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ERROR_CODES.INVALID_INPUT]: 'The information provided is invalid.',
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Please fill in all required fields.',
  [ERROR_CODES.INVALID_FORMAT]: 'The format of your input is incorrect.',
  
  [ERROR_CODES.AUTHENTICATION_ERROR]: 'Please sign in to continue.',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ERROR_CODES.INVALID_CREDENTIALS]: 'Email or password is incorrect.',
  
  [ERROR_CODES.AUTHORIZATION_ERROR]: 'You don\'t have permission to do that.',
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'You need additional permissions for this action.',
  
  [ERROR_CODES.RESOURCE_NOT_FOUND]: 'We couldn\'t find what you\'re looking for.',
  [ERROR_CODES.FLIGHT_NOT_FOUND]: 'We couldn\'t find that flight. Please try different dates.',
  [ERROR_CODES.HOTEL_NOT_FOUND]: 'We couldn\'t find that hotel. Please try different dates.',
  [ERROR_CODES.USER_NOT_FOUND]: 'User not found.',
  [ERROR_CODES.ALERT_NOT_FOUND]: 'Price alert not found.',
  [ERROR_CODES.BOOKING_NOT_FOUND]: 'Booking not found.',
  
  [ERROR_CODES.CONFLICT_ERROR]: 'There was a conflict with your request.',
  [ERROR_CODES.DUPLICATE_RESOURCE]: 'This already exists.',
  [ERROR_CODES.ALREADY_EXISTS]: 'You\'ve already created this.',
  
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please slow down.',
  
  [ERROR_CODES.INTERNAL_ERROR]: 'Something went wrong on our end. We\'re working to fix it.',
  [ERROR_CODES.SERVICE_ERROR]: 'Service temporarily unavailable. Please try again.',
  [ERROR_CODES.DATABASE_ERROR]: 'We\'re having trouble accessing our database.',
  [ERROR_CODES.CACHE_ERROR]: 'We\'re having trouble with our cache.',
  
  [ERROR_CODES.OTA_ERROR]: 'We\'re having trouble connecting to our travel partners.',
  [ERROR_CODES.API_ERROR]: 'External service error. Please try again.',
  [ERROR_CODES.TIMEOUT_ERROR]: 'The request took too long. Please try again.',
  [ERROR_CODES.NETWORK_ERROR]: 'Network error. Please check your connection.',
  
  [ERROR_CODES.PRICE_ERROR]: 'We\'re having trouble getting current prices.',
  [ERROR_CODES.BOOKING_ERROR]: 'We couldn\'t complete your booking. Please try again.',
  [ERROR_CODES.PAYMENT_ERROR]: 'Payment processing failed. Please try again.',
  [ERROR_CODES.INSUFFICIENT_DATA]: 'We don\'t have enough data for this search yet.'
};

/**
 * Base Nexvoy Error Class
 */
class NexvoyError extends Error {
  constructor(code, message, statusCode = HTTP_STATUS.INTERNAL_ERROR, details = null) {
    super(message || ERROR_MESSAGES[code] || 'An error occurred');
    
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.isOperational = true; // Distinguish operational errors from programming errors
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Convert to standardized response format
   */
  toJSON() {
    const response = {
      success: false,
      error: this.message,
      code: this.code,
      timestamp: this.timestamp
    };
    
    if (this.details) {
      response.details = this.details;
    }
    
    return response;
  }
  
  /**
   * Get appropriate HTTP status code
   */
  getStatusCode() {
    return this.statusCode;
  }
}

/**
 * Validation Error - 400
 */
class ValidationError extends NexvoyError {
  constructor(message, details = null) {
    super(
      ERROR_CODES.VALIDATION_ERROR,
      message || ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR],
      HTTP_STATUS.BAD_REQUEST,
      details
    );
  }
}

/**
 * Invalid Input Error - 400
 */
class InvalidInputError extends NexvoyError {
  constructor(field, details = null) {
    const message = field 
      ? `Invalid value for ${field}` 
      : ERROR_MESSAGES[ERROR_CODES.INVALID_INPUT];
    
    super(
      ERROR_CODES.INVALID_INPUT,
      message,
      HTTP_STATUS.BAD_REQUEST,
      details
    );
  }
}

/**
 * Missing Required Field Error - 400
 */
class MissingFieldError extends NexvoyError {
  constructor(field) {
    const message = field 
      ? `${field} is required` 
      : ERROR_MESSAGES[ERROR_CODES.MISSING_REQUIRED_FIELD];
    
    super(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      message,
      HTTP_STATUS.BAD_REQUEST,
      field ? { field } : null
    );
  }
}

/**
 * Authentication Error - 401
 */
class AuthenticationError extends NexvoyError {
  constructor(message, details = null) {
    super(
      ERROR_CODES.AUTHENTICATION_ERROR,
      message || ERROR_MESSAGES[ERROR_CODES.AUTHENTICATION_ERROR],
      HTTP_STATUS.UNAUTHORIZED,
      details
    );
  }
}

/**
 * Authorization Error - 403
 */
class AuthorizationError extends NexvoyError {
  constructor(message, details = null) {
    super(
      ERROR_CODES.AUTHORIZATION_ERROR,
      message || ERROR_MESSAGES[ERROR_CODES.AUTHORIZATION_ERROR],
      HTTP_STATUS.FORBIDDEN,
      details
    );
  }
}

/**
 * Not Found Error - 404
 */
class NotFoundError extends NexvoyError {
  constructor(resource = 'Resource', id = null) {
    const message = id 
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    
    super(
      ERROR_CODES.RESOURCE_NOT_FOUND,
      message,
      HTTP_STATUS.NOT_FOUND,
      id ? { resource, id } : { resource }
    );
  }
}

/**
 * Flight Not Found Error - 404
 */
class FlightNotFoundError extends NotFoundError {
  constructor(id = null) {
    super('Flight', id);
    this.code = ERROR_CODES.FLIGHT_NOT_FOUND;
    this.message = ERROR_MESSAGES[ERROR_CODES.FLIGHT_NOT_FOUND];
  }
}

/**
 * Hotel Not Found Error - 404
 */
class HotelNotFoundError extends NotFoundError {
  constructor(id = null) {
    super('Hotel', id);
    this.code = ERROR_CODES.HOTEL_NOT_FOUND;
    this.message = ERROR_MESSAGES[ERROR_CODES.HOTEL_NOT_FOUND];
  }
}

/**
 * Alert Not Found Error - 404
 */
class AlertNotFoundError extends NotFoundError {
  constructor(id = null) {
    super('Price Alert', id);
    this.code = ERROR_CODES.ALERT_NOT_FOUND;
    this.message = ERROR_MESSAGES[ERROR_CODES.ALERT_NOT_FOUND];
  }
}

/**
 * Conflict Error - 409
 */
class ConflictError extends NexvoyError {
  constructor(message, details = null) {
    super(
      ERROR_CODES.CONFLICT_ERROR,
      message || ERROR_MESSAGES[ERROR_CODES.CONFLICT_ERROR],
      HTTP_STATUS.CONFLICT,
      details
    );
  }
}

/**
 * Duplicate Resource Error - 409
 */
class DuplicateError extends NexvoyError {
  constructor(resource = 'Resource', field = null, value = null) {
    const message = field && value
      ? `${resource} with ${field} '${value}' already exists`
      : `${resource} already exists`;
    
    super(
      ERROR_CODES.DUPLICATE_RESOURCE,
      message,
      HTTP_STATUS.CONFLICT,
      field ? { field, value } : null
    );
  }
}

/**
 * Rate Limit Error - 429
 */
class RateLimitError extends NexvoyError {
  constructor(retryAfter = null) {
    super(
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      ERROR_MESSAGES[ERROR_CODES.RATE_LIMIT_EXCEEDED],
      HTTP_STATUS.TOO_MANY_REQUESTS,
      retryAfter ? { retryAfter } : null
    );
    
    if (retryAfter) {
      this.retryAfter = retryAfter;
    }
  }
}

/**
 * External Service Error - 502
 */
class ExternalServiceError extends NexvoyError {
  constructor(service, message = null, details = null) {
    super(
      ERROR_CODES.OTA_ERROR,
      message || `Error connecting to ${service || 'external service'}`,
      HTTP_STATUS.BAD_GATEWAY,
      { service, ...details }
    );
  }
}

/**
 * OTA Adapter Error - 502
 */
class OTAAdapterError extends ExternalServiceError {
  constructor(otaName, originalError = null) {
    super(
      otaName,
      ERROR_MESSAGES[ERROR_CODES.OTA_ERROR],
      originalError ? { originalError: originalError.message } : null
    );
    this.code = ERROR_CODES.OTA_ERROR;
  }
}

/**
 * Timeout Error - 504
 */
class TimeoutError extends NexvoyError {
  constructor(service = null) {
    super(
      ERROR_CODES.TIMEOUT_ERROR,
      ERROR_MESSAGES[ERROR_CODES.TIMEOUT_ERROR],
      HTTP_STATUS.GATEWAY_TIMEOUT,
      service ? { service } : null
    );
  }
}

/**
 * Network Error - 503
 */
class NetworkError extends NexvoyError {
  constructor(service = null) {
    super(
      ERROR_CODES.NETWORK_ERROR,
      ERROR_MESSAGES[ERROR_CODES.NETWORK_ERROR],
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      service ? { service } : null
    );
  }
}

/**
 * Price Error - 500
 */
class PriceError extends NexvoyError {
  constructor(message = null, details = null) {
    super(
      ERROR_CODES.PRICE_ERROR,
      message || ERROR_MESSAGES[ERROR_CODES.PRICE_ERROR],
      HTTP_STATUS.INTERNAL_ERROR,
      details
    );
  }
}

/**
 * Insufficient Data Error - 422
 */
class InsufficientDataError extends NexvoyError {
  constructor(resource = null, details = null) {
    super(
      ERROR_CODES.INSUFFICIENT_DATA,
      ERROR_MESSAGES[ERROR_CODES.INSUFFICIENT_DATA],
      HTTP_STATUS.UNPROCESSABLE,
      resource ? { resource, ...details } : details
    );
  }
}

/**
 * Database Error - 500
 */
class DatabaseError extends NexvoyError {
  constructor(operation = null, details = null) {
    super(
      ERROR_CODES.DATABASE_ERROR,
      ERROR_MESSAGES[ERROR_CODES.DATABASE_ERROR],
      HTTP_STATUS.INTERNAL_ERROR,
      operation ? { operation, ...details } : details
    );
  }
}

/**
 * Helper function to determine if error is operational
 */
function isOperationalError(error) {
  return error instanceof NexvoyError && error.isOperational === true;
}

/**
 * Helper function to create error from any thrown value
 */
function createErrorFromThrown(thrown, defaultCode = ERROR_CODES.INTERNAL_ERROR) {
  if (thrown instanceof NexvoyError) {
    return thrown;
  }
  
  if (thrown instanceof Error) {
    return new NexvoyError(
      defaultCode,
      thrown.message,
      HTTP_STATUS.INTERNAL_ERROR,
      { originalError: thrown.stack }
    );
  }
  
  return new NexvoyError(
    defaultCode,
    String(thrown),
    HTTP_STATUS.INTERNAL_ERROR
  );
}

/**
 * Helper to wrap async functions with error handling
 */
function asyncErrorHandler(fn) {
  return function(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  // HTTP Status
  HTTP_STATUS,
  
  // Error Codes
  ERROR_CODES,
  ERROR_MESSAGES,
  
  // Base Error Class
  NexvoyError,
  
  // Specific Error Classes
  ValidationError,
  InvalidInputError,
  MissingFieldError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  FlightNotFoundError,
  HotelNotFoundError,
  AlertNotFoundError,
  ConflictError,
  DuplicateError,
  RateLimitError,
  ExternalServiceError,
  OTAAdapterError,
  TimeoutError,
  NetworkError,
  PriceError,
  InsufficientDataError,
  DatabaseError,
  
  // Helpers
  isOperationalError,
  createErrorFromThrown,
  asyncErrorHandler
};
