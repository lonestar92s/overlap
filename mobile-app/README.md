# Flight Match Finder Mobile App

A React Native (Expo) mobile app for discovering football matches, planning trips, and managing match-day experiences.

## Features

### Search & Discovery
- **Match Search** — Search by team, date range, location, league, or map bounds
- **Map View** — Map-based home screen with location-based matches; search results on map
- **Popular Matches** — Discover popular matches by destination
- **Natural Language Search** — Chat-style search (feature-flagged)
- **Unified Search** — Search leagues, teams, and venues (feature-flagged)

### Trips & Planning
- **Trip Management** — Create trips, add matches, edit itinerary
- **Trip Map** — View trip matches and home bases on map
- **Flight Search** — Search flights, add to trips (Amadeus API)
- **Home Bases** — Add accommodation locations; travel times to venues
- **Match Planning** — Track tickets, accommodation, notes per match

### Memories & Attendance
- **Memories** — Save photos and notes for attended matches
- **Attendance** — Mark matches as attended; view history
- **Memories Map** — View memories on map

### Notifications
- **Notification inbox** — In-app notification list and unread state (see `expo-notifications` + backend notification routes)

### User & Profile
- **Authentication** — Email/password, WorkOS SSO
- **Preferences** — Favorite teams, leagues, venues; saved matches
- **Profile** — Avatar, timezone, feedback

## Prerequisites

- Node.js **18.18+** or **20.x** (LTS recommended for Expo SDK 54)
- npm or yarn
- Expo CLI (via `npx expo` — no global install required)
- **Xcode** (iOS) / **Android Studio** (Android) if you run native dev builds (`npm run ios` / `npm run android`)
- Backend server when testing against local API (see [Backend](#3-backend))

## Setup

### 1. Install dependencies

```bash
cd mobile-app
npm install
```

### 2. Environment variables

Create a `.env` file (start from `.env.example`):

```bash
cp .env.example .env
```

**Shipped `.env.example` fields:**

| Variable | When to set |
|----------|----------------|
| `EXPO_PUBLIC_LOCATIONIQ_API_KEY` | Location autocomplete / geocoding (get a key at [LocationIQ](https://locationiq.com/)) |
| `EXPO_PUBLIC_API_URL` | **Recommended** for consistent behavior (Expo Go, physical devices, production builds). Example: your deployed API `https://…/api` |

**Behavior of `EXPO_PUBLIC_API_URL`:**

- **Omitted in local dev (`__DEV__`):** The app falls back to `http://localhost:3001/api` (simulator/emulator only; not for Expo Go on a real device).
- **Production / release builds:** Must be set (e.g. [EAS Secret](https://docs.expo.dev/build-reference/variables/)); see `ENV_SETUP.md`.

**Optional (feature-dependent):**

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox (`@rnmapbox/maps`); required for map-heavy screens |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps / Directions-related features when enabled |

For **which URL to use** (production vs localhost vs LAN IP), read `ENV_SETUP.md` first.

### 3. Backend

The app connects to the backend at `overlap/backend/`. Start it from the project root:

```bash
cd overlap/backend
npm install
npm run dev
```

For a hosted API, use that base URL in `EXPO_PUBLIC_API_URL` (see `ENV_SETUP.md`).

### 4. Start the dev server

```bash
npm start
```

Restart Expo after changing `.env` for changes to take effect.

## Running the App

This repo uses **Expo Dev Client** and native projects (`ios/`, `android/`). Many flows (e.g. Mapbox, WebView) expect a **development build**, not Expo Go alone.

### iOS Simulator (native dev client)

```bash
npm run ios
```

Runs `expo run:ios` — builds/installs the dev client and starts Metro (Xcode required).

### Android Emulator (native dev client)

```bash
npm run android
```

Runs `expo run:android` — same idea for Android (Android Studio / SDK required).

### After a dev client is installed

```bash
npx expo start --dev-client
```

### Web

```bash
npm run web
```

Runs `expo start --web` (web support varies by screen; primary target is iOS/Android).

### Expo Go (limited)

You can open the project in **Expo Go** for quick checks, but **native modules** used in this app may not match Expo Go’s prebuild. Prefer a **development build** for full behavior; see `DEV_BUILD_INSTRUCTIONS.md` and `eas.json` profile `development`.

**Physical device + local backend:** set `EXPO_PUBLIC_API_URL` to your machine’s LAN IP (e.g. `http://192.168.1.100:3001/api`), not `localhost`.

## Testing

```bash
npm test              # run Jest once
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

Tests live under `__tests__/` and `tests/`; Jest config is in `package.json`.

## EAS Build & updates

- **Profiles:** `eas.json` defines `development` (dev client), `preview`, and `production` builds.
- **OTA (EAS Update):** `npm run update:preview` and `npm run update:production` map to `eas update` branches.

See [Expo EAS](https://docs.expo.dev/eas/) and `QUICK_UPDATE_GUIDE.md` for release workflow.

## API configuration

The app reads `EXPO_PUBLIC_API_URL` in `services/api.js`:

- **Local dev, unset:** Falls back to `http://localhost:3001/api` with a console warning.
- **Production builds:** Missing URL throws at startup until EAS secrets (or env) are set.

See `ENV_SETUP.md` for production URL, troubleshooting, and EAS secrets.

## Project structure

```
mobile-app/
├── App.js              # Root component & navigation
├── app.json            # Expo config
├── eas.json            # EAS Build / submit profiles
├── screens/            # Screen components
├── components/         # Reusable UI
├── contexts/           # Auth, itinerary, filters, notifications, etc.
├── services/           # API client, NL search, notifications, secure storage
├── hooks/              # Custom hooks
├── utils/              # Helpers, feature flags, design tokens
├── styles/             # Design system
├── config/             # App config (e.g. legal URLs)
├── assets/             # Images & static assets
├── docs/               # Extra mobile docs
├── data/               # Static / seed data where used
├── types/              # Shared TS types (if present)
├── tests/              # Jest setup / helpers
├── __tests__/          # Unit tests
├── scripts/            # Maintenance scripts
├── ios/ / android/     # Native projects (prebuild / dev client)
└── index.js            # Entry
```

## Key API endpoints

- `GET /api/matches/search` — Search matches
- `GET /api/matches/popular` — Popular matches
- `GET /api/trips` — User trips
- `GET /api/recommendations/trips/:id/recommendations` — Trip recommendations
- `GET /api/transportation/flights/search` — Flight search
- `GET /api/transportation/airports/search` — Airport search
- `GET /api/transportation/directions/*` — Driving, walking, transit
- `GET /api/memories` — User memories
- `GET /api/matches/attended` — Attended matches
- `GET /api/notifications` — Notification inbox (auth)
- `GET /api/notifications/unread-count` — Unread count (auth)

## Troubleshooting

### Connection issues
- Ensure the backend is running (default port **3001**) if using a local URL
- On a **physical device** or **Expo Go**, use your machine’s **IP** or a **deployed** API URL, not `localhost`
- Check `EXPO_PUBLIC_API_URL` in `.env` and restart Metro

### Map not loading
- Set `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env` ([Mapbox account](https://account.mapbox.com/))
- Details: `ENV_SETUP.md` (environment) + `DEV_BUILD_INSTRUCTIONS.md` (native dev client)

### Build issues
- Clear cache: `npx expo start -c`
- Reinstall: `rm -rf node_modules && npm install`

## Additional documentation

- `ENV_SETUP.md` — API URL choices, Mapbox/Google env vars, EAS secrets, troubleshooting
- `DEV_BUILD_INSTRUCTIONS.md` — Development builds (WebView, `expo run:*`, EAS `development` profile)
- `QUICK_UPDATE_GUIDE.md` — EAS Update / release tips
- `../REQUIREMENTS.md` — Full product requirements
