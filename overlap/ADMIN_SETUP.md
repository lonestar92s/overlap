# Admin System Setup Guide

## 🚀 Quick Start

### 1. Make Yourself an Admin

First, register a regular user account through the web interface, then promote yourself to admin:

```bash
# Navigate to backend directory
cd flight-match-finder/overlap/backend

# Run the admin promotion script
node scripts/makeAdmin.js your-email@example.com
```

### 2. Access the Admin Dashboard

1. Log into the web app with your account
2. You should see an "Admin" badge next to your name in the user menu
3. Click on "Admin Dashboard" in the dropdown menu
4. You're now in the admin interface! 🎉

## 🛠️ Admin Features

### Unmapped Teams Management
- **View unmapped teams**: See teams that API-Sports returns but aren't in your database
- **Map teams**: Create database entries for unmapped teams with proper venue/league info
- **Track occurrences**: See how many times each unmapped team has been encountered

### Venue Data Management  
- **View venues with issues**: Find venues missing coordinates or with data problems
- **Edit venue data**: Update coordinates, names, and other venue information
- **Coordinate validation**: Built-in validation for latitude/longitude values

### User Management
- **View all users**: See registered users and their roles
- **Promote/demote users**: Grant or revoke admin access
- **Role management**: Secure role-based access control

### System Statistics
- **Database coverage**: See what percentage of teams have API mappings
- **Venue completeness**: Track coordinate coverage and data quality
- **Real-time monitoring**: Live updates of unmapped teams and issues

### Data Freshness Monitor (NEW!)
- **Season Detection**: Automatically detect when new football seasons start
- **API Currency**: Monitor when league data was last updated from APIs
- **Smart Recommendations**: Get actionable insights for data maintenance
- **One-click Refresh**: Trigger league data updates directly from dashboard

## 🔧 API Endpoints (for developers)

### Authentication & Users
```
GET    /api/auth/admin/users              # List all users
POST   /api/auth/admin/promote/:userId    # Promote user to admin  
POST   /api/auth/admin/demote/:userId     # Demote admin to user
```

### Team Management
```
GET    /api/admin/unmapped-teams          # Get unmapped teams
POST   /api/admin/map-team               # Create team mapping
PUT    /api/admin/teams/:teamId          # Update team data
```

### Venue Management
```
GET    /api/admin/venues                 # List venues (with filters)
PUT    /api/admin/venues/:venueId        # Update venue data
```

### System Stats
```
GET    /api/admin/stats                  # Dashboard statistics
POST   /api/admin/clear-unmapped-cache   # Clear unmapped teams cache
```

### Data Freshness Monitoring
```
GET    /api/admin/data-freshness           # Check league data currency
POST   /api/admin/refresh-league-data/:id  # Trigger league data refresh
```

## 🤖 Automated Monitoring

### Cron Job Setup
Set up automated data freshness checks:

```bash
# Add to your crontab (crontab -e)
# Check daily at 6 AM
0 6 * * * cd /path/to/backend && node scripts/checkDataFreshness.js

# Check weekly on Mondays
0 9 * * 1 cd /path/to/backend && node scripts/checkDataFreshness.js
```

### Manual Monitoring
```bash
# Run the data freshness check manually
cd flight-match-finder/overlap/backend
node scripts/checkDataFreshness.js
```

The script will:
- ✅ Check all major leagues for season currency
- ⚠️  Detect outdated data (>30 days old)
- 🚨 Alert on season mismatches
- 📧 Provide actionable recommendations

## 📅 Seasonal Calendar

### Key Dates to Monitor:
- **July**: New season data becomes available
- **August**: European leagues start (Premier League, Bundesliga, La Liga, etc.)
- **January**: Winter transfer window + mid-season data updates
- **May**: Season end + playoff data

### Expected Updates for 2024-25:
- **Bundesliga (ID: 78)**: New season starts mid-August 2024
- **Premier League (ID: 39)**: Typically starts August 17th
- **La Liga (ID: 140)**: Usually starts late August
- **Serie A (ID: 135)**: Begins around August 20th

## 🐛 Common Issues

### "Access denied" error
- Make sure you've been promoted to admin role
- Check that you're logged in with the correct account
- Verify the JWT token is being sent with requests

### Unmapped teams not showing
- Run some searches to trigger team mapping
- Check that the teamService logging is connected properly
- Clear the cache if needed

### Database connection issues
- Verify MONGODB_URI in your .env file
- Make sure MongoDB is running
- Check network connectivity

## 🔒 Security Notes

- Admin users can promote/demote other users (except themselves)
- All admin routes require valid JWT + admin role
- Frontend hides admin features for non-admin users
- Role changes take effect immediately (may require re-login)

## 📊 Expected Unmapped Teams

Based on the logs, you should see these teams in your admin dashboard:
- **Argentina**: River Plate, Racing Club, Velez Sarsfield, Estudiantes L.P.
- **Italy**: Sassuolo, Cremonese, Pisa
- **Ecuador**: LDU de Quito

These are perfect test cases for the admin mapping functionality!

---

**Need help?** The admin system is designed to be self-service, but feel free to ask if you run into any issues! 🎯 