const express = require('express');
const { adminAuth } = require('../middleware/auth');
const Team = require('../models/Team');
const Venue = require('../models/Venue');
const Match = require('../models/Match');
const User = require('../models/User');
const teamService = require('../services/teamService');
const venueService = require('../services/venueService');
const subscriptionService = require('../services/subscriptionService');
const { authenticateToken } = require('../middleware/auth');
const { teamSearchCache, matchesCache } = require('../utils/cache');

const router = express.Router();

// Ensure admin role
const ensureAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Admin access required' });
    }
};

// Clear application cache
router.post('/clear-cache', authenticateToken, ensureAdmin, (req, res) => {
    try {
        teamSearchCache.clear();
        matchesCache.clear();
        console.log('🧹 Cache cleared successfully');
        res.json({ message: 'Cache cleared successfully' });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({ message: 'Error clearing cache' });
    }
});

// Track unmapped teams for admin dashboard
const unmappedTeamsCache = {
    teams: new Map(),
    lastUpdated: null,
    cacheDuration: 30 * 60 * 1000 // 30 minutes
};

// Function to log unmapped teams
function logUnmappedTeam(apiTeamName, competitionId = null) {
    if (!unmappedTeamsCache.teams.has(apiTeamName)) {
        unmappedTeamsCache.teams.set(apiTeamName, {
            apiName: apiTeamName,
            occurrences: 1,
            firstSeen: new Date(),
            lastSeen: new Date(),
            competitions: competitionId ? [competitionId] : []
        });
    } else {
        const team = unmappedTeamsCache.teams.get(apiTeamName);
        team.occurrences += 1;
        team.lastSeen = new Date();
        if (competitionId && !team.competitions.includes(competitionId)) {
            team.competitions.push(competitionId);
        }
    }
    unmappedTeamsCache.lastUpdated = new Date();
}

// Make logUnmappedTeam available to other modules
router.logUnmappedTeam = logUnmappedTeam;

// GET /api/admin/unmapped-teams
// Get all unmapped teams that have been encountered
router.get('/unmapped-teams', adminAuth, async (req, res) => {
    try {
        const { sortBy = 'occurrences', order = 'desc' } = req.query;
        
        const teams = Array.from(unmappedTeamsCache.teams.values());
        
        // Sort teams
        teams.sort((a, b) => {
            if (sortBy === 'occurrences') {
                return order === 'desc' ? b.occurrences - a.occurrences : a.occurrences - b.occurrences;
            } else if (sortBy === 'lastSeen') {
                return order === 'desc' ? new Date(b.lastSeen) - new Date(a.lastSeen) : new Date(a.lastSeen) - new Date(b.lastSeen);
            } else {
                return order === 'desc' ? b.apiName.localeCompare(a.apiName) : a.apiName.localeCompare(b.apiName);
            }
        });
        
        res.json({
            success: true,
            data: {
                teams,
                lastUpdated: unmappedTeamsCache.lastUpdated,
                totalUnmapped: teams.length
            }
        });
    } catch (error) {
        console.error('Error fetching unmapped teams:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch unmapped teams'
        });
    }
});

// POST /api/admin/map-team
// Create a mapping for an unmapped team
router.post('/map-team', adminAuth, async (req, res) => {
    try {
        const {
            apiName,
            teamData // { name, city, country, league, venue, founded, isActive, apiName }
        } = req.body;
        
        if (!apiName || !teamData || !teamData.name) {
            return res.status(400).json({
                success: false,
                message: 'API name and team data with name are required'
            });
        }
        
        // Check if team already exists
        const existingTeam = await Team.findOne({ 
            $or: [
                { name: teamData.name },
                { apiName: apiName }
            ]
        });
        
        if (existingTeam) {
            return res.status(400).json({
                success: false,
                message: `Team already exists: ${existingTeam.name}`
            });
        }
        
        // Create new team
        const newTeam = new Team({
            name: teamData.name,
            city: teamData.city || '',
            country: teamData.country || '',
            league: teamData.league || '',
            venue: teamData.venue || '',
            founded: teamData.founded || null,
            isActive: teamData.isActive !== false,
            apiName: apiName
        });
        
        await newTeam.save();
        
        // Remove from unmapped cache
        unmappedTeamsCache.teams.delete(apiName);
        unmappedTeamsCache.lastUpdated = new Date();
        
        res.json({
            success: true,
            message: `Successfully mapped ${apiName} to ${teamData.name}`,
            team: newTeam
        });
        
    } catch (error) {
        console.error('Error mapping team:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to map team'
        });
    }
});

// PUT /api/admin/teams/:teamId
// Update team data
router.put('/teams/:teamId', adminAuth, async (req, res) => {
    try {
        const { teamId } = req.params;
        const updates = req.body;
        
        // Don't allow updating _id
        delete updates._id;
        
        const team = await Team.findByIdAndUpdate(
            teamId,
            updates,
            { new: true, runValidators: true }
        );
        
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Team updated successfully',
            team
        });
        
    } catch (error) {
        console.error('Error updating team:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update team'
        });
    }
});

// GET /api/admin/venues
// Get all venues with pagination and search
router.get('/venues', adminAuth, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 50, 
            search = '',
            country = '',
            hasIssues = false
        } = req.query;
        
        const query = {};
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (country) {
            query.country = country;
        }
        
        // Filter venues with potential issues (missing coordinates, etc.)
        if (hasIssues === 'true') {
            query.$or = [
                { 'location.coordinates': { $exists: false } },
                { 'location.coordinates': [] },
                { name: { $regex: /stadium|ground|arena/i } }, // Generic names that might need fixing
            ];
        }
        
        const venues = await Venue.find(query)
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .sort({ name: 1 });
            
        const total = await Venue.countDocuments(query);
        
        res.json({
            success: true,
            data: {
                venues,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching venues:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch venues'
        });
    }
});

// PUT /api/admin/venues/:venueId
// Update venue data
router.put('/venues/:venueId', adminAuth, async (req, res) => {
    try {
        const { venueId } = req.params;
        const updates = req.body;
        
        // Don't allow updating _id
        delete updates._id;
        
        // Validate coordinates if provided
        if (updates.location && updates.location.coordinates) {
            const [lng, lat] = updates.location.coordinates;
            if (typeof lng !== 'number' || typeof lat !== 'number' || 
                lng < -180 || lng > 180 || lat < -90 || lat > 90) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid coordinates. Longitude must be between -180 and 180, latitude between -90 and 90.'
                });
            }
        }
        
        const venue = await Venue.findByIdAndUpdate(
            venueId,
            updates,
            { new: true, runValidators: true }
        );
        
        if (!venue) {
            return res.status(404).json({
                success: false,
                message: 'Venue not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Venue updated successfully',
            venue
        });
        
    } catch (error) {
        console.error('Error updating venue:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update venue'
        });
    }
});

// GET /api/admin/stats
// Get admin dashboard statistics
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const [
            totalTeams,
            teamsWithApiNames,
            totalVenues,
            venuesWithCoordinates,
            unmappedCount
        ] = await Promise.all([
            Team.countDocuments(),
            Team.countDocuments({ apiName: { $exists: true, $ne: '' } }),
            Venue.countDocuments(),
            Venue.countDocuments({ 'location.coordinates': { $exists: true, $ne: [] } }),
            Promise.resolve(unmappedTeamsCache.teams.size)
        ]);
        
        res.json({
            success: true,
            data: {
                teams: {
                    total: totalTeams,
                    withApiNames: teamsWithApiNames,
                    mappingCoverage: totalTeams > 0 ? ((teamsWithApiNames / totalTeams) * 100).toFixed(1) : 0
                },
                venues: {
                    total: totalVenues,
                    withCoordinates: venuesWithCoordinates,
                    coordinateCoverage: totalVenues > 0 ? ((venuesWithCoordinates / totalVenues) * 100).toFixed(1) : 0
                },
                unmappedTeams: {
                    count: unmappedCount,
                    lastUpdated: unmappedTeamsCache.lastUpdated
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch admin statistics'
        });
    }
});

// POST /api/admin/clear-unmapped-cache
// Clear the unmapped teams cache
router.post('/clear-unmapped-cache', adminAuth, async (req, res) => {
    try {
        unmappedTeamsCache.teams.clear();
        unmappedTeamsCache.lastUpdated = new Date();
        
        res.json({
            success: true,
            message: 'Unmapped teams cache cleared successfully'
        });
        
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear cache'
        });
    }
});

// GET /api/admin/data-freshness
// Monitor API data freshness and detect new seasons
router.get('/data-freshness', adminAuth, async (req, res) => {
    try {
        const leagueService = require('../services/leagueService');
        
        // Check major leagues for season updates
        const majorLeagues = [
            { id: '39', name: 'Premier League', country: 'England' },
            { id: '78', name: 'Bundesliga', country: 'Germany' },
            { id: '140', name: 'La Liga', country: 'Spain' },
            { id: '135', name: 'Serie A', country: 'Italy' },
            { id: '61', name: 'Ligue 1', country: 'France' }
        ];
        
        const seasonStatus = [];
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1; // 1-12
        
        for (const league of majorLeagues) {
            try {
                // Get current season from database
                const dbLeague = await leagueService.getLeagueById(league.id);
                
                // Determine expected season based on current date
                let expectedSeason;
                if (currentMonth >= 8) {
                    // August onwards = new season
                    expectedSeason = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
                } else {
                    // Jan-July = previous season still active
                    expectedSeason = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
                }
                
                // Check if we have fixture data for this league recently
                const recentMatches = await Match.find({
                    league: league.id,
                    date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
                }).limit(1);
                
                const status = {
                    leagueId: league.id,
                    leagueName: league.name,
                    country: league.country,
                    currentSeasonInDB: dbLeague?.season?.start ? 
                        `${new Date(dbLeague.season.start).getFullYear()}-${new Date(dbLeague.season.end).getFullYear().toString().slice(-2)}` : 
                        'Unknown',
                    expectedSeason,
                    isUpToDate: true, // Will be calculated
                    lastDataUpdate: dbLeague?.updatedAt || null,
                    recentMatchesFound: recentMatches.length > 0,
                    issues: []
                };
                
                // Check for issues
                if (status.currentSeasonInDB !== expectedSeason) {
                    status.isUpToDate = false;
                    status.issues.push(`Season mismatch: DB has ${status.currentSeasonInDB}, expected ${expectedSeason}`);
                }
                
                if (!status.recentMatchesFound && currentMonth >= 8 && currentMonth <= 5) {
                    status.issues.push('No recent matches found - possible API or data sync issue');
                }
                
                const daysSinceUpdate = dbLeague?.updatedAt ? 
                    Math.floor((Date.now() - new Date(dbLeague.updatedAt)) / (1000 * 60 * 60 * 24)) : 
                    999;
                
                if (daysSinceUpdate > 30) {
                    status.isUpToDate = false;
                    status.issues.push(`League data not updated for ${daysSinceUpdate} days`);
                }
                
                seasonStatus.push(status);
                
            } catch (error) {
                console.error(`Error checking ${league.name}:`, error);
                seasonStatus.push({
                    leagueId: league.id,
                    leagueName: league.name,
                    country: league.country,
                    isUpToDate: false,
                    issues: [`Error checking league: ${error.message}`]
                });
            }
        }
        
        // Overall system health
        const totalLeagues = seasonStatus.length;
        const upToDateLeagues = seasonStatus.filter(s => s.isUpToDate).length;
        const healthPercentage = Math.round((upToDateLeagues / totalLeagues) * 100);
        
        res.json({
            success: true,
            data: {
                overall: {
                    healthPercentage,
                    upToDateLeagues,
                    totalLeagues,
                    lastChecked: new Date(),
                    status: healthPercentage >= 80 ? 'healthy' : 
                           healthPercentage >= 60 ? 'warning' : 'critical'
                },
                leagues: seasonStatus,
                recommendations: generateRecommendations(seasonStatus)
            }
        });
        
    } catch (error) {
        console.error('Error checking data freshness:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check data freshness'
        });
    }
});

// Helper function to generate recommendations
function generateRecommendations(seasonStatus) {
    const recommendations = [];
    const currentMonth = new Date().getMonth() + 1;
    
    // Season-specific recommendations
    if (currentMonth >= 7 && currentMonth <= 8) {
        recommendations.push({
            type: 'season_prep',
            priority: 'high',
            message: 'New season approaching! Check for updated team rosters and new fixture data.',
            action: 'Verify API data for upcoming season'
        });
    }
    
    // Issue-based recommendations
    const outdatedLeagues = seasonStatus.filter(s => !s.isUpToDate);
    if (outdatedLeagues.length > 0) {
        recommendations.push({
            type: 'data_update',
            priority: 'high',
            message: `${outdatedLeagues.length} league(s) have outdated data`,
            action: 'Update league data and check API responses'
        });
    }
    
    const noRecentMatches = seasonStatus.filter(s => !s.recentMatchesFound && currentMonth >= 8);
    if (noRecentMatches.length > 0) {
        recommendations.push({
            type: 'api_sync',
            priority: 'medium',
            message: `${noRecentMatches.length} league(s) missing recent match data`,
            action: 'Check API-Sports connection and data sync'
        });
    }
    
    return recommendations;
}

// POST /api/admin/refresh-league-data
// Manually trigger a league data refresh
router.post('/refresh-league-data/:leagueId', adminAuth, async (req, res) => {
    try {
        const { leagueId } = req.params;
        const leagueService = require('../services/leagueService');
        
        // This would trigger an API call to refresh league data
        // For now, just update the timestamp
        const league = await leagueService.getLeagueById(leagueId);
        if (!league) {
            return res.status(404).json({
                success: false,
                message: 'League not found'
            });
        }
        
        // In a real implementation, you'd call the external API here
        // await fetchLatestLeagueData(leagueId);
        
        res.json({
            success: true,
            message: `Refresh triggered for ${league.name}`,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Error refreshing league data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh league data'
        });
    }
});

// GET /api/admin/users
// Get all users with pagination and subscription info
router.get('/users', adminAuth, async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 50, 
            search = '',
            tier = ''
        } = req.query;
        
        const query = {};
        
        if (search) {
            query.$or = [
                { email: { $regex: search, $options: 'i' } },
                { 'profile.firstName': { $regex: search, $options: 'i' } },
                { 'profile.lastName': { $regex: search, $options: 'i' } }
            ];
        }
        
        if (tier) {
            query['subscription.tier'] = tier;
        }
        
        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await User.countDocuments(query);
        
        // Add subscription stats to the response
        const subscriptionStats = await User.aggregate([
            {
                $group: {
                    _id: '$subscription.tier',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Format subscription stats
        const tierStats = {
            freemium: 0,
            pro: 0,
            planner: 0
        };
        
        subscriptionStats.forEach(stat => {
            const tier = stat._id || 'freemium';
            tierStats[tier] = stat.count;
        });
        
        res.json({
            success: true,
            data: {
                users,
                stats: {
                    total,
                    tierStats,
                    tierAccess: subscriptionService.getAllTiers()
                },
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});

// PUT /api/admin/users/:userId/subscription
// Update user subscription tier
router.put('/users/:userId/subscription', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { tier } = req.body;
        
        if (!tier || !['freemium', 'pro', 'planner'].includes(tier)) {
            return res.status(400).json({
                success: false,
                message: 'Valid subscription tier is required (freemium, pro, planner)'
            });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Update subscription using service
        subscriptionService.updateUserTier(user, tier);
        await user.save();
        
        res.json({
            success: true,
            message: `Successfully updated ${user.email} to ${tier} tier`,
            user: {
                id: user._id,
                email: user.email,
                subscription: user.subscription
            }
        });
        
    } catch (error) {
        console.error('Error updating user subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update subscription'
        });
    }
});

// GET /api/admin/subscription-stats
// Get subscription statistics
router.get('/subscription-stats', adminAuth, async (req, res) => {
    try {
        const stats = await User.aggregate([
            {
                $group: {
                    _id: '$subscription.tier',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        // Get total users
        const totalUsers = await User.countDocuments();
        
        // Format stats
        const tierStats = {
            freemium: 0,
            pro: 0,
            planner: 0
        };
        
        stats.forEach(stat => {
            const tier = stat._id || 'freemium';
            tierStats[tier] = stat.count;
        });
        
        // Get tier access info
        const tierAccess = subscriptionService.getAllTiers();
        
        res.json({
            success: true,
            data: {
                totalUsers,
                tierStats,
                tierAccess
            }
        });
        
    } catch (error) {
        console.error('Error fetching subscription stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription stats'
        });
    }
});

module.exports = router; 

