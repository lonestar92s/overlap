# Test User Update Guide

After creating a new EAS build, here's how to update your test users.

## Quick Decision Tree

**Did you change native code (iOS/Android) or add new native dependencies?**
- ✅ **Yes** → Use Option 2 (Re-distribute Build)
- ❌ **No** (only JavaScript/React Native changes) → Use Option 1 (EAS Update)

## Option 1: EAS Update (OTA) - Fastest Method

**Use when:** Only JavaScript/React Native code changed (no native changes)

### Steps:

```bash
cd mobile-app

# Publish update to preview branch (matches your preview build profile)
eas update --branch preview --message "Description of changes"

# Or for production builds
eas update --branch production --message "Description of changes"
```

### How Test Users Get It:

- Updates are **automatic** - users get it when they open the app
- Usually appears within seconds
- No app store approval needed
- Works for both iOS and Android

### Check Update Status:

```bash
# View recent updates
eas update:list

# View specific update details
eas update:view <update-id>
```

## Option 2: Re-distribute Build - For Native Changes

**Use when:** 
- Native code changed (iOS/Android)
- New native dependencies added
- Need to test a completely new build

### For Preview/Development Builds:

1. **After build completes**, EAS provides a download link
2. **Share the link** with test users:
   - **iOS**: Direct download link (or TestFlight if submitted)
   - **Android**: APK download link

3. **Test users install**:
   - **iOS**: Open link on device → Install (may need to trust developer)
   - **Android**: Download APK → Install (may need to enable "Install from unknown sources")

### For Production Builds:

#### iOS (TestFlight):

```bash
# Submit to TestFlight
eas submit --platform ios --profile production
```

Then:
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to your app → TestFlight
3. Add test users (Internal Testing or External Testing)
4. Test users receive email invitation

#### Android (Internal Testing):

```bash
# Submit to Google Play
eas submit --platform android --profile production
```

Then:
1. Go to [Google Play Console](https://play.google.com/console)
2. Navigate to your app → Testing → Internal testing
3. Add test users (email addresses)
4. Test users receive email invitation

## Current Configuration

Your app is configured with:
- **Runtime Version**: `1.0.0` (in `app.json`)
- **Update URL**: Configured for EAS Updates
- **Build Profiles**: 
  - `development` - Internal distribution
  - `preview` - Internal distribution  
  - `production` - Auto-increment version

## Best Practices

1. **Use EAS Update** for quick JavaScript fixes (fastest)
2. **Use new builds** only when native code changes
3. **Test updates** on your device first before publishing
4. **Version your updates** - use descriptive messages
5. **Monitor updates** - check EAS dashboard for rollout status

## Troubleshooting

### Update not appearing?
- Check that `runtimeVersion` matches between build and update
- Verify update was published to correct branch
- Check device has internet connection
- Restart the app

### Build link not working?
- iOS: May need to trust developer certificate on device
- Android: May need to enable "Install from unknown sources"
- Check build status in EAS dashboard

### Need to rollback?
```bash
# View update history
eas update:list

# Create rollback update
eas update --branch preview --message "Rollback to previous version"
```


