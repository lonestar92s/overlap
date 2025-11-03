# Environment Variables Setup

## Quick Setup

**For most users (production/external testing):**

1. Create `.env` file in `mobile-app/` directory:
```bash
cd flight-match-finder/mobile-app
touch .env
```

2. Add production API URL:
```env
EXPO_PUBLIC_API_URL=https://friendly-gratitude-production-3f31.up.railway.app/api
```

3. Restart Expo - done! ✅

## When to Use What

### ✅ Production Backend URL (Recommended)
**Use this when:**
- Testing with Expo Go
- Testing on physical devices
- Most development scenarios
- Want consistent behavior

```env
EXPO_PUBLIC_API_URL=https://friendly-gratitude-production-3f31.up.railway.app/api
```

**Why:** Works everywhere, no network configuration needed.

---

### 🔧 Local Development Backend

**Only use localhost/IP when:**
- Testing local backend changes
- Using Expo Dev Client (not Expo Go)
- Backend is running on your machine

#### Option A: Expo Dev Client (Simulator/Emulator)
```env
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```
Works on iOS Simulator and Android Emulator.

#### Option B: Physical Device / Expo Go
```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:3001/api
```
Replace `192.168.1.100` with your machine's IP address.

**Find your IP:**
```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'

# Windows
ipconfig | findstr IPv4
```

---

## Environment Variables

### Required
- `EXPO_PUBLIC_API_URL` - Backend API URL
  - Production: `https://friendly-gratitude-production-3f31.up.railway.app/api`
  - Local Dev: `http://YOUR_IP:3001/api` or `http://localhost:3001/api`

### Optional
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` - For Mapbox maps
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` - For Google Maps

---

## Troubleshooting

### "Network request failed"
1. ✅ Check backend URL is correct in `.env`
2. ✅ Verify backend is running (if using local)
3. ✅ Use production URL instead of localhost for Expo Go
4. ✅ Restart Expo after changing `.env`

### "localhost doesn't work"
- **Expo Go**: localhost doesn't work - use IP address or production URL
- **Expo Dev Client**: localhost works on simulator/emulator only

### "How do I know which to use?"
**Default recommendation:** Always use production URL unless you specifically need to test local backend changes.

---

## Best Practices

1. ✅ **Default to production URL** - Works everywhere
2. ✅ **Use `.env` file** - Never hardcode URLs
3. ✅ **Restart Expo** after changing `.env`
4. ✅ **Keep `.env` out of git** (already in `.gitignore`)

## For EAS Builds (Production)

Set secrets in EAS:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL \
  --value "https://friendly-gratitude-production-3f31.up.railway.app/api"
```

Or use Expo Dashboard → Secrets → Project Secrets

