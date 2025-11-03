# Flight Match Finder Mobile App

A React Native mobile app for searching football matches by date range and team.

## Features

- **Search Matches**: Find matches by specifying home/away teams and date range
- **Match Results**: View detailed match information including:
  - Team names and logos
  - Match date and time
  - Match status (Live, Full Time, etc.)
  - Venue information
  - League information
  - Scores (when available)

## Prerequisites

- Node.js (v14 or higher)
- Expo CLI (`npm install -g expo-cli`)
- Backend server running on `http://localhost:3001`

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up LocationIQ API Key (for location search)**:
   - Get a free API key from [LocationIQ](https://locationiq.com/)
     - Sign up at https://locationiq.com/
     - Navigate to your dashboard to get your API key
   - Create a `.env` file in the `mobile-app` directory:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and add your LocationIQ API key:
     ```
     EXPO_PUBLIC_LOCATIONIQ_API_KEY=pk.your_actual_api_key_here
     ```
   - **Note**: Without this key, the app will use mock location data (limited to 5 cities)

3. **Start the backend server**:
   Make sure your backend is running on port 3001. From the backend directory:
   ```bash
   cd ../backend
   npm start
   ```

4. **Start the mobile app**:
   ```bash
   npm start
   ```
   - **Important**: Restart the Expo development server after adding the API key to `.env` for changes to take effect.

## Running the App

### On iOS Simulator
```bash
npm run ios
```

### On Android Emulator
```bash
npm run android
```

### On Web Browser
```bash
npm run web
```

### On Physical Device
1. Install the Expo Go app on your device
2. Scan the QR code shown in the terminal or browser

## API Configuration

The app connects to your backend API at `http://localhost:3001/api`. 

**For testing on a physical device**, you'll need to update the API base URL in `services/api.js`:

```javascript
// Replace localhost with your computer's IP address
const API_BASE_URL = 'http://YOUR_IP_ADDRESS:3001/api';
```

To find your IP address:
- **macOS/Linux**: `ifconfig | grep inet`
- **Windows**: `ipconfig`

## Usage

1. **Search for Matches**:
   - Enter at least one team name (home or away)
   - Select date range using the date pickers
   - Tap "Search Matches"

2. **View Results**:
   - Browse through the list of matches
   - See match details, teams, venues, and scores
   - Use "Search Again" to modify your search

## API Endpoints Used

- `GET /api/matches/search` - Search matches by team and date range
- `GET /api/matches/by-team` - Get matches for a specific team
- `GET /api/teams` - Get available teams
- `GET /api/leagues` - Get available leagues

## Troubleshooting

### Connection Issues
- Ensure backend is running on port 3001
- Check that your device/emulator can reach the backend
- For physical devices, use your computer's IP address instead of localhost

### Build Issues
- Clear Expo cache: `expo start -c`
- Restart Metro bundler
- Check that all dependencies are properly installed

## Next Steps

This MVP includes basic search functionality. Future enhancements could include:
- Map integration for venue locations
- User authentication
- Save favorite matches
- Push notifications for match updates
- Offline support 