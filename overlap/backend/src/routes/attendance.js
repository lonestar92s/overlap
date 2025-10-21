const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const router = express.Router();

/**
 * POST /api/attendance/mark-attended
 * Mark a match as attended by the user
 */
router.post('/mark-attended', authenticateToken, async (req, res) => {
    try {
        const { matchId, matchData, userScore, userNotes } = req.body;
        
        if (!matchId || !matchData) {
            return res.status(400).json({
                success: false,
                message: 'Match ID and match data are required'
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if match is already marked as attended
        const existingAttendance = user.attendedMatches.find(
            match => match.matchId === matchId
        );

        if (existingAttendance) {
            return res.status(400).json({
                success: false,
                message: 'Match already marked as attended'
            });
        }

        // Create attended match entry
        const attendedMatch = {
            matchId,
            matchType: 'api',
            homeTeam: {
                name: matchData.homeTeam?.name || 'Unknown',
                logo: matchData.homeTeam?.logo,
                apiId: matchData.homeTeam?.id
            },
            awayTeam: {
                name: matchData.awayTeam?.name || 'Unknown',
                logo: matchData.awayTeam?.logo,
                apiId: matchData.awayTeam?.id
            },
            venue: {
                name: matchData.venue?.name,
                city: matchData.venue?.city,
                country: matchData.venue?.country,
                coordinates: matchData.venue?.coordinates
            },
            competition: matchData.league || matchData.competition?.name,
            date: matchData.date ? new Date(matchData.date) : null,
            userScore: userScore || null,
            userNotes: userNotes || null,
            attendedDate: new Date(),
            apiMatchData: {
                fixtureId: matchData.fixture?.id || matchData.id,
                officialScore: matchData.score?.fullTime ? 
                    `${matchData.score.fullTime.home}-${matchData.score.fullTime.away}` : null,
                status: matchData.status || 'FINISHED',
                leagueId: matchData.competition?.id || matchData.leagueId
            }
        };

        // Add to user's attended matches
        user.attendedMatches.push(attendedMatch);
        await user.save();

        console.log(`✅ User ${user.email} marked match ${matchId} as attended`);

        res.json({
            success: true,
            message: 'Match marked as attended',
            attendedMatch
        });

    } catch (error) {
        console.error('Error marking match as attended:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark match as attended',
            error: error.message
        });
    }
});

/**
 * GET /api/attendance/user-matches
 * Get all attended matches for the current user
 */
router.get('/user-matches', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Sort by attended date (most recent first)
        const attendedMatches = user.attendedMatches.sort(
            (a, b) => new Date(b.attendedDate) - new Date(a.attendedDate)
        );

        res.json({
            success: true,
            matches: attendedMatches,
            totalCount: attendedMatches.length
        });

    } catch (error) {
        console.error('Error fetching attended matches:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attended matches',
            error: error.message
        });
    }
});

/**
 * DELETE /api/attendance/:matchId
 * Remove a match from attended matches
 */
router.delete('/:matchId', authenticateToken, async (req, res) => {
    try {
        const { matchId } = req.params;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find and remove the match
        const matchIndex = user.attendedMatches.findIndex(
            match => match.matchId === matchId
        );

        if (matchIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Attended match not found'
            });
        }

        user.attendedMatches.splice(matchIndex, 1);
        await user.save();

        console.log(`🗑️ User ${user.email} removed match ${matchId} from attended matches`);

        res.json({
            success: true,
            message: 'Match removed from attended matches'
        });

    } catch (error) {
        console.error('Error removing attended match:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove attended match',
            error: error.message
        });
    }
});

/**
 * PUT /api/attendance/:matchId
 * Update an attended match (score, notes, etc.)
 */
router.put('/:matchId', authenticateToken, async (req, res) => {
    try {
        const { matchId } = req.params;
        const { userScore, userNotes } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const match = user.attendedMatches.find(
            match => match.matchId === matchId
        );

        if (!match) {
            return res.status(404).json({
                success: false,
                message: 'Attended match not found'
            });
        }

        // Update match data
        if (userScore !== undefined) match.userScore = userScore;
        if (userNotes !== undefined) match.userNotes = userNotes;

        await user.save();

        res.json({
            success: true,
            message: 'Attended match updated',
            match
        });

    } catch (error) {
        console.error('Error updating attended match:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update attended match',
            error: error.message
        });
    }
});

module.exports = router;
