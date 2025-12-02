# Admin Dashboard Quick Start Guide

This guide will help you get the admin dashboard up and running on your local machine, connected to your Railway MongoDB.

## Prerequisites

- Node.js installed
- Access to your Railway MongoDB connection string
- A user account registered in the system

## Step 1: Set Up Backend Environment

1. Navigate to the backend directory:
   ```bash
   cd flight-match-finder/overlap/backend
   ```

2. Create a `.env` file if it doesn't exist:
   ```bash
   cp .env.example .env  # If you have an example file
   # Or create a new .env file
   ```

3. Add your MongoDB connection string to `.env`:
   ```env
   MONGODB_URI=mongodb://your-railway-mongodb-connection-string
   # OR
   MONGO_URL=mongodb://your-railway-mongodb-connection-string
   
   JWT_SECRET=your-jwt-secret-key-here
   NODE_ENV=development
   ```

   **Important**: 
   - Use your Railway MongoDB **PUBLIC** connection string if you want changes to update Railway MongoDB
   - The connection string should look like: `mongodb://mongo:password@containers-us-west-xxx.railway.app:xxxxx/railway` or `mongodb://mongo:password@proxy.rlwy.net:xxxxx/railway`
   - **DO NOT use** `mongodb.railway.internal` - that only works when your backend is deployed on Railway, not when running locally
   - To get the public connection string: Railway Dashboard → Your MongoDB Service → Variables → Look for `MONGO_URL` or `MONGODB_URI` (should have a public hostname, not `.internal`)

4. Install dependencies (if not already done):
   ```bash
   npm install
   ```

## Step 2: Start the Backend Server

1. Start the backend in development mode:
   ```bash
   npm run dev
   ```

2. Verify the connection:
   - Look for this message in the console: `🔌 Connecting to MongoDB: ✅ Railway` (or `⚠️ LOCAL` if using local MongoDB)
   - You should see: `✅ Connected to MongoDB database: [database-name]`
   - Server should be running on `http://localhost:3001`

## Step 3: Set Up Frontend Environment

1. Navigate to the web directory:
   ```bash
   cd flight-match-finder/overlap/web
   ```

2. Install dependencies (if not already done):
   ```bash
   npm install
   ```

3. (Optional) Create a `.env` file if you need to override the API URL:
   ```env
   REACT_APP_API_URL=http://localhost:3001
   ```

   **Note**: The frontend automatically detects localhost and uses `http://localhost:3001` by default, so this is usually not needed.

## Step 4: Start the Frontend

1. Start the React development server:
   ```bash
   npm start
   ```

2. The app should open in your browser at `http://localhost:3000`

## Step 5: Create an Admin User

You have two options to create an admin user:

### Option A: Promote an Existing User (Recommended)

1. First, register a regular user account through the web interface:
   - Go to `http://localhost:3000`
   - Click "Register" and create an account
   - Note your email address

2. Promote your user to admin:
   ```bash
   cd flight-match-finder/overlap/backend
   node src/scripts/makeAdmin.js your-email@example.com
   ```

   Replace `your-email@example.com` with the email you used to register.

3. You should see:
   ```
   ✅ Successfully promoted "your-email@example.com" to admin role
   ```

### Option B: Create a New Admin User

1. Run the create admin script:
   ```bash
   cd flight-match-finder/overlap/backend
   node src/scripts/createAdmin.js
   ```

2. This creates a user with:
   - Email: `admin@example.com`
   - Password: `admin123456`
   - Role: `admin`

3. **Important**: Change the password after first login!

## Step 6: Access the Admin Dashboard

1. **IMPORTANT**: If you just promoted yourself to admin, you MUST log out and log back in:
   - The user role is stored in localStorage when you log in
   - After promoting to admin, the old user object in localStorage still has `role: 'user'`
   - Log out completely, then log back in to refresh your user data

2. Log in to the web app with your admin account:
   - Go to `http://localhost:3000`
   - Click "Login" and enter your credentials
   - After login, your user object will now include `role: 'admin'`

3. Navigate to the admin dashboard:
   - Click on your profile/avatar in the top right
   - Look for "Admin Dashboard" in the dropdown menu
   - Or go directly to: `http://localhost:3000/admin`

4. You should now see the admin dashboard with tabs for:
   - Unmapped Teams
   - Venue Issues
   - Data Freshness
   - Subscriptions
   - League Onboarding

## Verifying MongoDB Connection

To verify which MongoDB your backend is connected to:

1. Check the backend console logs when starting the server
2. Look for one of these messages:
   - `🔌 Connecting to MongoDB: ✅ Railway` - Connected to Railway MongoDB (changes will update Railway)
   - `🔌 Connecting to MongoDB: ⚠️ LOCAL` - Connected to local MongoDB (changes only affect local)
   - `🔌 Connecting to MongoDB: ✅ Remote` - Connected to another remote MongoDB

**Important**: If you see `✅ Railway`, any changes you make in the admin dashboard will update your deployed Railway MongoDB database.

## Troubleshooting

### "Access denied" Error / Login Screen Blocks Admin Route

- **Problem**: You see the login screen even after logging in, or "Access denied. Admin privileges required" when accessing `/admin`
- **Solution**: 
  1. **First, verify you're an admin in the database:**
     ```bash
     cd flight-match-finder/overlap/backend
     node src/scripts/makeAdmin.js your-email@example.com
     ```
     You should see: `✅ Successfully promoted "your-email@example.com" to admin role`
  
  2. **Log out completely from the web app** (click logout button)
  
  3. **Log back in** - This refreshes the user object in localStorage with the updated role
  
  4. **Try accessing `/admin` again** - It should work now
  
  5. **If still not working**, check browser console:
     - Open Developer Tools (F12)
     - Go to Application/Storage tab → Local Storage
     - Check the `user` key - it should have `"role":"admin"` in the JSON
     - If it shows `"role":"user"`, you need to log out and log back in again

### Backend Won't Start

- **Problem**: Backend fails to start or shows MongoDB connection errors
- **Solution**:
  1. Check that `MONGODB_URI` or `MONGO_URL` is set in your `.env` file
  2. Verify the connection string is correct (check Railway dashboard)
  3. Make sure MongoDB service is running (if using local MongoDB)

### Frontend Can't Connect to Backend

- **Problem**: Frontend shows errors when trying to access admin endpoints
- **Solution**:
  1. Verify backend is running on `http://localhost:3001`
  2. Check browser console for CORS errors
  3. Verify `getBackendUrl()` in `web/src/utils/api.js` is detecting localhost correctly
  4. Check that backend CORS allows `http://localhost:3000`

### Admin Dashboard Shows No Data

- **Problem**: Admin dashboard loads but shows empty tables or "0" counts
- **Solution**:
  1. This is normal if you haven't imported any data yet
  2. Use the "League Onboarding" tab to import leagues, teams, and venues
  3. Run some searches to generate unmapped teams data

### Changes Not Reflecting in Railway MongoDB

- **Problem**: You make changes but they don't appear in Railway MongoDB
- **Solution**:
  1. Check backend startup logs - verify it says `✅ Railway` not `⚠️ LOCAL`
  2. Verify your `.env` file has the Railway MongoDB connection string
  3. Restart the backend server after changing `.env` file
  4. Check that the connection string includes `railway` or `rlwy.net`

## Next Steps

Once your admin dashboard is working:

1. **Import Leagues**: Use the "League Onboarding" tab to add leagues to your database
2. **Fix Venue Issues**: Check the "Venue Issues" tab to add missing coordinates
3. **Map Unmapped Teams**: Use the "Unmapped Teams" tab to create database entries for teams
4. **Monitor Data Freshness**: Use the "Data Freshness" tab to keep league data up to date

## Additional Resources

- See `ADMIN_SETUP.md` for detailed admin features documentation
- See `RAILWAY_ENV_SETUP.md` for Railway deployment configuration
- See `ENVIRONMENT_SETUP.md` for environment variable details

