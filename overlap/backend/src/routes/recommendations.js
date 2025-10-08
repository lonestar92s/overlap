const express = require('express');
const { auth, authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const recommendationService = require('../services/recommendationService');

const router = express.Router();

/**
 * GET /api/trips/:tripId/recommendations
 * Get recommendations for a specific trip
 */
router.get('/trips/:tripId/recommendations', authenticateToken, async (req, res) => {
    try {
        const { tripId } = req.params;
        
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Get user with trip data
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find the specific trip
        const trip = user.trips.id(tripId);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }

        // Generate recommendations
        const result = await recommendationService.getRecommendationsForTrip(
            tripId,
            user,
            trip
        );

        // Set cache headers for client-side caching
        res.set({
            'Cache-Control': 'private, max-age=3600', // Cache for 1 hour on client
            'ETag': `"${tripId}-${user._id}-${Date.now()}"`, // Simple ETag for cache validation
            'Last-Modified': new Date().toUTCString()
        });

        res.json({
            success: true,
            recommendations: result.recommendations || result, // Handle both formats for backward compatibility
            tripId,
            generatedAt: new Date().toISOString(),
            cached: result.cached || false
        });

    } catch (error) {
        console.error('Error getting recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get recommendations'
        });
    }
});

/**
 * POST /api/recommendations/:matchId/track
 * Track user interaction with a recommendation
 */
router.post('/:matchId/track', authenticateToken, async (req, res) => {
    try {
        const { matchId } = req.params;
        const { action, tripId, recommendedDate, score, reason } = req.body;
        
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Validate action
        const validActions = ['viewed', 'saved', 'dismissed'];
        if (!validActions.includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid action. Must be one of: viewed, saved, dismissed'
            });
        }

        // Get user
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Add to recommendation history
        const recommendationEntry = {
            matchId,
            tripId: tripId || null,
            recommendedDate: recommendedDate || null,
            recommendedAt: new Date(),
            viewedAt: new Date(),
            action,
            score: score || 0,
            reason: reason || ''
        };

        // Initialize recommendationHistory if it doesn't exist
        if (!user.recommendationHistory) {
            user.recommendationHistory = [];
        }

        user.recommendationHistory.push(recommendationEntry);
        await user.save();

        // Invalidate cache when user interacts with recommendations
        if (tripId) {
            recommendationService.invalidateTripCache(tripId);
        }
        recommendationService.invalidateUserCache(req.user.id);

        res.json({
            success: true,
            message: 'Recommendation interaction tracked',
            action,
            matchId
        });

    } catch (error) {
        console.error('Error tracking recommendation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to track recommendation interaction'
        });
    }
});

/**
 * GET /api/recommendations/history
 * Get user's recommendation history for analytics
 */
router.get('/history', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('recommendationHistory');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get recent recommendation history (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentHistory = user.recommendationHistory.filter(
            entry => new Date(entry.recommendedAt) >= thirtyDaysAgo
        );

        // Sort by most recent first
        recentHistory.sort((a, b) => new Date(b.recommendedAt) - new Date(a.recommendedAt));

        res.json({
            success: true,
            history: recentHistory,
            totalCount: recentHistory.length
        });

    } catch (error) {
        console.error('Error getting recommendation history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get recommendation history'
        });
    }
});

/**
 * GET /api/recommendations/analytics
 * Get recommendation analytics for the user
 */
router.get('/analytics', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('recommendationHistory');
        
        if (!user || !user.recommendationHistory) {
            return res.json({
                success: true,
                analytics: {
                    totalRecommendations: 0,
                    savedCount: 0,
                    dismissedCount: 0,
                    viewedCount: 0,
                    saveRate: 0,
                    averageScore: 0
                }
            });
        }

        const history = user.recommendationHistory;
        
        // Calculate analytics
        const totalRecommendations = history.length;
        const savedCount = history.filter(h => h.action === 'saved').length;
        const dismissedCount = history.filter(h => h.action === 'dismissed').length;
        const viewedCount = history.filter(h => h.action === 'viewed').length;
        
        const saveRate = totalRecommendations > 0 ? (savedCount / totalRecommendations) * 100 : 0;
        const averageScore = totalRecommendations > 0 ? 
            history.reduce((sum, h) => sum + (h.score || 0), 0) / totalRecommendations : 0;

        res.json({
            success: true,
            analytics: {
                totalRecommendations,
                savedCount,
                dismissedCount,
                viewedCount,
                saveRate: Math.round(saveRate * 100) / 100,
                averageScore: Math.round(averageScore * 100) / 100
            }
        });

    } catch (error) {
        console.error('Error getting recommendation analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get recommendation analytics'
        });
    }
});

module.exports = router;
