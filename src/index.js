/**
 * Nexvoy Backend Index
 * Central exports for backend modules
 */

// Middleware
const {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validationErrorHandler,
  requestIdMiddleware,
  ErrorMonitor
} = require('./middleware/errorHandler');

// Utils - Errors
const {
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
} = require('./utils/errors');

// Utils - Logger
const {
  ErrorLogger,
  LOG_LEVELS,
  getLogger,
  configureLogger
} = require('./utils/logger');

module.exports = {
  // Middleware
  middleware: {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    validationErrorHandler,
    requestIdMiddleware,
    ErrorMonitor
  },
  
  // Errors
  errors: {
    // Constants
    HTTP_STATUS,
    ERROR_CODES,
    ERROR_MESSAGES,
    
    // Classes
    NexvoyError,
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
  },
  
  // Logger
  logger: {
    ErrorLogger,
    LOG_LEVELS,
    getLogger,
    configureLogger
  }
};
