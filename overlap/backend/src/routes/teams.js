const express = require('express');
const router = express.Router();
const teamService = require('../services/teamService');
const auth = require('../middleware/auth');

/**
 * GET /api/teams/search?q=searchTerm&limit=20
 * Search for teams by name, code, or alias
 */
router.get('/search', async (req, res) => {
    try {
        const { q: searchTerm, limit = 20 } = req.query;
        
        if (!searchTerm || searchTerm.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search term must be at least 2 characters long'
            });
        }

        const teams = await teamService.searchTeams(searchTerm.trim(), parseInt(limit));
        
        res.json({
            success: true,
            data: {
                teams,
                searchTerm,
                count: teams.length
            }
        });
    } catch (error) {
        console.error('Team search error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search teams'
        });
    }
});

/**
 * GET /api/teams/popular?limit=50
 * Get popular teams for autocomplete suggestions
 */
router.get('/popular', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const teams = await teamService.getPopularTeams(parseInt(limit));
        
        res.json({
            success: true,
            data: {
                teams,
                count: teams.length
            }
        });
    } catch (error) {
        console.error('Popular teams error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get popular teams'
        });
    }
});

/**
 * POST /api/teams/populate
 * Admin endpoint to populate database with teams from major leagues
 * Requires authentication
 */
router.post('/populate', auth, async (req, res) => {
    try {
        // In a real app, you'd want admin-only access
        await teamService.populatePopularTeams();
        
        res.json({
            success: true,
            message: 'Started populating teams database'
        });
    } catch (error) {
        console.error('Team population error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to populate teams'
        });
    }
});

/**
 * GET /api/teams/stats
 * Get statistics about cached teams
 */
router.get('/stats', async (req, res) => {
    try {
        const Team = require('../models/Team');
        
        const stats = await Team.aggregate([
            {
                $group: {
                    _id: null,
                    totalTeams: { $sum: 1 },
                    totalSearches: { $sum: '$searchCount' },
                    countries: { $addToSet: '$country' },
                    avgPopularity: { $avg: '$popularity' }
                }
            }
        ]);

        const topTeams = await Team.find({})
            .sort({ searchCount: -1 })
            .limit(10)
            .select('name country searchCount popularity');

        res.json({
            success: true,
            data: {
                overview: stats[0] || {
                    totalTeams: 0,
                    totalSearches: 0,
                    countries: [],
                    avgPopularity: 0
                },
                topTeams,
                countriesCount: stats[0]?.countries?.length || 0
            }
        });
    } catch (error) {
        console.error('Team stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get team statistics'
        });
    }
});

module.exports = router; 