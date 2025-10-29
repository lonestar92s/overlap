# Environment Configuration Guide

This guide explains how to differentiate between development and production environments in your application.

## Backend (Node.js/Express)

### Setting Environment Variables

The backend uses `NODE_ENV` to determine the environment:

**Development:**
```bash
# Option 1: Set in command line
NODE_ENV=development npm run dev

# Option 2: Set in .env file (recommended)
NODE_ENV=development
```

**Production:**
```bash
# Option 1: Set in command line
NODE_ENV=production npm start

# Option 2: Set in .env file
NODE_ENV=production
```

### Checking Environment in Code

```javascript
// Check if development
if (process.env.NODE_ENV !== 'production') {
  console.log('Running in development mode');
}

// Check if production
if (process.env.NODE_ENV === 'production') {
  console.log('Running in production mode');
}

// Common pattern
const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';
```

### Package.json Scripts

The `package.json` scripts automatically set `NODE_ENV`:

```json
{
  "scripts": {
    "start": "NODE_ENV=production node src/app.js",
    "dev": "NODE_ENV=development nodemon src/app.js"
  }
}
```

**Usage:**
- Development: `npm run dev`
- Production: `npm start`

## Frontend (React Native/Expo)

### Using __DEV__

React Native automatically sets `__DEV__` to `true` in development and `false` in production builds.

```javascript
// Check if development
if (__DEV__) {
  console.log('Running in development mode');
  // Use localhost API
  const API_URL = 'http://localhost:3001/api';
}

// Check if production
if (!__DEV__) {
  console.log('Running in production mode');
  // Use production API
  const API_URL = 'https://your-production-api.com/api';
}

// Ternary pattern
const API_URL = __DEV__ 
  ? 'http://localhost:3001/api'  // Development
  : 'https://your-production-api.com/api';  // Production
```

### Using Expo Environment Variables

For more control, you can use Expo's environment variables:

**Create `.env` file in mobile-app directory:**
```env
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

**Access in code:**
```javascript
const API_URL = process.env.EXPO_PUBLIC_API_URL || 
  (__DEV__ ? 'http://localhost:3001/api' : 'https://production-api.com/api');
```

> **Note:** Only variables prefixed with `EXPO_PUBLIC_` are available in your app code.

## Current Configuration

### Backend API URLs

**Development:**
- URL: `http://localhost:3001/api`
- Used when: `NODE_ENV !== 'production'`

**Production:**
- URL: `https://friendly-gratitude-production-3f31.up.railway.app/api`
- Used when: `NODE_ENV === 'production'`

### Frontend API URLs

**Development (`__DEV__ === true`):**
- URL: `http://localhost:3001/api`
- Automatically used when running in Expo development mode

**Production (`__DEV__ === false`):**
- URL: `https://friendly-gratitude-production-3f31.up.railway.app/api`
- Used in production builds (EAS Build, standalone builds)

## Environment Detection Examples

### Backend Examples

```javascript
// routes/auth.js
const isDevelopment = process.env.NODE_ENV !== 'production';

if (isDevelopment) {
  // Show reset token in development
  res.json({ resetToken, resetUrl });
} else {
  // Don't show token in production
  res.json({ message: 'Reset link sent' });
}
```

### Frontend Examples

```javascript
// services/api.js
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3001/api'
  : 'https://production-api.com/api';

// Show debug info only in development
if (__DEV__) {
  console.log('API URL:', API_BASE_URL);
  console.log('Reset token:', response.resetToken);
}
```

## Testing Different Environments

### Test Development Mode

**Backend:**
```bash
cd overlap/backend
NODE_ENV=development npm run dev
```

**Frontend:**
```bash
cd mobile-app
npm start
# Opens Expo dev tools - automatically uses __DEV__ = true
```

### Test Production Mode

**Backend:**
```bash
cd overlap/backend
NODE_ENV=production npm start
```

**Frontend:**
```bash
cd mobile-app
eas build
# Creates production build where __DEV__ = false
```

## Important Notes

1. **Backend `NODE_ENV`:**
   - Must be explicitly set
   - Defaults to `undefined` if not set
   - Used for: API URLs, logging, security settings

2. **Frontend `__DEV__`:**
   - Automatically set by React Native/Metro bundler
   - `true` in development mode (Expo Go, dev builds)
   - `false` in production builds (EAS Build, standalone apps)
   - Cannot be manually overridden

3. **Security:**
   - Never expose sensitive tokens in production
   - Use environment variables for API keys
   - Keep `.env` files out of version control

## Troubleshooting

### Backend always thinks it's in development
- Check your `.env` file: Make sure `NODE_ENV=production` is set
- Check Railway/production platform: Set `NODE_ENV` environment variable in platform settings

### Frontend always uses production URL
- Check if you're running a production build (EAS Build)
- In development, `__DEV__` should be `true` automatically
- Check console logs to verify `__DEV__` value

### API connection issues
- Development: Make sure backend is running on `localhost:3001`
- Production: Verify the production API URL is correct
- Check network settings and CORS configuration

