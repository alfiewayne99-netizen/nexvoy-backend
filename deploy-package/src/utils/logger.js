/**
 * Nexvoy Error Logger
 * Centralized error logging with Sentry integration prep
 */

const { 
  NexvoyError, 
  isOperationalError, 
  ERROR_CODES,
  HTTP_STATUS 
} = require('./errors');

/**
 * Log Levels
 */
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * Error Logger Configuration
 */
class ErrorLogger {
  constructor(config = {}) {
    this.config = {
      // Console logging
      consoleEnabled: config.consoleEnabled !== false,
      consoleLevel: config.consoleLevel || LOG_LEVELS.DEBUG,
      
      // Sentry integration (prepared for future use)
      sentryEnabled: config.sentryEnabled || false,
      sentryDsn: config.sentryDsn || process.env.SENTRY_DSN,
      sentryEnvironment: config.sentryEnvironment || process.env.NODE_ENV || 'development',
      sentryRelease: config.sentryRelease || process.env.SENTRY_RELEASE,
      
      // Log filtering
      ignoreOperational: config.ignoreOperational || false,
      minStatusCode: config.minStatusCode || 500,
      
      // Sampling
      sampleRate: config.sampleRate || 1.0,
      
      // Context
      serviceName: config.serviceName || 'nexvoy',
      version: config.version || '1.0.0'
    };
    
    this.sentryInitialized = false;
    this.Sentry = null;
    
    // Initialize Sentry if configured
    if (this.config.sentryEnabled && this.config.sentryDsn) {
      this._initSentry();
    }
  }
  
  /**
   * Initialize Sentry SDK
   * This is prepared for future Sentry integration
   */
  async _initSentry() {
    try {
      // Dynamic import to avoid dependency if not enabled
      const Sentry = await import('@sentry/node');
      this.Sentry = Sentry;
      
      Sentry.init({
        dsn: this.config.sentryDsn,
        environment: this.config.sentryEnvironment,
        release: this.config.sentryRelease,
        sampleRate: this.config.sampleRate,
        
        // Performance monitoring (optional)
        tracesSampleRate: 0.1,
        
        // Before sending, filter out operational errors if configured
        beforeSend: (event, hint) => {
          const error = hint.originalException;
          
          if (this.config.ignoreOperational && isOperationalError(error)) {
            return null;
          }
          
          return event;
        }
      });
      
      this.sentryInitialized = true;
      this.info('Sentry initialized successfully');
    } catch (error) {
      this.warn('Failed to initialize Sentry:', error.message);
    }
  }
  
  /**
   * Log an error
   */
  logError(error, context = {}) {
    const logEntry = this._createLogEntry(error, LOG_LEVELS.ERROR, context);
    
    // Console logging
    if (this.config.consoleEnabled && this._shouldLogToConsole(LOG_LEVELS.ERROR)) {
      this._logToConsole(logEntry);
    }
    
    // Sentry logging
    if (this.sentryInitialized && this._shouldLogToSentry(error)) {
      this._logToSentry(error, context);
    }
    
    return logEntry;
  }
  
  /**
   * Log a warning
   */
  logWarning(message, context = {}) {
    const logEntry = this._createLogEntry(message, LOG_LEVELS.WARN, context);
    
    if (this.config.consoleEnabled && this._shouldLogToConsole(LOG_LEVELS.WARN)) {
      this._logToConsole(logEntry);
    }
    
    return logEntry;
  }
  
  /**
   * Log info
   */
  logInfo(message, context = {}) {
    const logEntry = this._createLogEntry(message, LOG_LEVELS.INFO, context);
    
    if (this.config.consoleEnabled && this._shouldLogToConsole(LOG_LEVELS.INFO)) {
      this._logToConsole(logEntry);
    }
    
    return logEntry;
  }
  
  /**
   * Log debug
   */
  logDebug(message, context = {}) {
    const logEntry = this._createLogEntry(message, LOG_LEVELS.DEBUG, context);
    
    if (this.config.consoleEnabled && this._shouldLogToConsole(LOG_LEVELS.DEBUG)) {
      this._logToConsole(logEntry);
    }
    
    return logEntry;
  }
  
  /**
   * Create a standardized log entry
   */
  _createLogEntry(errorOrMessage, level, context) {
    const isError = errorOrMessage instanceof Error;
    
    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.config.serviceName,
      version: this.config.version,
      environment: this.config.sentryEnvironment,
      
      message: isError ? errorOrMessage.message : String(errorOrMessage),
      error: isError ? {
        name: errorOrMessage.name,
        code: errorOrMessage.code || ERROR_CODES.INTERNAL_ERROR,
        stack: errorOrMessage.stack,
        statusCode: errorOrMessage.statusCode || HTTP_STATUS.INTERNAL_ERROR,
        isOperational: errorOrMessage.isOperational || false
      } : null,
      
      context: {
        ...context,
        requestId: context.requestId,
        userId: context.userId,
        path: context.path,
        method: context.method
      }
    };
  }
  
  /**
   * Log to console
   */
  _logToConsole(logEntry) {
    const colors = {
      [LOG_LEVELS.ERROR]: '\x1b[31m', // Red
      [LOG_LEVELS.WARN]: '\x1b[33m',  // Yellow
      [LOG_LEVELS.INFO]: '\x1b[36m',  // Cyan
      [LOG_LEVELS.DEBUG]: '\x1b[90m'  // Gray
    };
    
    const reset = '\x1b[0m';
    const color = colors[logEntry.level] || '';
    
    const prefix = `${color}[${logEntry.level.toUpperCase()}]${reset}`;
    const timestamp = `[${logEntry.timestamp}]`;
    
    console.log(`${prefix} ${timestamp} ${logEntry.service}: ${logEntry.message}`);
    
    if (logEntry.error && logEntry.error.stack) {
      console.log(logEntry.error.stack);
    }
    
    // Log context in debug mode
    if (logEntry.level === LOG_LEVELS.DEBUG && Object.keys(logEntry.context).length > 0) {
      console.log('Context:', JSON.stringify(logEntry.context, null, 2));
    }
  }
  
  /**
   * Log to Sentry
   */
  _logToSentry(error, context) {
    if (!this.Sentry) return;
    
    this.Sentry.withScope((scope) => {
      // Add context
      if (context.userId) {
        scope.setUser({ id: context.userId });
      }
      
      if (context.requestId) {
        scope.setTag('request_id', context.requestId);
      }
      
      if (context.path) {
        scope.setTag('path', context.path);
      }
      
      // Add extra context
      scope.setExtras(context);
      
      // Set level
      if (error.statusCode >= 500) {
        scope.setLevel('error');
      } else if (error.statusCode >= 400) {
        scope.setLevel('warning');
      }
      
      // Capture
      if (error instanceof Error) {
        this.Sentry.captureException(error);
      } else {
        this.Sentry.captureMessage(String(error));
      }
    });
  }
  
  /**
   * Check if should log to console based on level
   */
  _shouldLogToConsole(level) {
    const levels = [LOG_LEVELS.DEBUG, LOG_LEVELS.INFO, LOG_LEVELS.WARN, LOG_LEVELS.ERROR];
    const configIndex = levels.indexOf(this.config.consoleLevel);
    const levelIndex = levels.indexOf(level);
    return levelIndex >= configIndex;
  }
  
  /**
   * Check if should log to Sentry
   */
  _shouldLogToSentry(error) {
    // Don't log operational errors below threshold
    if (isOperationalError(error) && error.statusCode < this.config.minStatusCode) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Create request context from Express request
   */
  static createRequestContext(req, user = null) {
    return {
      requestId: req.id || req.headers['x-request-id'] || `req_${Date.now()}`,
      userId: user?.id || req.user?.id || null,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };
  }
  
  /**
   * Shutdown logger gracefully
   */
  async shutdown(timeout = 2000) {
    if (this.sentryInitialized && this.Sentry) {
      await this.Sentry.close(timeout);
    }
  }
}

// Singleton instance
let defaultLogger = null;

/**
 * Get or create default logger
 */
function getLogger(config = {}) {
  if (!defaultLogger) {
    defaultLogger = new ErrorLogger(config);
  }
  return defaultLogger;
}

/**
 * Configure the default logger
 */
function configureLogger(config) {
  defaultLogger = new ErrorLogger(config);
  return defaultLogger;
}

// Convenience methods on module exports
const errorLogger = {
  // Logger class
  ErrorLogger,
  LOG_LEVELS,
  
  // Get/configure logger
  getLogger,
  configureLogger,
  
  // Direct logging methods (using default logger)
  error: (err, ctx) => getLogger().logError(err, ctx),
  warn: (msg, ctx) => getLogger().logWarning(msg, ctx),
  info: (msg, ctx) => getLogger().logInfo(msg, ctx),
  debug: (msg, ctx) => getLogger().logDebug(msg, ctx),
  
  // Create context helper
  createContext: ErrorLogger.createRequestContext
};

module.exports = errorLogger;
