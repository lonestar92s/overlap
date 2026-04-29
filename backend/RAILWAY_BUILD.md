# Railway Build Configuration

## Issue Fixed

The build was failing because `package-lock.json` was out of sync with `package.json` after adding test dependencies.

## Solution

✅ **Updated `package-lock.json`** by running:
```bash
npm install
```

## For Railway Production Builds

Railway uses `npm ci` which requires:
- ✅ `package.json` and `package-lock.json` must be in sync
- ✅ Both files must be committed to git

### Optional: Exclude Dev Dependencies in Production

If you want Railway to skip devDependencies (test tools) in production builds, you can:

1. **Set Railway environment variable:**
   ```
   NPM_CONFIG_PRODUCTION=true
   ```

2. **Or modify Railway build command** (if using custom build):
   ```bash
   npm ci --omit=dev
   ```

3. **Or use npm install with production flag:**
   ```bash
   npm install --production
   ```

**Note:** Test dependencies are in `devDependencies`, so they won't affect production bundle size. However, excluding them can speed up builds.

## Current Status

- ✅ `package-lock.json` is updated
- ✅ Test dependencies are in `devDependencies` (correct)
- ✅ `supertest` updated to v7.1.4 (latest)
- ✅ Ready to commit and deploy

## Next Steps

1. **Commit the updated `package-lock.json`**:
   ```bash
   git add overlap/backend/package-lock.json
   git commit -m "Update package-lock.json with test dependencies"
   ```

2. **Push to trigger Railway build**

3. **Verify build succeeds** on Railway

## Dependencies Added

- `jest@^29.7.0` - Testing framework
- `supertest@^7.1.4` - HTTP testing (updated from v6)
- `@jest/globals@^29.7.0` - Jest globals
- `husky@^9.0.11` - Git hooks (optional, won't affect Railway)

All are in `devDependencies`, so they won't be included in production builds unless Railway is configured to install them.

