# Railway Environment Variables Setup

## Problem

Your Railway deployment is failing because WorkOS environment variables are missing. The error shows:
```
NoApiKeyProvidedException: Missing API key. Pass it to the constructor or define it in the WORKOS_API_KEY environment variable.
```

## Solution: Add Environment Variables in Railway

### Step 1: Get Your WorkOS Credentials

1. Go to [WorkOS Dashboard](https://dashboard.workos.com/)
2. Navigate to **Settings** → **API Keys**
3. Copy your **API Key** (starts with `sk_`)
4. Copy your **Client ID** (starts with `client_`)

### Step 2: Add Environment Variables in Railway

1. **Go to your Railway project dashboard**
2. **Select your service** (your backend service)
3. **Click on the "Variables" tab** (or go to Settings → Variables)
4. **Click "New Variable"** and add these:

   ```
   WORKOS_API_KEY=sk_test_your_actual_api_key_here
   ```
   
   ```
   WORKOS_CLIENT_ID=client_your_actual_client_id_here
   ```
   
   ```
   WORKOS_REDIRECT_URI=https://your-railway-app.up.railway.app/api/auth/workos/callback
   ```
   
   (Replace `your-railway-app` with your actual Railway app name/subdomain)

### Step 3: Add Amadeus Flight API Credentials

For flight search functionality, add these variables:

1. **Get your credentials from Amadeus**:
   - Go to: https://developers.amadeus.com/
   - In your dashboard, you'll see "API Key" and "API Secret"
   - **Important**: "API Key" = `AMADEUS_CLIENT_ID`, "API Secret" = `AMADEUS_CLIENT_SECRET`

2. **Go to Railway dashboard** → Your service → **Variables tab**
3. **Click "New Variable"** and add:

   ```
   AMADEUS_CLIENT_ID=your_api_key_from_amadeus_dashboard
   ```
   (Use the "API Key" value from Amadeus)
   
   ```
   AMADEUS_CLIENT_SECRET=your_api_secret_from_amadeus_dashboard
   ```
   (Use the "API Secret" value from Amadeus)
   
   ```
   AMADEUS_ENVIRONMENT=test
   ```
   
   **Note:** 
   - Use `AMADEUS_ENVIRONMENT=test` for development/testing
   - Use `AMADEUS_ENVIRONMENT=production` for production (when you have production credentials)
   - Test API keys start with `test_`, production keys start with `live_`

### Step 4: Verify Other Required Variables

Make sure these are also set:
- `JWT_SECRET` - Your JWT secret key (for token signing)
- `MONGODB_URI` or `MONGO_URL` - Your MongoDB connection string
- `NODE_ENV=production` - Should be set to production

### Step 5: Redeploy

After adding the variables:
1. Railway will automatically detect the new variables
2. It may auto-redeploy, or you can manually trigger a redeploy
3. Check the logs to verify the server starts successfully

## Alternative: Using Railway CLI

If you prefer command line:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Set WorkOS variables
railway variables set WORKOS_API_KEY=sk_test_your_key_here
railway variables set WORKOS_CLIENT_ID=client_your_id_here
railway variables set WORKOS_REDIRECT_URI=https://your-app.up.railway.app/api/auth/workos/callback

# Set Amadeus variables
railway variables set AMADEUS_CLIENT_ID=your_amadeus_client_id
railway variables set AMADEUS_CLIENT_SECRET=your_amadeus_client_secret
railway variables set AMADEUS_ENVIRONMENT=test
```

## Verification

After setting the variables, check your Railway logs. You should see:
- No `NoApiKeyProvidedException` errors
- Server starting successfully
- WorkOS routes working (when tested)
- Amadeus provider initialized (if credentials are set)
- Flight search endpoints available at `/api/transportation/flights/search`

## Troubleshooting

### Still Getting Errors?

1. **Check variable names** - Make sure they're exactly:
   - `WORKOS_API_KEY` (not `WORKOS_API_KEY_` or `workos_api_key`)
   - `WORKOS_CLIENT_ID` (not `WORKOS_CLIENT_ID_` or `workos_client_id`)

2. **Check variable values** - Make sure:
   - No extra spaces before/after the value
   - No quotes around the value (Railway adds them automatically)
   - The API key starts with `sk_` or `sk_test_` or `sk_live_`
   - The Client ID starts with `client_`

3. **Redeploy** - Sometimes you need to manually trigger a redeploy after adding variables

4. **Check logs** - Railway logs will show if variables are being read correctly

### Testing Locally

Before deploying to Railway, test locally:

```bash
# Create .env file in overlap/backend/
WORKOS_API_KEY=sk_test_your_key
WORKOS_CLIENT_ID=client_your_id
WORKOS_REDIRECT_URI=http://localhost:3001/api/auth/workos/callback
AMADEUS_CLIENT_ID=your_amadeus_client_id
AMADEUS_CLIENT_SECRET=your_amadeus_client_secret
AMADEUS_ENVIRONMENT=test
NODE_ENV=development
```

Then test:
```bash
npm run dev
```

## Security Notes

- **Never commit `.env` files** to git
- **Never share API keys** publicly
- **Use production keys** (`sk_live_`) in Railway, test keys (`sk_test_`) in development
- Railway encrypts environment variables at rest

## Code Changes Made

The code has been updated to:
- ✅ Initialize WorkOS lazily (only when needed)
- ✅ Gracefully handle missing WorkOS configuration
- ✅ Return proper error messages if WorkOS is not configured
- ✅ Allow server to start even without WorkOS keys (for gradual rollout)

This means:
- Your server will start successfully even without WorkOS keys
- WorkOS routes will return error messages instead of crashing
- Once you add the keys to Railway, WorkOS features will automatically work

