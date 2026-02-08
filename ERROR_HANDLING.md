# Nexvoy Error Handling Guide

## Overview

This document describes the standardized error handling pattern for all Nexvoy services. The goal is to provide:

1. **Consistent API responses** - All errors follow the same format
2. **User-friendly messages** - No technical jargon exposed to users
3. **Proper HTTP status codes** - Semantic HTTP responses
4. **Detailed logging** - Comprehensive error tracking with Sentry integration prep
5. **Easy debugging** - Stack traces in development, sanitized in production

## Error Response Format

All API errors return a consistent JSON structure:

```json
{
  "success": false,
  "error": "User-friendly error message",
  "code": "MACHINE_READABLE_CODE",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "details": {
    // Optional additional context
  }
}
```

### Example Error Responses

**Validation Error (400)**
```json
{
  "success": false,
  "error": "Please check your input and try again.",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "details": {
    "origin": "Must be a 3-letter airport code",
    "departure": "Date must be in the future"
  }
}
```

**Authentication Error (401)**
```json
{
  "success": false,
  "error": "Please sign in to continue.",
  "code": "AUTHENTICATION_ERROR",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**External Service Error (502)**
```json
{
  "success": false,
  "error": "We're having trouble connecting to our travel partners.",
  "code": "OTA_ERROR",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "details": {
    "service": "Expedia",
    "originalError": "Request timeout"
  }
}
```

## Error Classes

### Base Class: `NexvoyError`

All errors extend `NexvoyError` which provides:

```javascript
class NexvoyError extends Error {
  constructor(code, message, statusCode, details)
  
  // Methods
  toJSON()        // Convert to response format
  getStatusCode() // Get HTTP status code
}
```

### Available Error Classes

#### Client Errors (4xx)

| Class | HTTP Status | Use Case |
|-------|-------------|----------|
| `ValidationError` | 400 | Input validation failed |
| `InvalidInputError` | 400 | Specific field is invalid |
| `MissingFieldError` | 400 | Required field missing |
| `AuthenticationError` | 401 | User not authenticated |
| `AuthorizationError` | 403 | User lacks permissions |
| `NotFoundError` | 404 | Resource not found |
| `FlightNotFoundError` | 404 | Specific flight not found |
| `HotelNotFoundError` | 404 | Specific hotel not found |
| `AlertNotFoundError` | 404 | Price alert not found |
| `ConflictError` | 409 | Resource conflict |
| `DuplicateError` | 409 | Resource already exists |
| `RateLimitError` | 429 | Too many requests |
| `InsufficientDataError` | 422 | Not enough data for operation |

#### Server Errors (5xx)

| Class | HTTP Status | Use Case |
|-------|-------------|----------|
| `NexvoyError` | 500 | Generic server error |
| `DatabaseError` | 500 | Database operation failed |
| `ExternalServiceError` | 502 | External API error |
| `OTAAdapterError` | 502 | OTA partner error |
| `NetworkError` | 503 | Network connectivity issue |
| `TimeoutError` | 504 | Request timed out |
| `PriceError` | 500 | Price calculation error |

### Error Code Constants

Use the `ERROR_CODES` constant for consistency:

```javascript
const { ERROR_CODES } = require('./utils/errors');

// Available codes:
ERROR_CODES.VALIDATION_ERROR
ERROR_CODES.AUTHENTICATION_ERROR
ERROR_CODES.RESOURCE_NOT_FOUND
ERROR_CODES.OTA_ERROR
ERROR_CODES.TIMEOUT_ERROR
// ... and more
```

## Usage Examples

### In Services

```javascript
const { ValidationError, OTAAdapterError } = require('../utils/errors');

class FlightService {
  async searchFlights(params) {
    // Validate input
    if (!params.origin) {
      throw new MissingFieldError('origin');
    }
    
    if (!/^[A-Z]{3}$/.test(params.origin)) {
      throw new InvalidInputError('origin', {
        message: 'Origin must be a 3-letter airport code'
      });
    }
    
    // Call external API
    try {
      const results = await this.otaApi.search(params);
      return results;
    } catch (error) {
      // Convert external errors to NexvoyError
      throw new OTAAdapterError('Expedia', error);
    }
  }
}
```

### In Controllers

```javascript
const { asyncHandler } = require('../middleware/errorHandler');
const { FlightNotFoundError } = require('../utils/errors');

const getFlight = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const flight = await flightService.findById(id);
  
  if (!flight) {
    throw new FlightNotFoundError(id);
  }
  
  res.json({
    success: true,
    data: flight
  });
});
```

### Async Handler Wrapper

Always use `asyncHandler` for async route handlers:

```javascript
const { asyncHandler } = require('../middleware/errorHandler');

// Good - errors will be caught
router.get('/flights', asyncHandler(async (req, res) => {
  const flights = await searchFlights();
  res.json({ success: true, data: flights });
}));

// Bad - uncaught promise rejections
router.get('/flights', async (req, res) => {
  const flights = await searchFlights(); // May crash server!
  res.json({ success: true, data: flights });
});
```

## Error Middleware

### Setup in Express App

```javascript
const express = require('express');
const {
  errorHandler,
  notFoundHandler,
  requestIdMiddleware
} = require('./middleware/errorHandler');

const app = express();

// Add request ID to all requests
app.use(requestIdMiddleware);

// ... your routes ...

// 404 handler - must be before error handler
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);
```

### Middleware Order Matters

```javascript
// 1. Request ID (first)
app.use(requestIdMiddleware);

// 2. Body parser, auth, etc.
app.use(express.json());

// 3. Routes
app.use('/api', routes);

// 4. 404 handler (after routes)
app.use(notFoundHandler);

// 5. Error handler (last)
app.use(errorHandler);
```

## Error Logging

### Basic Logging

```javascript
const { getLogger } = require('./utils/logger');

const logger = getLogger();

// Log errors
logger.error(error, {
  userId: req.user?.id,
  requestId: req.id
});

// Log warnings
logger.warn('Rate limit approaching', { userId });

// Log info
logger.info('Flight search completed', { origin, destination });
```

### Automatic Logging

The error handler automatically logs all errors:

```javascript
// In your controller - just throw
throw new ValidationError('Invalid input');

// Error handler will automatically:
// 1. Log the error with context
// 2. Sanitize sensitive data
// 3. Send appropriate response
```

### Sentry Integration (Future)

To enable Sentry error tracking:

```javascript
const { configureLogger } = require('./utils/logger');

configureLogger({
  sentryEnabled: true,
  sentryDsn: process.env.SENTRY_DSN,
  sentryEnvironment: process.env.NODE_ENV,
  sentryRelease: process.env.SENTRY_RELEASE,
  
  // Optional: filter operational errors
  ignoreOperational: false,
  
  // Only send 5xx errors to Sentry
  minStatusCode: 500
});
```

Required dependency:
```bash
npm install @sentry/node
```

## Testing Errors

### Unit Tests

```javascript
const { ValidationError, FlightNotFoundError } = require('./utils/errors');

describe('Flight Service', () => {
  test('should throw ValidationError for invalid input', async () => {
    await expect(service.searchFlights({}))
      .rejects
      .toThrow(ValidationError);
  });
  
  test('should throw FlightNotFoundError', async () => {
    await expect(service.getFlight('invalid-id'))
      .rejects
      .toThrow(FlightNotFoundError);
  });
});
```

### Testing Error Responses

```javascript
describe('Flight Controller', () => {
  test('should return 404 for missing flight', async () => {
    const response = await request(app)
      .get('/api/flights/unknown-id')
      .expect(404);
    
    expect(response.body).toEqual({
      success: false,
      error: expect.stringContaining("couldn't find"),
      code: 'FLIGHT_NOT_FOUND',
      timestamp: expect.any(String)
    });
  });
});
```

## Error Handling Patterns

### Pattern 1: Validate Early

```javascript
const searchFlights = asyncHandler(async (req, res) => {
  const { origin, destination } = req.body;
  
  // Validate immediately
  if (!origin) throw new MissingFieldError('origin');
  if (!destination) throw new MissingFieldError('destination');
  
  // Proceed with business logic
  const results = await service.search(origin, destination);
  res.json({ success: true, data: results });
});
```

### Pattern 2: Convert External Errors

```javascript
async function callExternalApi(params) {
  try {
    return await axios.get(url, { params });
  } catch (error) {
    if (error.response?.status === 429) {
      throw new RateLimitError(60);
    }
    if (error.code === 'ETIMEDOUT') {
      throw new TimeoutError('External API');
    }
    throw new ExternalServiceError('Partner API', error.message);
  }
}
```

### Pattern 3: Enrich Errors with Context

```javascript
async function getFlightWithContext(id) {
  try {
    return await db.flights.findById(id);
  } catch (error) {
    if (error.name === 'CastError') {
      throw new ValidationError('Invalid flight ID format', {
        id,
        expectedFormat: 'MongoDB ObjectId'
      });
    }
    throw error;
  }
}
```

### Pattern 4: Operational vs Programming Errors

```javascript
const { isOperationalError } = require('./utils/errors');

// Operational errors (expected) - user-friendly message
if (isOperationalError(error)) {
  return res.status(error.statusCode).json(error.toJSON());
}

// Programming errors (bugs) - generic message, log details
logger.error('Unexpected error:', error);
return res.status(500).json({
  success: false,
  error: 'Something went wrong on our end.',
  code: 'INTERNAL_ERROR'
});
```

## HTTP Status Code Reference

| Status | Code | Meaning |
|--------|------|---------|
| 200 | OK | Success |
| 201 | Created | Resource created |
| 400 | Bad Request | Validation error |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource conflict |
| 422 | Unprocessable | Semantic error |
| 429 | Too Many Requests | Rate limited |
| 500 | Internal Error | Server error |
| 502 | Bad Gateway | External service error |
| 503 | Service Unavailable | Service down |
| 504 | Gateway Timeout | External timeout |

## Best Practices

### DO:

- ✅ Use specific error classes (e.g., `FlightNotFoundError` not `NotFoundError`)
- ✅ Provide user-friendly error messages
- ✅ Include helpful details for debugging
- ✅ Use `asyncHandler` for all async routes
- ✅ Log errors with context
- ✅ Test error scenarios

### DON'T:

- ❌ Throw generic `Error` objects
- ❌ Expose sensitive data in error messages
- ❌ Return technical jargon to users
- ❌ Use 500 for client errors
- ❌ Forget to use `asyncHandler`
- ❌ Ignore error handling in tests

## Migration Guide

### From Old Pattern:

```javascript
// Old way - inconsistent
try {
  const result = await service.search();
  res.json(result);
} catch (error) {
  console.error(error);
  res.status(500).json({ error: 'Internal Server Error' });
}
```

### To New Pattern:

```javascript
// New way - standardized
const { asyncHandler } = require('./middleware/errorHandler');

const search = asyncHandler(async (req, res) => {
  const result = await service.search();
  res.json({ success: true, data: result });
  // Errors automatically handled!
});
```

## Troubleshooting

### Error handler not catching errors?

- Make sure `asyncHandler` wraps all async functions
- Ensure error handler is the last middleware
- Check that you're throwing `NexvoyError` instances

### Stack traces not showing?

- Check `NODE_ENV` is set to `development`
- Verify error is not marked as `isOperational`

### Sentry not receiving errors?

- Verify `SENTRY_DSN` is configured
- Check `sentryEnabled` is `true`
- Ensure error status code >= `minStatusCode`

## Files Reference

```
backend/
├── src/
│   ├── middleware/
│   │   └── errorHandler.js    # Express error handling middleware
│   ├── utils/
│   │   ├── errors.js          # Error classes and constants
│   │   └── logger.js          # Error logging with Sentry prep
│   ├── controllers/
│   │   └── *.js               # Controllers using asyncHandler
│   └── services/
│       └── *.js               # Services throwing NexvoyErrors
└── tests/
    └── errorHandling.test.js  # Comprehensive test suite
```

## Additional Resources

- [Express Error Handling](https://expressjs.com/en/guide/error-handling.html)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [Sentry Node.js SDK](https://docs.sentry.io/platforms/node/)
