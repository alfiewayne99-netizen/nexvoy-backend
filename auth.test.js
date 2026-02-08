/**
 * Authentication Test Suite
 * Tests: Valid token, Expired token, No token, Wrong role
 */

// Set test environment BEFORE any imports
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-that-is-32-chars-long-for-security';
process.env.JWT_ISSUER = 'nexvoy-api-test';
process.env.JWT_AUDIENCE = 'nexvoy-client-test';

const jwt = require('jsonwebtoken');
const request = require('supertest');

// Import app and auth module after setting env
const app = require('./app');
const { generateToken, JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } = require('./src/middleware/auth');
const { users } = require('./src/controllers/authController');

// Debug log
console.log('JWT_ISSUER:', JWT_ISSUER);
console.log('JWT_AUDIENCE:', JWT_AUDIENCE);

// Test results collector
const testResults = [];

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  testResults.push({ name, passed, details });
  console.log(`${status}: ${name}`);
  if (details && !passed) console.log(`   ${details}`);
}

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🔒 NEXVOY AUTHENTICATION SECURITY TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Log seeded users
  console.log(`--- Users seeded: ${users.size} ---\n`);

  let adminToken, userToken, expiredToken, invalidToken;

  // Setup: Generate test tokens
  console.log('--- SETUP: Generating Test Tokens ---\n');
  
  try {
    // Valid admin token
    const adminUser = { id: 'admin-001', email: 'admin@nexvoy.com', role: 'admin' };
    adminToken = generateToken(adminUser);
    console.log('✓ Admin token generated');

    // Valid user token
    const regularUser = { id: 'user-001', email: 'user@nexvoy.com', role: 'user' };
    userToken = generateToken(regularUser);
    console.log('✓ User token generated');

    // Expired token (issued 2 days ago, expired 1 day ago)
    const twoDaysAgo = Math.floor(Date.now() / 1000) - (2 * 86400);
    const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
    expiredToken = jwt.sign(
      { 
        userId: 'user-001', 
        email: 'user@nexvoy.com', 
        role: 'user',
        iat: twoDaysAgo,
        exp: oneDayAgo
      },
      JWT_SECRET,
      { 
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      }
    );
    console.log('✓ Expired token generated');

    // Invalid token (wrong secret)
    invalidToken = jwt.sign(
      { userId: 'user-001', email: 'user@nexvoy.com', role: 'user' },
      'wrong-secret-key-that-is-32-chars-long-for-tests'
    );
    console.log('✓ Invalid token generated');

    console.log('\n');
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }

  // Test 1: Valid Admin Token
  console.log('--- TEST 1: Valid Admin Token ---');
  try {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    
    logTest(
      'Admin can access admin routes with valid token',
      res.status === 200 && res.body.success === true,
      `Status: ${res.status}, Body: ${JSON.stringify(res.body)}`
    );
  } catch (error) {
    logTest('Admin can access admin routes with valid token', false, error.message);
  }

  // Test 2: Valid User Token (non-admin accessing admin route)
  console.log('\n--- TEST 2: Wrong Role (User accessing Admin route) ---');
  try {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${userToken}`);
    
    logTest(
      'Regular user CANNOT access admin routes (403 Forbidden)',
      res.status === 403 && res.body.code === 'FORBIDDEN',
      `Status: ${res.status}, Body: ${JSON.stringify(res.body)}`
    );
  } catch (error) {
    logTest('Regular user CANNOT access admin routes', false, error.message);
  }

  // Test 3: No Token
  console.log('\n--- TEST 3: No Token ---');
  try {
    const res = await request(app)
      .get('/api/admin/dashboard');
    
    logTest(
      'Admin routes reject requests without token (401 Unauthorized)',
      res.status === 401 && res.body.code === 'NO_TOKEN',
      `Status: ${res.status}, Body: ${JSON.stringify(res.body)}`
    );
  } catch (error) {
    logTest('Admin routes reject requests without token', false, error.message);
  }

  // Test 4: Expired Token
  console.log('\n--- TEST 4: Expired Token ---');
  try {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${expiredToken}`);
    
    logTest(
      'Expired tokens are rejected (401 Unauthorized)',
      res.status === 401 && (res.body.code === 'TOKEN_EXPIRED' || res.body.code === 'AUTH_FAILED'),
      `Status: ${res.status}, Body: ${JSON.stringify(res.body)}`
    );
  } catch (error) {
    logTest('Expired tokens are rejected', false, error.message);
  }

  // Test 5: Invalid/Wrong Secret Token
  console.log('\n--- TEST 5: Invalid Token (Wrong Secret) ---');
  try {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${invalidToken}`);
    
    logTest(
      'Tokens with wrong secret are rejected (401 Unauthorized)',
      res.status === 401 && (res.body.code === 'INVALID_TOKEN' || res.body.code === 'AUTH_FAILED'),
      `Status: ${res.status}, Body: ${JSON.stringify(res.body)}`
    );
  } catch (error) {
    logTest('Tokens with wrong secret are rejected', false, error.message);
  }

  // Test 6: Malformed Token
  console.log('\n--- TEST 6: Malformed Token ---');
  try {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', 'Bearer not-a-valid-token-format');
    
    logTest(
      'Malformed tokens are rejected (401 Unauthorized)',
      res.status === 401,
      `Status: ${res.status}, Body: ${JSON.stringify(res.body)}`
    );
  } catch (error) {
    logTest('Malformed tokens are rejected', false, error.message);
  }

  // Test 7: Valid user accessing user routes
  console.log('\n--- TEST 7: Valid User accessing User Routes ---');
  try {
    const res = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${userToken}`);
    
    logTest(
      'Regular user CAN access user routes with valid token',
      res.status === 200 && res.body.success === true,
      `Status: ${res.status}, Body: ${JSON.stringify(res.body)}`
    );
  } catch (error) {
    logTest('Regular user can access user routes', false, error.message);
  }

  // Test 8: Auth middleware applied to all admin routes
  console.log('\n--- TEST 8: Auth Middleware on ALL Admin Routes ---');
  const adminEndpoints = [
    '/api/admin/dashboard',
    '/api/admin/users',
    '/api/admin/users/123',
    '/api/admin/bookings',
    '/api/admin/settings',
    '/api/admin/audit-log'
  ];

  let allProtected = true;
  for (const endpoint of adminEndpoints) {
    const res = await request(app).get(endpoint);
    if (res.status !== 401 && res.status !== 403) {
      allProtected = false;
      console.log(`   ❌ ${endpoint} returned ${res.status} (expected 401 or 403)`);
    }
  }
  
  logTest(
    'ALL admin routes require authentication',
    allProtected,
    'Some admin endpoints are not protected'
  );

  // Test 9: Public routes are accessible
  console.log('\n--- TEST 9: Public Routes Accessibility ---');
  try {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@nexvoy.com', password: 'AdminSecure123!' });
    
    logTest(
      'Public routes (login) are accessible without token',
      res.status === 200 && res.body.success === true,
      `Status: ${res.status}, Body: ${JSON.stringify(res.body)}`
    );
  } catch (error) {
    logTest('Public routes are accessible', false, error.message);
  }

  // Test 10: JWT Secret Validation
  console.log('\n--- TEST 10: JWT Secret Validation ---');
  try {
    // Check that JWT_SECRET is properly loaded and is at least 32 chars
    const isValid = JWT_SECRET && JWT_SECRET.length >= 32;
    
    logTest(
      'JWT_SECRET must be set and >= 32 characters',
      isValid,
      `Length: ${JWT_SECRET?.length || 0}`
    );
  } catch (error) {
    logTest('JWT_SECRET validation', false, error.message);
  }

  // Test 11: Token payload structure
  console.log('\n--- TEST 11: Token Payload Structure ---');
  try {
    const decoded = jwt.verify(adminToken, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
    
    const hasUserId = typeof decoded.userId === 'string';
    const hasEmail = typeof decoded.email === 'string';
    const hasRole = typeof decoded.role === 'string';
    const hasExp = typeof decoded.exp === 'number';
    const hasIat = typeof decoded.iat === 'number';
    
    logTest(
      'Token contains required payload fields',
      hasUserId && hasEmail && hasRole && hasExp && hasIat,
      `userId: ${hasUserId}, email: ${hasEmail}, role: ${hasRole}, exp: ${hasExp}, iat: ${hasIat}`
    );
  } catch (error) {
    logTest('Token payload structure', false, error.message);
  }

  // Test 12: Secure cookie settings
  console.log('\n--- TEST 12: Secure Cookie Configuration ---');
  try {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@nexvoy.com', password: 'AdminSecure123!' });
    
    // Check if login succeeded
    if (res.status !== 200) {
      logTest(
        'Auth cookies use secure settings (HttpOnly, SameSite)',
        false,
        `Login failed: ${res.body.error}`
      );
    } else {
      const cookies = res.headers['set-cookie'];
      const hasHttpOnly = cookies && cookies.some(c => c && c.includes('HttpOnly'));
      const hasSameSite = cookies && cookies.some(c => c && c.includes('SameSite'));
      
      logTest(
        'Auth cookies use secure settings (HttpOnly, SameSite)',
        hasHttpOnly && hasSameSite,
        `Cookies present: ${!!cookies}, HttpOnly: ${hasHttpOnly}, SameSite: ${hasSameSite}`
      );
    }
  } catch (error) {
    logTest('Secure cookie configuration', false, error.message);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  
  const passed = testResults.filter(t => t.passed).length;
  const failed = testResults.filter(t => !t.passed).length;
  const total = testResults.length;
  
  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`\nSuccess Rate: ${Math.round((passed / total) * 100)}%`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.filter(t => !t.passed).forEach(t => {
      console.log(`   - ${t.name}`);
    });
  }
  
  console.log('\n═══════════════════════════════════════════════════════════\n');

  return { passed, failed, total };
}

// Run tests if executed directly
if (require.main === module) {
  runTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };
