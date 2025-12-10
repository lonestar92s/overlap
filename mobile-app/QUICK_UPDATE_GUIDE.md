# Quick Update Guide - Skip the Long Builds! 🚀

## The Problem
Full native builds take **20-30+ minutes** and require TestFlight submission. For JavaScript-only changes, this is overkill!

## The Solution: EAS Update (Over-the-Air Updates)

For **JavaScript/React Native code changes only**, use EAS Update instead. It takes **1-2 minutes** and users get it automatically!

## When to Use What

### ✅ Use EAS Update (Fast - 1-2 min)
- JavaScript/TypeScript code changes
- React component changes
- Bug fixes in app logic
- UI/UX improvements
- **This crash fix qualifies!** ✅

### ❌ Use Full Build (Slow - 20-30+ min)
- Native code changes (iOS/Android)
- New native dependencies
- Changes to `app.json` (version, bundle ID, etc.)
- Changes to native config files

## How to Push an Update (For This Fix)

```bash
cd flight-match-finder/mobile-app

# Push update to production branch (matches your TestFlight build)
eas update --branch production --message "Fix: Add fallback API URL to prevent crash"
```

That's it! Users will get the update automatically when they open the app.

## Verify It Worked

```bash
# Check update status
eas update:list --branch production

# View update details
eas update:view <update-id>
```

## Test It Yourself

1. **Push the update** (command above)
2. **Open the app** on your device (the one with the TestFlight build)
3. **Close and reopen** the app (updates check on launch)
4. **Check the logs** - you should see the update downloading

## Update Branches

Your app uses these branches:
- `production` - For TestFlight builds
- `preview` - For preview/development builds

Make sure to push to the branch that matches your build!

## Pro Tips

1. **Always test locally first** - Make sure your changes work before pushing
2. **Use descriptive messages** - Helps track what changed
3. **Check update status** - Verify it's rolling out correctly
4. **Monitor in Expo Dashboard** - See update adoption rates

## Troubleshooting

### Update not appearing?
- Check `runtimeVersion` matches (should be `1.0.0` in your case)
- Verify you pushed to the correct branch (`production` for TestFlight)
- Restart the app completely (force close and reopen)
- Check device has internet connection

### Need to rollback?
```bash
# View update history
eas update:list --branch production

# Create rollback (publish previous version)
eas update --branch production --message "Rollback: Revert crash fix"
```

## Time Savings

- **Full build + TestFlight**: ~30-45 minutes total
- **EAS Update**: ~1-2 minutes total

**You just saved 28-43 minutes!** ⏰


