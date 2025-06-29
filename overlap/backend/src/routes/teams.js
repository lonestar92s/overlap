const express = require('express');
const { auth, adminAuth } = require('../middleware/auth');
const teamService = require('../services/teamService');

const router = express.Router();

/**
 * GET /api/teams/search
 * Search teams by name or city
 */
router.get('/search', async (req, res) => {
    try {
        const { 
            query, 
            country, 
            league, 
            limit = 10,
            includeInactive = false 
        } = req.query;

        const teams = await teamService.searchTeams({
            query,
            country,
            league,
            limit: parseInt(limit),
            includeInactive: includeInactive === 'true'
        });

        res.json({
            success: true,
            results: teams,
            count: teams.length
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
 * GET /api/teams/popular
 * Get popular/featured teams
 */
router.get('/popular', async (req, res) => {
    try {
        const { 
            country, 
            league,
            limit = 20 
        } = req.query;

        const teams = await teamService.getPopularTeams({
            country,
            league,
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            teams
        });
    } catch (error) {
        console.error('Popular teams error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch popular teams'
        });
    }
});

/**
 * POST /api/teams/populate
 * Admin endpoint to populate database with teams from major leagues
 * Requires admin authentication
 */
router.post('/populate', adminAuth, async (req, res) => {
    try {
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