# Security Setup Guide

This guide helps you set up secure environment variables for the mobile app.

## Quick Start

### 1. Create `.env` File

Copy the example and fill in your values:

```bash
cd flight-match-finder/mobile-app
cp .env.example .env
# Edit .env with your actual values
```

### 2. Required Environment Variables

#### For Local Development

Create `.env` file in `mobile-app/` directory:

```env
EXPO_PUBLIC_API_URL=http://localhost:3001/api
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token_here  # Only if using Mapbox
```

#### For Production Builds (EAS)

Set secrets using EAS CLI:

```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Login to Expo
eas login

# Link your project
eas build:configure

# Set secrets
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://your-api.com/api"
eas secret:create --scope project --name EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN --value "pk.your_token_here"
```

Or set in Expo Dashboard:
1. Go to https://expo.dev
2. Select your project
3. Go to **Secrets** → **Project Secrets**
4. Add each variable

## Environment Variables

### Required

- `EXPO_PUBLIC_API_URL` - Your backend API URL
  - Development: `http://localhost:3001/api`
  - Production: `https://your-production-api.com/api`

### Optional (Map Features)

- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` - Mapbox access token (if using Mapbox)
  - Get from: https://account.mapbox.com/access-tokens/
  - Format: `pk.eyJ1Ijoi...`

- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps API key (if using Google Maps)
  - Get from: https://console.cloud.google.com/google/maps-apis
  - Format: `AIzaSyB...`

## Security Best Practices

### ✅ DO:
- ✅ Use environment variables for all API keys
- ✅ Use EAS Secrets for production builds
- ✅ Keep `.env` files out of git (already in `.gitignore`)
- ✅ Use different keys for development and production
- ✅ Rotate keys if they're ever exposed

### ❌ DON'T:
- ❌ Commit API keys to git
- ❌ Hardcode secrets in source code
- ❌ Share `.env` files
- ❌ Use production keys in development

## Verification

After setting up, verify your configuration:

1. **Check environment variables are loaded**:
   ```bash
   # In development
   npm start
   # Check console for validation messages
   ```

2. **Test production build**:
   ```bash
   eas build --platform android --profile production
   # Check build logs for environment variable errors
   ```

3. **Verify API connection**:
   - Open app and try to make an API call
   - Check network requests in debugger
   - Verify API URL is correct

## Troubleshooting

### Error: "Missing required environment variable"
- Check that `.env` file exists and has correct variable names
- Variable names must start with `EXPO_PUBLIC_` to be accessible
- For production builds, ensure secrets are set in EAS

### API calls failing
- Verify `EXPO_PUBLIC_API_URL` is set correctly
- Check network connectivity
- Ensure backend is running and accessible

### Mapbox not working
- Verify `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` is set
- Check token is valid at https://account.mapbox.com/
- Ensure token has required permissions

## Next Steps

1. ✅ Set up environment variables
2. ✅ Test locally with `.env` file
3. ✅ Configure EAS secrets for production
4. ✅ Test production build
5. ⚠️ Consider adding Sentry for error reporting
6. ⚠️ Review and reduce console.log statements

## Additional Resources

- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [EAS Secrets](https://docs.expo.dev/build-reference/variables/)
- [React Native Security Best Practices](https://reactnative.dev/docs/security)


