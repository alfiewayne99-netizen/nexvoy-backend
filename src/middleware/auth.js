const jwt = require('jsonwebtoken');
const { promisify } = require('util');

// JWT verify promisified
const jwtVerify = promisify(jwt.verify);

// Secure JWT secret - must be set in environment
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_ISSUER = process.env.JWT_ISSUER || 'nexvoy-api';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'nexvoy-client';

// Validate JWT secret on startup
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters long');
  process.exit(1);
}

/**
 * Main authentication middleware
 * Verifies JWT token from Authorization header or cookies
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookie
    let token = null;
    
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // Fallback to cookie if no header
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    // No token found
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    }

    // Verify token with strict options
    const decoded = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'] // Only allow secure algorithm
    });

    // Check token expiration explicitly
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return res.status(401).json({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Validate required fields
    if (!decoded.userId || !decoded.role) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token payload',
        code: 'INVALID_PAYLOAD'
      });
    }

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      iat: decoded.iat,
      exp: decoded.exp
    };

    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'NotBeforeError') {
      return res.status(401).json({
        success: false,
        error: 'Token not active',
        code: 'TOKEN_NOT_ACTIVE'
      });
    }

    // Generic error
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

/**
 * Role-based authorization middleware
 * Usage: authorize('admin') or authorize(['admin', 'moderator'])
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Must be called after authenticate middleware
    if (!req.user) {
      return res.status(500).json({
        success: false,
        error: 'Authorization check without authentication',
        code: 'AUTH_MIDDLEWARE_ERROR'
      });
    }

    const userRole = req.user.role;
    const roles = allowedRoles.flat(); // Handle both array and rest params

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        requiredRoles: roles,
        userRole: userRole
      });
    }

    next();
  };
};

/**
 * Optional authentication - attaches user if token valid, continues regardless
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = await jwtVerify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithms: ['HS256']
      });

      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        iat: decoded.iat,
        exp: decoded.exp
      };
    }

    next();
  } catch (error) {
    // Continue without user - optional auth
    next();
  }
};

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role || 'user'
  };

  const options = {
    expiresIn: JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  };

  return jwt.sign(payload, JWT_SECRET, options);
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (user) => {
  const payload = {
    userId: user.id,
    type: 'refresh'
  };

  const options = {
    expiresIn: '7d',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  };

  return jwt.sign(payload, JWT_SECRET, options);
};

/**
 * Set secure cookie with token
 */
const setTokenCookie = (res, token, isRefresh = false) => {
  const maxAge = isRefresh ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 7 days or 24 hours
  const cookieName = isRefresh ? 'refreshToken' : 'token';
  
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: maxAge,
    path: isRefresh ? '/api/auth/refresh' : '/'
  });
};

/**
 * Clear auth cookies
 */
const clearTokenCookies = (res) => {
  res.clearCookie('token', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
};

/**
 * Require admin role middleware
 */
const requireAdmin = authorize('admin');

module.exports = {
  authenticate,
  authorize,
  requireAdmin,
  optionalAuth,
  generateToken,
  generateRefreshToken,
  setTokenCookie,
  clearTokenCookies,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_ISSUER,
  JWT_AUDIENCE
};
