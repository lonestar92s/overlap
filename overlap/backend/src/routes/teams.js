const express = require('express');
const { auth, adminAuth } = require('../middleware/auth');
const teamService = require('../services/teamService');
const Team = require('../models/Team');
const axios = require('axios');
const { teamSearchCache } = require('../utils/cache');

const router = express.Router();

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY;
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

/**
 * GET /api/teams/search
 * Search teams by name, returns both database teams and API results
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

        // Check cache first
        const cacheKey = `search_${query.toLowerCase()}`;
        const cachedResults = teamSearchCache.get(cacheKey);
        
        if (cachedResults) {
            return res.json({
                success: true,
                results: cachedResults,
                fromCache: true
            });
        }

        // Search local database first
        const dbTeams = await Team.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { aliases: { $regex: query, $options: 'i' } }
            ]
        })
        .select('name apiId logo country city')
        .limit(10);

        // If we have enough results from DB, cache and return them
        if (dbTeams.length >= 5) {
            const results = dbTeams.map(team => ({
                id: team.apiId,
                name: team.name,
                logo: team.logo,
                country: team.country,
                city: team.city
            }));

            teamSearchCache.set(cacheKey, results);
            
            return res.json({
                success: true,
                results,
                fromCache: false
            });
        }

        // Otherwise, also search API-Sports
        try {
            const apiResponse = await axios.get(`${API_SPORTS_BASE_URL}/teams`, {
                params: { search: query },
                headers: {
                    'x-apisports-key': API_SPORTS_KEY
                }
            });

            const apiTeams = apiResponse.data.response || [];
            
            // Combine and deduplicate results
            const allTeams = [
                ...dbTeams.map(team => ({
                    id: team.apiId,
                    name: team.name,
                    logo: team.logo,
                    country: team.country,
                    city: team.city,
                    source: 'db'
                })),
                ...apiTeams.map(team => ({
                    id: team.team.id.toString(),
                    name: team.team.name,
                    logo: team.team.logo,
                    country: team.team.country,
                    city: team.venue?.city,
                    source: 'api'
                }))
            ];

            // Remove duplicates based on team ID
            const uniqueTeams = Array.from(
                new Map(allTeams.map(team => [team.id, team])).values()
            ).slice(0, 10); // Limit to 10 results

            // Cache the results
            teamSearchCache.set(cacheKey, uniqueTeams);

            res.json({
                success: true,
                results: uniqueTeams,
                fromCache: false
            });

        } catch (apiError) {
            // If API call fails, return and cache database results
            console.error('API search failed:', apiError.message);
            const results = dbTeams.map(team => ({
                id: team.apiId,
                name: team.name,
                logo: team.logo,
                country: team.country,
                city: team.city,
                source: 'db'
            }));

            teamSearchCache.set(cacheKey, results);

            res.json({
                success: true,
                results,
                fromCache: false
            });
        }

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

        const teams = await teamService.getPopularTeams(parseInt(limit));

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

/**
 * GET /api/teams/cache/stats
 * Get cache statistics (for monitoring)
 */
router.get('/cache/stats', adminAuth, (req, res) => {
    const stats = teamSearchCache.getStats();
    res.json({
        success: true,
        stats
    });
});

/**
 * POST /api/teams/cache/clear
 * Clear the cache (admin only)
 */
router.post('/cache/clear', adminAuth, (req, res) => {
    teamSearchCache.clear();
    res.json({
        success: true,
        message: 'Cache cleared'
    });
});

module.exports = router; 