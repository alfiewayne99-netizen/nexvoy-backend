# Nexvoy Backend - Security Implementation

## Critical Authentication Fixes Applied

### 1. ✅ Auth Middleware Applied to ALL Admin Routes
- File: `backend/src/routes/adminRoutes.js`
- Applied `authenticate` and `authorize('admin')` middleware to ALL routes using `router.use()`
- No route can bypass authentication

### 2. ✅ JWT Verification - Proper Secret Validation
- File: `backend/src/middleware/auth.js`
- JWT secret must be ≥32 characters (enforced at startup)
- Strict validation: issuer, audience, algorithm (HS256 only)
- Tokens are verified with `jwt.verify()` - no bypass possible
- Proper error handling for expired, invalid, and malformed tokens

### 3. ✅ Role-Based Access Control (RBAC)
- Admin role: `'admin'` - full access to admin routes
- User role: `'user'` - access to user routes only
- Middleware: `authorize('admin')` checks role and returns 403 if insufficient
- Roles are embedded in JWT payload and verified on each request

### 4. ✅ Session Management - Secure Cookies
- HTTPOnly cookies (XSS protection)
- SameSite=strict (CSRF protection)
- Secure flag in production (HTTPS only)
- Proper expiration: 24h access token, 7d refresh token
- Token refresh endpoint for seamless UX

## File Structure

```
backend/
├── app.js                          # Express app with security middleware
├── auth.test.js                    # Comprehensive test suite
├── package.json
├── src/
│   ├── middleware/
│   │   └── auth.js                 # JWT authentication & authorization
│   ├── controllers/
│   │   └── authController.js       # Login, register, logout, refresh
│   ├── routes/
│   │   ├── index.js                # Route mounting with auth
│   │   ├── authRoutes.js           # Public + protected auth routes
│   │   ├── adminRoutes.js          # Admin-only routes (ALL protected)
│   │   ├── userRoutes.js           # User routes (protected)
│   │   ├── bookingRoutes.js        # Booking routes (protected)
│   │   └── searchRoutes.js         # Search routes (optional auth)
│   └── models/                     # Database models (add as needed)
└── .env.example                    # Environment variables template
```

## Environment Variables

```bash
# Required
JWT_SECRET=your-super-secret-key-min-32-chars-long

# Optional (defaults shown)
NODE_ENV=development
PORT=3001
JWT_EXPIRES_IN=24h
JWT_ISSUER=nexvoy-api
JWT_AUDIENCE=nexvoy-client
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Test Results

```
✅ PASS: Admin can access admin routes with valid token
✅ PASS: Regular user CANNOT access admin routes (403 Forbidden)
✅ PASS: Admin routes reject requests without token (401 Unauthorized)
✅ PASS: Expired tokens are rejected (401 Unauthorized)
✅ PASS: Tokens with wrong secret are rejected (401 Unauthorized)
✅ PASS: Malformed tokens are rejected (401 Unauthorized)
✅ PASS: Regular user CAN access user routes with valid token
✅ PASS: ALL admin routes require authentication
✅ PASS: Public routes (login) are accessible without token
✅ PASS: JWT_SECRET must be set and >= 32 characters
✅ PASS: Token contains required payload fields
✅ PASS: Auth cookies use secure settings (HttpOnly, SameSite)

Total: 12/12 tests passed (100%)
```

## API Endpoints

### Public Endpoints
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Authenticate
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/health` - Health check

### Protected Endpoints (requires authentication)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/password` - Change password
- `GET /api/user/profile` - User profile
- `PUT /api/user/profile` - Update profile
- All `/api/bookings/*` routes

### Admin Endpoints (requires admin role)
- `GET /api/admin/dashboard` - Admin dashboard
- `GET /api/admin/users` - List users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/bookings` - List all bookings
- `GET /api/admin/settings` - Get settings
- `PUT /api/admin/settings` - Update settings
- `GET /api/admin/audit-log` - View audit log

## Security Features

1. **Rate Limiting**: 100 req/15min general, 5 req/15min for auth endpoints
2. **Helmet**: Security headers (XSS, CSRF, clickjacking protection)
3. **CORS**: Configurable origin whitelist
4. **Password Hashing**: bcrypt with salt rounds 12
5. **Input Validation**: Email format, password strength
6. **Error Handling**: Generic messages to prevent information leakage

## Running the Application

```bash
cd backend
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your values

# Run tests
npm test

# Start server
npm start

# Development mode
npm run dev
```

## Default Test Credentials

- **Admin**: `admin@nexvoy.com` / `AdminSecure123!`
- **User**: `user@nexvoy.com` / `UserSecure123!`
