const bcrypt = require('bcrypt');
const { generateToken, generateRefreshToken, setTokenCookie, clearTokenCookies } = require('../middleware/auth');

// In-memory user store (replace with database in production)
// Passwords are hashed with bcrypt
const users = new Map();

// Seed admin user synchronously using bcrypt.hashSync for testing
const seedAdminUser = () => {
  const adminEmail = 'admin@nexvoy.com';
  if (!users.has(adminEmail)) {
    const hashedPassword = bcrypt.hashSync('AdminSecure123!', 12);
    users.set(adminEmail, {
      id: 'admin-001',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      name: 'System Administrator',
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true
    });
    console.log('Admin user seeded');
  }
};

// Seed regular user
const seedRegularUser = () => {
  const userEmail = 'user@nexvoy.com';
  if (!users.has(userEmail)) {
    const hashedPassword = bcrypt.hashSync('UserSecure123!', 12);
    users.set(userEmail, {
      id: 'user-001',
      email: userEmail,
      password: hashedPassword,
      role: 'user',
      name: 'Regular User',
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true
    });
    console.log('Regular user seeded');
  }
};

// Initialize users synchronously
seedAdminUser();
seedRegularUser();

/**
 * Register new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and name are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Password strength validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long',
        code: 'WEAK_PASSWORD'
      });
    }

    // Check if user exists
    if (users.has(email)) {
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        code: 'USER_EXISTS'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const userId = `user-${Date.now()}`;
    const newUser = {
      id: userId,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'user', // Default role
      name: name,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true
    };

    users.set(email.toLowerCase(), newUser);

    // Generate tokens
    const token = generateToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    // Set cookies
    setTokenCookie(res, token);
    setTokenCookie(res, refreshToken, true);

    // Return success (without password)
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: userWithoutPassword,
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Find user
    const user = users.get(email.toLowerCase());

    // Check user exists and is active
    if (!user || !user.isActive) {
      // Use same error message to prevent user enumeration
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Update last login
    user.lastLogin = new Date().toISOString();

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set cookies
    setTokenCookie(res, token);
    setTokenCookie(res, refreshToken, true);

    // Return success (without password)
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
const logout = (req, res) => {
  try {
    // Clear cookies
    clearTokenCookies(res);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
};

/**
 * Refresh token
 * POST /api/auth/refresh
 */
const refresh = async (req, res) => {
  try {
    const { promisify } = require('util');
    const jwt = require('jsonwebtoken');
    const jwtVerify = promisify(jwt.verify);
    
    const { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } = require('../middleware/auth');

    // Get refresh token from body or cookie
    let refreshToken = req.body.refreshToken;
    if (!refreshToken && req.cookies && req.cookies.refreshToken) {
      refreshToken = req.cookies.refreshToken;
    }

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token required',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    // Verify refresh token
    const decoded = await jwtVerify(refreshToken, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256']
    });

    // Check token type
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    // Find user
    const user = Array.from(users.values()).find(u => u.id === decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive',
        code: 'USER_INVALID'
      });
    }

    // Generate new tokens
    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Set cookies
    setTokenCookie(res, newToken);
    setTokenCookie(res, newRefreshToken, true);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Refresh token has expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    res.status(401).json({
      success: false,
      error: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
const getProfile = (req, res) => {
  try {
    // User is attached by authenticate middleware
    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile',
      code: 'PROFILE_ERROR'
    });
  }
};

/**
 * Change password
 * PUT /api/auth/password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
        code: 'MISSING_PASSWORDS'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long',
        code: 'WEAK_PASSWORD'
      });
    }

    // Find user
    const user = Array.from(users.values()).find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verify current password
    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Hash and update new password
    user.password = await bcrypt.hash(newPassword, 12);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password',
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
};

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
        code: 'MISSING_EMAIL'
      });
    }

    // Check if user exists
    const user = users.get(email.toLowerCase());
    
    // Always return success to prevent user enumeration
    // In production, send actual email
    if (user) {
      // Generate reset token (valid for 1 hour)
      const resetToken = generateToken({ 
        userId: user.id, 
        email: user.email,
        type: 'password_reset' 
      });
      
      // In production: Send email with reset link
      // await sendPasswordResetEmail(user.email, resetToken);
      
      console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, password reset instructions have been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process request',
      code: 'FORGOT_PASSWORD_ERROR'
    });
  }
};

/**
 * Reset password with token
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required',
        code: 'MISSING_FIELDS'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long',
        code: 'WEAK_PASSWORD'
      });
    }

    // Verify token
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN'
      });
    }

    // Check token type
    if (decoded.type !== 'password_reset') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type',
        code: 'INVALID_TOKEN_TYPE'
      });
    }

    // Find user
    const user = Array.from(users.values()).find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Update password
    user.password = await bcrypt.hash(newPassword, 12);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
      code: 'RESET_PASSWORD_ERROR'
    });
  }
};

/**
 * Initiate Google OAuth
 * GET /api/auth/google
 */
const googleAuth = (req, res) => {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const REDIRECT_URI = `${process.env.API_URL || 'http://localhost:3001'}/api/auth/google/callback`;
  
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({
      success: false,
      error: 'Google OAuth not configured',
      code: 'GOOGLE_AUTH_NOT_CONFIGURED'
    });
  }

  const scope = encodeURIComponent('openid email profile');
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=${scope}&` +
    `access_type=offline&` +
    `prompt=consent`;

  res.redirect(authUrl);
};

/**
 * Handle Google OAuth callback
 * POST /api/auth/google/callback
 */
const googleCallback = async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code required',
        code: 'MISSING_CODE'
      });
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    const REDIRECT_URI = `${process.env.API_URL || 'http://localhost:3001'}/api/auth/google/callback`;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Google OAuth not configured',
        code: 'GOOGLE_AUTH_NOT_CONFIGURED'
      });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('Google token exchange failed:', tokenData);
      return res.status(400).json({
        success: false,
        error: 'Failed to authenticate with Google',
        code: 'GOOGLE_AUTH_FAILED'
      });
    }

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const googleUser = await userResponse.json();
    
    if (!userResponse.ok) {
      return res.status(400).json({
        success: false,
        error: 'Failed to get user info from Google',
        code: 'GOOGLE_USER_INFO_FAILED'
      });
    }

    // Check if user exists
    let user = users.get(googleUser.email.toLowerCase());
    
    if (!user) {
      // Create new user from Google data
      const userId = `user-${Date.now()}`;
      user = {
        id: userId,
        email: googleUser.email.toLowerCase(),
        password: null, // No password for OAuth users
        role: 'user',
        name: googleUser.name || googleUser.email.split('@')[0],
        avatar: googleUser.picture,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        isActive: true,
        authProvider: 'google'
      };
      users.set(user.email, user);
    } else {
      // Update last login
      user.lastLogin = new Date().toISOString();
    }

    // Generate tokens
    const authToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Return success (without password)
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token: authToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Google callback error:', error);
    res.status(500).json({
      success: false,
      error: 'Google authentication failed',
      code: 'GOOGLE_AUTH_ERROR'
    });
  }
};

// Export for testing
module.exports = {
  register,
  login,
  logout,
  refresh,
  getProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  googleAuth,
  googleCallback,
  users // Exported for testing only
};
