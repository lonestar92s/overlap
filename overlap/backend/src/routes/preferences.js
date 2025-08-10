const express = require('express');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Team = require('../models/Team');

const router = express.Router();

// Get user profile and preferences
router.get('/', auth, async (req, res) => {
    try {
        // Populate favorite teams with full team data
        await req.user.populate('preferences.favoriteTeams.teamId');
        
        res.json({ 
            profile: req.user.profile,
            preferences: req.user.preferences 
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['firstName', 'lastName', 'avatar', 'timezone'];

    const isValidOperation = updates.every(update => 
        allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
        return res.status(400).json({ error: 'Invalid profile updates' });
    }

    try {
        updates.forEach(update => {
            req.user.profile[update] = req.body[update];
        });

        await req.user.save();
        res.json({ profile: req.user.profile });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update user preferences
router.put('/', auth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
        'defaultLocation',
        'favoriteTeams',
        'favoriteLeagues',
        'defaultSearchRadius',
        'currency',
        'notifications'
    ];

    // Validate update fields
    const isValidOperation = updates.every(update => 
        allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
        return res.status(400).json({ error: 'Invalid updates' });
    }

    try {
        // Update each field in preferences
        updates.forEach(update => {
            if (update === 'notifications' && typeof req.body[update] === 'object') {
                // Handle nested notifications object
                req.user.preferences.notifications = {
                    ...req.user.preferences.notifications,
                    ...req.body[update]
                };
            } else {
                req.user.preferences[update] = req.body[update];
            }
        });

        await req.user.save();
        res.json({ preferences: req.user.preferences });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add favorite team
router.post('/teams', auth, async (req, res) => {
    try {
        const { teamId } = req.body;
        
        // Verify team exists
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        
        // Check if team is already in favorites
        const isAlreadyFavorite = req.user.preferences.favoriteTeams.some(
            fav => fav.teamId.toString() === teamId
        );
        
        if (!isAlreadyFavorite) {
            req.user.preferences.favoriteTeams.push({ teamId });
            await req.user.save();
        }
        
        // Return populated favorite teams
        await req.user.populate('preferences.favoriteTeams.teamId');
        res.json({ favoriteTeams: req.user.preferences.favoriteTeams });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Remove favorite team
router.delete('/teams/:teamId', auth, async (req, res) => {
    try {
        const teamId = req.params.teamId;
        req.user.preferences.favoriteTeams = req.user.preferences.favoriteTeams
            .filter(fav => fav.teamId.toString() !== teamId);
        
        await req.user.save();
        
        // Return populated favorite teams
        await req.user.populate('preferences.favoriteTeams.teamId');
        res.json({ favoriteTeams: req.user.preferences.favoriteTeams });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add favorite league
router.post('/leagues', auth, async (req, res) => {
    try {
        const { leagueId } = req.body;
        
        if (!req.user.preferences.favoriteLeagues.includes(leagueId)) {
            req.user.preferences.favoriteLeagues.push(leagueId);
            await req.user.save();
        }
        
        res.json({ favoriteLeagues: req.user.preferences.favoriteLeagues });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Remove favorite league
router.delete('/leagues/:leagueId', auth, async (req, res) => {
    try {
        const leagueId = req.params.leagueId;
        req.user.preferences.favoriteLeagues = req.user.preferences.favoriteLeagues
            .filter(league => league !== leagueId);
        
        await req.user.save();
        res.json({ favoriteLeagues: req.user.preferences.favoriteLeagues });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get saved matches
router.get('/saved-matches', auth, async (req, res) => {
    try {
        res.json({ savedMatches: req.user.savedMatches });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Save a match
router.post('/saved-matches', auth, async (req, res) => {
    try {
        const { matchId, homeTeam, awayTeam, league, venue, date } = req.body;
        
        // Validate required fields
        if (!matchId) {
            return res.status(400).json({ error: 'matchId is required' });
        }
        
        if (!homeTeam || !awayTeam) {
            return res.status(400).json({ error: 'homeTeam and awayTeam are required' });
        }
        
        if (!league) {
            return res.status(400).json({ error: 'league is required' });
        }
        
        if (!venue) {
            return res.status(400).json({ error: 'venue is required' });
        }
        
        if (!date) {
            return res.status(400).json({ error: 'date is required' });
        }
        
        // Check if match is already saved
        const existingMatch = req.user.savedMatches.find(match => match.matchId === matchId);
        if (existingMatch) {
            return res.status(400).json({ error: 'Match already saved' });
        }
        
        // Format the data according to the User model schema
        const matchData = {
            matchId,
            homeTeam: {
                name: typeof homeTeam === 'string' ? homeTeam : (homeTeam?.name || 'Unknown Team'),
                logo: typeof homeTeam === 'object' ? homeTeam?.logo : ''
            },
            awayTeam: {
                name: typeof awayTeam === 'string' ? awayTeam : (awayTeam?.name || 'Unknown Team'),
                logo: typeof awayTeam === 'object' ? awayTeam?.logo : ''
            },
            league: typeof league === 'string' ? league : (league?.name || 'Unknown League'),
            venue: typeof venue === 'string' ? venue : (venue?.name || 'Unknown Venue'),
            date: new Date(date)
        };
        
        // Validate the date
        if (isNaN(matchData.date.getTime())) {
            return res.status(400).json({ 
                error: 'Invalid date format', 
                receivedDate: date,
                parsedDate: matchData.date.toString()
            });
        }
        
        console.log('Saving match data:', matchData);
        
        req.user.savedMatches.push(matchData);
        
        await req.user.save();
        res.json({ savedMatches: req.user.savedMatches });
    } catch (error) {
        console.error('Error saving match:', error);
        res.status(400).json({ error: error.message });
    }
});

// Remove saved match
router.delete('/saved-matches/:matchId', auth, async (req, res) => {
    try {
        const matchId = req.params.matchId;
        req.user.savedMatches = req.user.savedMatches.filter(match => match.matchId !== matchId);
        
        await req.user.save();
        res.json({ savedMatches: req.user.savedMatches });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get visited stadiums
router.get('/visited-stadiums', auth, async (req, res) => {
    try {
        res.json({ visitedStadiums: req.user.visitedStadiums });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add visited stadium
router.post('/visited-stadiums', auth, async (req, res) => {
    try {
        const { venueId, venueName, city, country, visitDate, notes } = req.body;
        
        // Validate required fields
        if (!venueId || !venueName) {
            return res.status(400).json({ error: 'venueId and venueName are required' });
        }
        
        // Check if stadium is already visited
        const existingStadium = req.user.visitedStadiums.find(
            stadium => stadium.venueId === venueId
        );
        
        if (existingStadium) {
            return res.status(400).json({ error: 'Stadium already marked as visited' });
        }
        
        // Add stadium to visited list
        const stadiumData = {
            venueId,
            venueName,
            city: city || '',
            country: country || '',
            visitDate: visitDate ? new Date(visitDate) : null,
            notes: notes || ''
        };
        
        req.user.visitedStadiums.push(stadiumData);
        await req.user.save();
        
        res.json({ visitedStadiums: req.user.visitedStadiums });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update visited stadium
router.put('/visited-stadiums/:venueId', auth, async (req, res) => {
    try {
        const { venueId } = req.params;
        const { visitDate, notes } = req.body;
        
        const stadium = req.user.visitedStadiums.find(
            stadium => stadium.venueId === venueId
        );
        
        if (!stadium) {
            return res.status(404).json({ error: 'Stadium not found in visited list' });
        }
        
        // Update allowed fields
        if (visitDate !== undefined) {
            stadium.visitDate = visitDate ? new Date(visitDate) : null;
        }
        if (notes !== undefined) {
            stadium.notes = notes;
        }
        
        await req.user.save();
        res.json({ visitedStadiums: req.user.visitedStadiums });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Remove visited stadium
router.delete('/visited-stadiums/:venueId', auth, async (req, res) => {
    try {
        const { venueId } = req.params;
        
        req.user.visitedStadiums = req.user.visitedStadiums.filter(
            stadium => stadium.venueId !== venueId
        );
        
        await req.user.save();
        res.json({ visitedStadiums: req.user.visitedStadiums });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 