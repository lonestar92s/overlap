# Quick Fix: Network Request Failed Errors

## Problem
The mobile app shows:
- `Network request failed` errors
- `Token validation failed`
- Cannot connect to backend API

## Root Cause
The app is trying to connect to `http://localhost:3001/api`, but:
1. **Backend may not be running**
2. **localhost doesn't work in Expo Go** - you need to use your machine's IP address
3. **Environment variable not set**

## Solutions

### Solution 1: Use Production Backend (Recommended)

**This is the default and recommended approach.** Use your production backend:

1. Create `.env` file in `mobile-app/`:
```bash
cd flight-match-finder/mobile-app
touch .env
```

2. Add your production API URL (this should be the default):
```env
EXPO_PUBLIC_API_URL=https://friendly-gratitude-production-3f31.up.railway.app/api
```

3. Restart Expo:
```bash
npm start
# Press 'r' to reload
```

**Why this is better:**
- ✅ Works everywhere (Expo Go, Dev Client, physical devices)
- ✅ No network configuration needed
- ✅ Matches production environment
- ✅ No localhost/IP address issues

### Solution 2: Use Local Network IP (For Local Development)

1. **Find your machine's local IP address**:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Or use:
   ipconfig getifaddr en0  # macOS Wi-Fi
   # You'll get something like: 192.168.1.100
   ```

2. **Start the backend** (if not running):
   ```bash
   cd flight-match-finder/overlap/backend
   npm run dev
   # Should show: Server is running on port 3001
   ```

3. **Create `.env` file** in `mobile-app/`:
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.1.100:3001/api
   # Replace 192.168.1.100 with YOUR actual IP address
   ```

4. **Restart Expo**:
   ```bash
   npm start
   # Press 'r' to reload
   ```

### Solution 3: Use ngrok (For Testing Across Networks)

1. **Install ngrok**:
   ```bash
   npm install -g ngrok
   # Or download from https://ngrok.com/
   ```

2. **Start backend** on port 3001:
   ```bash
   cd flight-match-finder/overlap/backend
   npm run dev
   ```

3. **Create ngrok tunnel**:
   ```bash
   ngrok http 3001
   # Will show something like: https://abc123.ngrok.io
   ```

4. **Create `.env` file**:
   ```env
   EXPO_PUBLIC_API_URL=https://abc123.ngrok.io/api
   # Use the ngrok URL from step 3
   ```

5. **Restart Expo**

### Solution 4: Use Expo Development Build (Best for Local)

If using Expo Development Client (not Expo Go):

1. Start backend:
   ```bash
   cd flight-match-finder/overlap/backend
   npm run dev
   ```

2. Use localhost in `.env`:
   ```env
   EXPO_PUBLIC_API_URL=http://localhost:3001/api
   ```

## Verification

After setting up, check the logs:
- ✅ Should see: `✅ Environment variables validated successfully`
- ✅ Should see: `API URL: http://...` (your configured URL)
- ❌ Should NOT see: `⚠️ EXPO_PUBLIC_API_URL not set`

## Common Issues

### "Still getting network errors"
1. ✅ Verify backend is running: `curl http://localhost:3001/api/debug/env`
2. ✅ Check firewall isn't blocking port 3001
3. ✅ Ensure `.env` file is in `mobile-app/` directory
4. ✅ Restart Expo completely (stop and start again)

### "Backend runs but mobile app can't connect"
- Use your machine's IP address instead of localhost
- Or use ngrok for tunneling
- Or use production backend URL

### "Environment variable not loading"
1. Check `.env` file is in `mobile-app/` directory
2. Restart Expo (not just reload)
3. Clear cache: `npm start -- --clear`

## Quick Test

Test if backend is accessible:
```bash
# From your computer
curl http://localhost:3001/api/debug/env

# Should return JSON with environment status
```

If that works but mobile app doesn't, you need to use IP address instead of localhost.

