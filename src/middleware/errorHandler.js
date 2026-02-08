/**
 * Nexvoy Unified Error Handler Middleware
 * Standardized error handling for all API routes
 */

const {
  NexvoyError,
  ValidationError,
  isOperationalError,
  ERROR_CODES,
  HTTP_STATUS
} = require('../utils/errors');

const { getLogger, createContext } = require('../utils/logger');

/**
 * Main error handling middleware
 * This should be the last middleware in the chain
 */
function errorHandler(err, req, res, next) {
  const logger = getLogger();
  
  // Convert unknown errors to NexvoyError
  let error = err;
  if (!(error instanceof NexvoyError)) {
    error = convertToNexvoyError(err);
  }
  
  // Create request context for logging
  const context = createContext(req, req.user);
  
  // Log the error
  logger.logError(error, {
    ...context,
    query: req.query,
    body: sanitizeBody(req.body)
  });
  
  // Send response
  const response = error.toJSON();
  
  // In development, include stack trace for non-operational errors
  if (process.env.NODE_ENV === 'development' && !error.isOperational) {
    response.stack = error.stack;
  }
  
  res.status(error.getStatusCode()).json(response);
}

/**
 * Convert any error to NexvoyError
 */
function convertToNexvoyError(err) {
  // Handle specific error types
  
  // SyntaxError (JSON parsing)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return new ValidationError(
      'Invalid JSON in request body',
      { field: 'body', message: err.message }
    );
  }
  
  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.keys(err.errors).reduce((acc, key) => {
      acc[key] = err.errors[key].message;
      return acc;
    }, {});
    
    return new ValidationError('Validation failed', details);
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    const value = err.keyValue?.[field];
    
    return new NexvoyError(
      ERROR_CODES.DUPLICATE_RESOURCE,
      `A record with this ${field} already exists`,
      HTTP_STATUS.CONFLICT,
      { field, value }
    );
  }
  
  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return new NexvoyError(
      ERROR_CODES.INVALID_FORMAT,
      `Invalid ID format for ${err.path}`,
      HTTP_STATUS.BAD_REQUEST,
      { field: err.path, value: err.value }
    );
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return new NexvoyError(
      ERROR_CODES.AUTHENTICATION_ERROR,
      'Invalid authentication token',
      HTTP_STATUS.UNAUTHORIZED
    );
  }
  
  if (err.name === 'TokenExpiredError') {
    return new NexvoyError(
      ERROR_CODES.TOKEN_EXPIRED,
      'Your session has expired. Please sign in again.',
      HTTP_STATUS.UNAUTHORIZED
    );
  }
  
  // Axios/HTTP errors
  if (err.isAxiosError) {
    const status = err.response?.status;
    const service = err.config?.url || 'external service';
    
    // Map external service errors
    if (status >= 500) {
      return new NexvoyError(
        ERROR_CODES.OTA_ERROR,
        'Our travel partner is experiencing issues. Please try again.',
        HTTP_STATUS.BAD_GATEWAY,
        { service, originalStatus: status }
      );
    }
    
    if (status === 429) {
      return new NexvoyError(
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        'Too many requests to our travel partners. Please wait a moment.',
        HTTP_STATUS.TOO_MANY_REQUESTS,
        { service }
      );
    }
    
    if (status === 404) {
      return new NexvoyError(
        ERROR_CODES.RESOURCE_NOT_FOUND,
        'We couldn\'t find that travel option.',
        HTTP_STATUS.NOT_FOUND,
        { service }
      );
    }
    
    return new NexvoyError(
      ERROR_CODES.API_ERROR,
      'Error communicating with travel partner',
      HTTP_STATUS.BAD_GATEWAY,
      { service, message: err.message }
    );
  }
  
  // Network/timeout errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return new NexvoyError(
      ERROR_CODES.NETWORK_ERROR,
      'Unable to connect to travel service',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      { code: err.code }
    );
  }
  
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
    return new NexvoyError(
      ERROR_CODES.TIMEOUT_ERROR,
      'Request to travel service timed out',
      HTTP_STATUS.GATEWAY_TIMEOUT,
      { code: err.code }
    );
  }
  
  // Generic error conversion
  return new NexvoyError(
    ERROR_CODES.INTERNAL_ERROR,
    process.env.NODE_ENV === 'production' 
      ? 'Something went wrong. We\'re working to fix it.'
      : err.message,
    HTTP_STATUS.INTERNAL_ERROR,
    process.env.NODE_ENV === 'development' ? { originalError: err.message } : null
  );
}

/**
 * Sanitize request body for logging (remove sensitive data)
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sensitiveFields = ['password', 'token', 'secret', 'creditCard', 'cvv', 'ssn'];
  const sanitized = { ...body };
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * 404 Not Found handler
 * Catches requests to undefined routes
 */
function notFoundHandler(req, res, next) {
  const error = new NexvoyError(
    ERROR_CODES.RESOURCE_NOT_FOUND,
    `Cannot ${req.method} ${req.path}`,
    HTTP_STATUS.NOT_FOUND,
    { path: req.path, method: req.method }
  );
  
  next(error);
}

/**
 * Async handler wrapper
 * Automatically catches errors in async route handlers
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error handler middleware
 * For express-validator or similar
 */
function validationErrorHandler(errors) {
  return (req, res, next) => {
    if (!errors.isEmpty()) {
      const details = errors.array().reduce((acc, error) => {
        acc[error.param] = error.msg;
        return acc;
      }, {});
      
      const error = new ValidationError('Validation failed', details);
      return next(error);
    }
    next();
  };
}

/**
 * Request ID middleware
 * Adds unique request ID for tracing
 */
function requestIdMiddleware(req, res, next) {
  req.id = req.headers['x-request-id'] || 
           `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  res.setHeader('X-Request-ID', req.id);
  next();
}

/**
 * Error monitoring middleware
 * Tracks error rates and alerts if needed
 */
class ErrorMonitor {
  constructor(config = {}) {
    this.windowMs = config.windowMs || 60000; // 1 minute
    this.maxErrors = config.maxErrors || 100; // Max errors per window
    this.errors = [];
    this.lastAlert = null;
    this.alertCooldownMs = config.alertCooldownMs || 300000; // 5 minutes
  }
  
  middleware() {
    return (err, req, res, next) => {
      this.trackError(err);
      next(err);
    };
  }
  
  trackError(error) {
    const now = Date.now();
    
    // Remove old errors outside window
    this.errors = this.errors.filter(e => now - e.timestamp < this.windowMs);
    
    // Add new error
    this.errors.push({
      timestamp: now,
      code: error.code,
      statusCode: error.statusCode
    });
    
    // Check threshold
    if (this.errors.length >= this.maxErrors) {
      this._alertHighErrorRate();
    }
  }
  
  _alertHighErrorRate() {
    const now = Date.now();
    
    // Respect cooldown
    if (this.lastAlert && now - this.lastAlert < this.alertCooldownMs) {
      return;
    }
    
    this.lastAlert = now;
    
    const logger = getLogger();
    logger.logError(
      new Error(`High error rate detected: ${this.errors.length} errors in last minute`),
      { 
        errorCount: this.errors.length,
        windowMs: this.windowMs,
        errors: this.errors.slice(-10) // Last 10 errors
      }
    );
  }
  
  getStats() {
    const now = Date.now();
    this.errors = this.errors.filter(e => now - e.timestamp < this.windowMs);
    
    return {
      errorCount: this.errors.length,
      windowMs: this.windowMs,
      byCode: this.errors.reduce((acc, e) => {
        acc[e.code] = (acc[e.code] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

module.exports = {
  // Main middleware
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validationErrorHandler,
  requestIdMiddleware,
  
  // Error monitoring
  ErrorMonitor,
  
  // Utilities
  convertToNexvoyError,
  sanitizeBody
};
