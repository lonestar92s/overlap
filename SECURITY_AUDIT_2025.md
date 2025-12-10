# Comprehensive Security Audit Report
**Date**: 2025-01-31  
**Scope**: Full Application (Mobile App + Backend)  
**Auditor**: DevOps Security Agent

---

## Executive Summary

**Overall Security Status**: 🟡 **Moderate Risk - Needs Attention**

The application has been improved since the previous audit, but several security vulnerabilities remain that should be addressed:

- **2 Critical Issues**: Hardcoded production URLs, missing security headers
- **6 High Priority Issues**: No rate limiting, excessive logging, token storage, CORS configuration
- **5 Medium Priority Issues**: Input validation gaps, error handling, dependency vulnerabilities

**Priority**: Address critical and high priority issues before production deployment.

---

## 🔴 Critical Security Issues

### 1. **Hardcoded Production API URL in Fallback Code**
**File**: `mobile-app/services/api.js:16`  
**Severity**: Critical  
**Issue**: Production backend URL hardcoded as fallback in development mode
```javascript
return process.env.EXPO_PUBLIC_API_URL || 
  (__DEV__ ? 'https://friendly-gratitude-production-3f31.up.railway.app/api' : '');
```
**Risk**:
- Production URL exposed in source code
- Makes it easier for attackers to identify backend infrastructure
- Difficult to change without code deployment
- Could accidentally route development traffic to production

**Fix Required**:
```javascript
const getApiBaseUrl = () => {
  if (!__DEV__ && !process.env.EXPO_PUBLIC_API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is required in production');
  }
  
  if (__DEV__ && !process.env.EXPO_PUBLIC_API_URL) {
    console.warn('⚠️ Using localhost - set EXPO_PUBLIC_API_URL for remote backend');
    return 'http://localhost:3001/api';
  }
  
  return process.env.EXPO_PUBLIC_API_URL;
};
```

---

### 2. **Missing Security Headers (Helmet)**
**File**: `overlap/backend/src/app.js`  
**Severity**: Critical  
**Issue**: No security headers middleware configured
**Risk**:
- Missing XSS protection headers
- No Content Security Policy
- Missing HSTS headers
- Vulnerable to clickjacking
- No X-Content-Type-Options protection

**Fix Required**:
```bash
npm install helmet
```

```javascript
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## 🟠 High Priority Security Issues

### 3. **No Rate Limiting**
**File**: `overlap/backend/src/app.js`  
**Severity**: High  
**Issue**: No rate limiting middleware on API endpoints
**Risk**:
- Vulnerable to brute force attacks on login endpoints
- API abuse and DoS attacks
- Unauthorized API key usage
- Resource exhaustion

**Fix Required**:
```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  skipSuccessfulRequests: true
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
```

---

### 4. **Excessive Console Logging in Production**
**Files**: Multiple (1560+ console.log statements found)  
**Severity**: High  
**Issue**: Console.log statements throughout codebase that could leak sensitive information
**Risk**:
- Sensitive data (tokens, user info) logged to console
- Performance impact in production
- Information disclosure through logs
- Makes debugging harder (signal-to-noise ratio)

**Examples Found**:
- `mobile-app/services/api.js:43` - Error logging with token context
- `overlap/backend/src/routes/search.js:2281` - Logging parsed queries with user data
- Multiple files logging full request/response data

**Fix Required**:
```javascript
// Create a logger utility
const logger = {
  log: (...args) => {
    if (__DEV__ || process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  },
  error: (...args) => {
    // Always log errors, but sanitize in production
    if (process.env.NODE_ENV === 'production') {
      // Send to error reporting service (Sentry)
      console.error('[ERROR]', sanitizeForLogging(...args));
    } else {
      console.error(...args);
    }
  }
};

// Replace all console.log with logger.log
// Replace all console.error with logger.error
```

---

### 5. **Unencrypted Token Storage**
**File**: `mobile-app/contexts/AuthContext.js:28`  
**Severity**: High  
**Issue**: JWT tokens stored in AsyncStorage without encryption
**Risk**:
- Tokens accessible if device is compromised
- No protection against root/jailbreak detection
- Tokens persist in plaintext storage

**Fix Required**:
```bash
npm install react-native-keychain
```

```javascript
import * as Keychain from 'react-native-keychain';

// Store token securely
await Keychain.setGenericPassword('authToken', token, {
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  service: 'com.yourapp.auth'
});

// Retrieve token
const credentials = await Keychain.getGenericPassword({
  service: 'com.yourapp.auth'
});
const token = credentials ? credentials.password : null;
```

---

### 6. **CORS Configuration Too Permissive**
**File**: `overlap/backend/src/app.js:32-57`  
**Severity**: High  
**Issue**: CORS allows requests with no origin (mobile apps), which could be exploited
**Risk**:
- Allows requests from any origin if no origin header present
- Could be exploited by malicious apps
- No validation of mobile app identity

**Current Code**:
```javascript
origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true); // ⚠️ TOO PERMISSIVE
    // ...
}
```

**Fix Required**:
```javascript
app.use(cors({
    origin: function (origin, callback) {
        // In production, require origin for web requests
        if (!origin && process.env.NODE_ENV === 'production') {
            // For mobile apps, validate via API key or user agent
            const userAgent = req.headers['user-agent'] || '';
            if (!userAgent.includes('YourAppName')) {
                return callback(new Error('Not allowed by CORS'));
            }
        }
        
        // Allow localhost in development
        if (process.env.NODE_ENV !== 'production') {
            if (!origin || origin.match(/^http:\/\/localhost:\d+$/)) {
                return callback(null, true);
            }
        }
        
        // Validate specific allowed origins
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

### 7. **Debug Endpoint Exposing Environment Info**
**File**: `overlap/backend/src/app.js:109-117`  
**Severity**: High  
**Issue**: Debug endpoint exposes which environment variables are set
**Risk**:
- Information disclosure about infrastructure
- Helps attackers understand system configuration
- Should be disabled in production

**Fix Required**:
```javascript
// Only enable in development
if (process.env.NODE_ENV !== 'production') {
    app.get('/api/debug/env', (req, res) => {
        res.json({
            NODE_ENV: process.env.NODE_ENV,
            // Don't expose which keys are set
        });
    });
}
```

---

### 8. **No Error Reporting Service**
**Severity**: High  
**Issue**: No error tracking service (Sentry/Bugsnag) configured
**Impact**:
- Production errors invisible
- Security incidents undetected
- No monitoring for suspicious activity
- Difficult to debug production issues

**Fix Required**:
```bash
# Mobile App
npm install @sentry/react-native

# Backend
npm install @sentry/node
```

---

## 🟡 Medium Priority Security Issues

### 9. **Insufficient Input Validation**
**Files**: Multiple route handlers  
**Severity**: Medium  
**Issue**: Some endpoints lack comprehensive input validation
**Examples**:
- `mobile-app/services/api.js:55` - Login endpoint doesn't validate email format client-side
- `overlap/backend/src/routes/search.js:2136` - Search query only checks length, not content
- Regex queries in MongoDB could be vulnerable to ReDoS attacks

**Fix Required**:
```javascript
// Use express-validator for input validation
const { body, query, validationResult } = require('express-validator');

router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    // ...
});

// Limit regex query length to prevent ReDoS
const MAX_QUERY_LENGTH = 100;
if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: 'Query too long' });
}
```

---

### 10. **XSS Vulnerability in Web Component**
**File**: `overlap/web/src/components/ItineraryBuilder.js:90`  
**Severity**: Medium  
**Issue**: Using `dangerouslySetInnerHTML` without sanitization
**Risk**:
- Cross-site scripting attacks
- Malicious script execution
- User data compromise

**Fix Required**:
```bash
npm install dompurify
```

```javascript
import DOMPurify from 'dompurify';

<Typography 
    variant="body2" 
    dangerouslySetInnerHTML={{ 
        __html: DOMPurify.sanitize(option.details) 
    }} 
/>
```

---

### 11. **NoSQL Injection Risk in Regex Queries**
**Files**: Multiple search endpoints  
**Severity**: Medium  
**Issue**: User input used directly in MongoDB regex queries
**Risk**:
- ReDoS (Regular Expression Denial of Service) attacks
- Potential NoSQL injection if input not properly escaped

**Current Code**:
```javascript
Venue.find({
    $or: [
        { name: { $regex: query, $options: 'i' } }, // ⚠️ User input in regex
    ]
})
```

**Fix Required**:
```javascript
// Escape special regex characters
const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Limit query length
if (query.length > 100) {
    return res.status(400).json({ error: 'Query too long' });
}

Venue.find({
    $or: [
        { name: { $regex: escapeRegex(query), $options: 'i' } },
    ]
})
```

---

### 12. **Weak JWT Secret Validation**
**File**: `overlap/backend/src/config/env.js:15,28`  
**Severity**: Medium  
**Issue**: JWT secret has weak default in development, no validation in production
**Risk**:
- If NODE_ENV not set correctly, weak secret could be used
- No validation that secret is strong enough

**Fix Required**:
```javascript
const validateJwtSecret = (secret) => {
    if (!secret) {
        throw new Error('JWT_SECRET is required');
    }
    if (secret.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters');
    }
    if (secret === 'dev-secret-key-change-in-production') {
        throw new Error('JWT_SECRET cannot use default development value');
    }
    return secret;
};

const config = {
    production: {
        jwtSecret: validateJwtSecret(process.env.JWT_SECRET),
        // ...
    }
};
```

---

### 13. **Missing Request Size Limits**
**File**: `overlap/backend/src/app.js:59`  
**Severity**: Medium  
**Issue**: No explicit body size limit configured
**Risk**:
- DoS attacks via large payloads
- Memory exhaustion
- Server crashes

**Fix Required**:
```javascript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

---

## Common Security Issues in AI-Coded Applications

Based on analysis of your codebase and common patterns in AI-generated code, here are the most frequent security issues:

### 1. **Hardcoded Secrets and URLs**
- ✅ **Your Status**: Partially fixed (Mapbox token moved to env, but production URL still hardcoded)
- **Common Pattern**: AI often includes fallback values that become hardcoded secrets
- **Solution**: Always use environment variables, fail fast if missing

### 2. **Missing Input Validation**
- ⚠️ **Your Status**: Some validation exists, but gaps remain
- **Common Pattern**: AI generates basic validation but misses edge cases
- **Solution**: Use validation libraries (express-validator, joi) consistently

### 3. **Excessive Logging**
- 🔴 **Your Status**: 1560+ console.log statements found
- **Common Pattern**: AI adds extensive logging for debugging but doesn't gate it
- **Solution**: Use proper logging library with environment-based levels

### 4. **No Rate Limiting**
- 🔴 **Your Status**: No rate limiting implemented
- **Common Pattern**: AI doesn't include rate limiting by default
- **Solution**: Always add rate limiting to auth and public endpoints

### 5. **Insecure Token Storage**
- ⚠️ **Your Status**: Tokens in AsyncStorage (unencrypted)
- **Common Pattern**: AI uses simple storage without considering encryption
- **Solution**: Use secure storage (Keychain/Keystore) for sensitive data

### 6. **Missing Security Headers**
- 🔴 **Your Status**: No Helmet middleware
- **Common Pattern**: AI doesn't include security middleware by default
- **Solution**: Always use Helmet for Express apps

### 7. **CORS Misconfiguration**
- ⚠️ **Your Status**: Too permissive (allows no-origin requests)
- **Common Pattern**: AI generates permissive CORS for development
- **Solution**: Strict CORS with environment-based configuration

### 8. **No Error Reporting**
- 🔴 **Your Status**: No Sentry/Bugsnag configured
- **Common Pattern**: AI doesn't set up monitoring services
- **Solution**: Integrate error reporting early in development

---

## Security Checklist

### Immediate Actions (This Week)
- [ ] Remove hardcoded production URL from `mobile-app/services/api.js`
- [ ] Install and configure Helmet middleware
- [ ] Add rate limiting to all API endpoints
- [ ] Disable debug endpoint in production
- [ ] Replace AsyncStorage with react-native-keychain for tokens

### High Priority (Within 2 Weeks)
- [ ] Set up Sentry for error reporting (mobile + backend)
- [ ] Replace console.log with proper logging utility
- [ ] Tighten CORS configuration
- [ ] Add input validation to all endpoints
- [ ] Sanitize XSS vulnerabilities in web components

### Medium Priority (Within 1 Month)
- [ ] Add request size limits
- [ ] Escape regex queries to prevent ReDoS
- [ ] Validate JWT secret strength
- [ ] Add security headers to mobile app
- [ ] Implement request ID tracking for audit logs

---

## Recommendations

1. **Security Headers**: Always use Helmet for Express applications
2. **Rate Limiting**: Implement on all public endpoints, especially auth
3. **Error Reporting**: Set up Sentry/Bugsnag before production
4. **Input Validation**: Use express-validator or joi for all user input
5. **Secure Storage**: Never store tokens/secrets in plaintext
6. **Logging**: Use proper logging library with environment-based levels
7. **Dependency Scanning**: Run `npm audit` regularly and fix vulnerabilities
8. **Secrets Management**: Use EAS Secrets or similar for production builds
9. **Code Review**: Review all AI-generated code for security issues
10. **Security Testing**: Add security tests to CI/CD pipeline

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [React Native Security](https://reactnative.dev/docs/security)
- [Expo Security Guide](https://docs.expo.dev/guides/security/)

---

**Report Generated**: 2025-01-31  
**Next Review**: 2025-04-30


