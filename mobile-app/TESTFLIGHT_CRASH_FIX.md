# TestFlight Crash Fix

## Problem
The app was crashing immediately on launch in TestFlight because the `EXPO_PUBLIC_API_URL` environment variable was not set in the production build.

## Solution Applied
The app now uses a fallback production API URL if the environment variable is not set, preventing immediate crashes.

### Changes Made:
1. **`utils/envValidation.js`**: Changed validation to use fallback instead of throwing errors
2. **`services/api.js`**: Added fallback production URL if env var is missing
3. **`App.js`**: Made validation non-fatal (logs warnings instead of crashing)

## For Future Builds

### Option 1: Set EAS Secret (Recommended)
Set the environment variable as an EAS secret for all future builds:

```bash
cd flight-match-finder/mobile-app
eas secret:create --scope project --name EXPO_PUBLIC_API_URL \
  --value "https://friendly-gratitude-production-3f31.up.railway.app/api"
```

### Option 2: Use Expo Dashboard
1. Go to https://expo.dev
2. Select your project
3. Navigate to **Secrets** → **Project Secrets**
4. Click **Add Secret**
5. Name: `EXPO_PUBLIC_API_URL`
6. Value: `https://friendly-gratitude-production-3f31.up.railway.app/api`

### Option 3: Add to eas.json (Not Recommended)
You can also add it to `eas.json` build profiles, but secrets are more secure:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://friendly-gratitude-production-3f31.up.railway.app/api"
      }
    }
  }
}
```

## Current Status
✅ The app will now work with the fallback URL, but you should set the EAS secret for proper configuration.

## Testing
After setting the EAS secret, rebuild the app:
```bash
eas build --platform ios --profile production
```

The app should now work correctly in TestFlight.

