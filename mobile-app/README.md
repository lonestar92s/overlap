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

### User & Profile
- **Authentication** — Email/password, WorkOS SSO
- **Preferences** — Favorite teams, leagues, venues; saved matches
- **Profile** — Avatar, timezone, feedback

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- Expo CLI (installed via `npx expo`)
- Backend server (see [Backend](#backend) below)

## Setup

### 1. Install dependencies

```bash
cd mobile-app
npm install
```

### 2. Environment variables

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

**Required variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Backend API URL | `https://your-api.railway.app/api` |
| `EXPO_PUBLIC_LOCATIONIQ_API_KEY` | Location search (optional) | `pk.your_key` |

**Optional (for full functionality):**

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox maps (required for map views) |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps (if used) |

### 3. Backend

The app connects to the backend at `overlap/backend/`. Start it from the project root:

```bash
cd overlap/backend
npm install
npm run dev
```

For production, use the deployed Railway URL (see `ENV_SETUP.md`).

### 4. Start the app

```bash
npm start
```

Restart Expo after changing `.env` for changes to take effect.

## Running the App

### iOS Simulator
```bash
npm run ios
```

### Android Emulator
```bash
npm run android
```

### Web Browser
```bash
npm run web
```

### Physical Device (Expo Go)
1. Install Expo Go on your device
2. Scan the QR code from the terminal

**Note:** For physical devices, set `EXPO_PUBLIC_API_URL` to your machine's IP (e.g. `http://192.168.1.100:3001/api`) if using a local backend, or use the production Railway URL.

## API Configuration

The app uses `EXPO_PUBLIC_API_URL` from `.env`. In development, it falls back to `http://localhost:3001/api` if not set.

- **Production:** Use your deployed backend URL (e.g. Railway)
- **Local + Simulator:** `http://localhost:3001/api`
- **Local + Physical Device:** `http://YOUR_IP:3001/api`

See `ENV_SETUP.md` for detailed setup.

## Project Structure

```
mobile-app/
├── screens/          # Screen components
├── components/       # Reusable UI components
├── contexts/         # Auth, Itinerary, Filter contexts
├── services/         # API & natural language services
├── hooks/            # Custom hooks (recommendations, etc.)
├── utils/            # Helpers, design tokens
└── styles/           # Design system
```

## Key API Endpoints

- `GET /api/matches/search` — Search matches
- `GET /api/matches/popular` — Popular matches
- `GET /api/trips` — User trips
- `GET /api/recommendations/trips/:id/recommendations` — Trip recommendations
- `GET /api/transportation/flights/search` — Flight search
- `GET /api/transportation/airports/search` — Airport search
- `GET /api/transportation/directions/*` — Driving, walking, transit
- `GET /api/memories` — User memories
- `GET /api/matches/attended` — Attended matches

## Troubleshooting

### Connection issues
- Ensure backend is running (default port 3001)
- For physical devices, use your machine's IP instead of localhost
- Check `EXPO_PUBLIC_API_URL` in `.env`

### Map not loading
- Set `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env`
- Get a token at [Mapbox](https://account.mapbox.com/)

### Build issues
- Clear cache: `npx expo start -c`
- Reinstall: `rm -rf node_modules && npm install`

## Additional Documentation

- `ENV_SETUP.md` — Environment variable setup
- `DEV_BUILD_INSTRUCTIONS.md` — Development builds (e.g. for WebView)
- `MAPBOX_SETUP.md` — Mapbox configuration
- `../REQUIREMENTS.md` — Full feature requirements
