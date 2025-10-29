# Development Build Instructions for WebView

The `react-native-webview` module requires a **development build** (not Expo Go). Here's how to set it up:

## Option 1: Build Development Client (Recommended for In-App WebView)

### For iOS:
```bash
cd mobile-app
npx expo run:ios
```

This will:
1. Build a development client with native modules
2. Install it on your iOS simulator/device
3. Start the Metro bundler

### For Android:
```bash
cd mobile-app
npx expo run:android
```

This will:
1. Build a development client with native modules
2. Install it on your Android emulator/device
3. Start the Metro bundler

## Option 2: Use EAS Build (For Physical Devices)

If you want to build for a physical device:

```bash
cd mobile-app

# Build for iOS
eas build --profile development --platform ios

# Build for Android
eas build --profile development --platform android
```

After the build completes, install it on your device and run:
```bash
npx expo start --dev-client
```

## What This Does

- **Development Client**: A custom version of your app that includes all native modules (like WebView)
- **Hot Reload**: Still works with Fast Refresh
- **Native Modules**: All custom native modules are included
- **In-App WebView**: WebView will work properly for WorkOS authentication

## Current Status

If you're using **Expo Go**, you'll see an error message when trying to use "Continue with Gmail". 

**To fix**: Build a development client using one of the options above.

## Testing After Build

Once you have the development client installed:

1. Run `npx expo start --dev-client`
2. Open the development client app (not Expo Go)
3. Click "Continue with Gmail"
4. The in-app WebView should work perfectly!

## Troubleshooting

### "Command not found" errors
Make sure you have:
- Xcode installed (for iOS)
- Android Studio installed (for Android)
- Required command line tools

### Build fails
- Make sure you're in the `mobile-app` directory
- Try cleaning: `npx expo run:ios --clean` or `npx expo run:android --clean`

### Module still not found after build
- Make sure you rebuilt after installing `react-native-webview`
- Try uninstalling and reinstalling the app on your device/simulator

