const express = require('express');
const leagueService = require('../services/leagueService');
const subscriptionService = require('../services/subscriptionService');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * GET /api/leagues
 * Get all active leagues (filtered by subscription)
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Get user from token (optional - if no token, default to freemium)
        let user = null;
        if (req.user) {
            user = await User.findById(req.user.id);
        }
        
        const leagues = await leagueService.getAllLeagues();
        
        // Filter leagues based on subscription
        const accessibleLeagueIds = subscriptionService.getAccessibleLeagues(user);
        const filteredLeagues = leagues.filter(league => 
            accessibleLeagueIds.includes(league.apiId)
        );
        
        // Format for frontend consumption
        const formattedLeagues = filteredLeagues.map(league => ({
            id: league.apiId,
            name: league.name,
            tier: league.tier || 1,
            country: league.country,
            countryCode: league.countryCode,
            subscriptionRequired: !subscriptionService.hasLeagueAccess(user, league.apiId)
        }));

        res.json({
            success: true,
            data: formattedLeagues,
            userTier: user?.subscription?.tier || 'freemium'
        });
    } catch (error) {
        console.error('Error fetching leagues:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leagues',
            error: error.message
        });
    }
});

/**
 * GET /api/leagues/search
 * Search leagues by name or country
 * Returns results from database first, then falls back to API if needed
 */
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;
        
        if (!query || query.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters'
            });
        }

        // Search in database using leagueService
        const leagues = await leagueService.searchLeagues(query, { limit: 20 });

        // Format results for response
        const formattedLeagues = leagues.map(league => ({
            id: league.apiId,
            name: league.name,
            country: league.country,
            countryCode: league.countryCode,
            tier: league.tier || 1,
            emblem: league.emblem || null,
            isActive: league.isActive !== false
        }));

        res.json({
            success: true,
            results: formattedLeagues,
            count: formattedLeagues.length
        });

    } catch (error) {
        console.error('League search error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search leagues'
        });
    }
});

/**
 * GET /api/leagues/stats/cache
 * Get league service cache statistics
 */
router.get('/stats/cache', async (req, res) => {
    try {
        const stats = leagueService.getCacheStats();
        res.json({
            success: true,
            cacheStats: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting league cache stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get cache statistics',
            error: error.message
        });
    }
});

/**
 * GET /api/leagues/country/:countryCode
 * Get leagues for a specific country
 */
router.get('/country/:countryCode', async (req, res) => {
    try {
        const { countryCode } = req.params;
        const leagues = await leagueService.getLeaguesForCountry(countryCode);
        
        // Format for frontend consumption
        const formattedLeagues = leagues.map(league => ({
            id: league.apiId,
            name: league.name,
            tier: league.tier || 1,
            country: league.country,
            countryCode: league.countryCode
        }));

        res.json({
            success: true,
            data: formattedLeagues
        });
    } catch (error) {
        console.error(`Error fetching leagues for country ${req.params.countryCode}:`, error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leagues for country',
            error: error.message
        });
    }
});

/**
 * GET /api/leagues/:leagueId
 * Get specific league information
 */
router.get('/:leagueId', async (req, res) => {
    try {
        const { leagueId } = req.params;
        const league = await leagueService.getLeagueById(leagueId);
        
        if (!league) {
            return res.status(404).json({
                success: false,
                message: 'League not found'
            });
        }

        // Format for frontend consumption
        const formattedLeague = {
            id: league.apiId,
            name: league.name,
            tier: league.tier || 1,
            country: league.country,
            countryCode: league.countryCode,
            emblem: league.emblem
        };

        res.json({
            success: true,
            data: formattedLeague
        });
    } catch (error) {
        console.error(`Error fetching league ${req.params.leagueId}:`, error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch league',
            error: error.message
        });
    }
});

module.exports = router; 