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
        const forceRefresh = req.query.forceRefresh === 'true' || req.query.forceRefresh === '1';
        
        console.log(`📥 Trip recommendations endpoint called for tripId: ${tripId}, forceRefresh: ${forceRefresh}`);
        
        if (forceRefresh) {
            console.log(`🔄 Force refresh requested for trip: ${tripId}`);
        }
        
        if (!req.user) {
            console.log(`❌ No user authenticated for trip ${tripId}`);
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        console.log(`👤 Getting user ${req.user.id} for trip recommendations`);
        // Get user with trip data
        const user = await User.findById(req.user.id);
        if (!user) {
            console.log(`❌ User ${req.user.id} not found`);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log(`🔍 Looking for trip ${tripId} in user's ${user.trips?.length || 0} trips`);
        // Find the specific trip
        const trip = user.trips.id(tripId);
        if (!trip) {
            // Trip not found - could be deleted, clear cache and return empty
            console.log(`❌ Trip not found (may have been deleted): ${tripId}`);
            recommendationService.invalidateTripCache(tripId);
            return res.status(404).json({
                success: false,
                message: 'Trip not found',
                recommendations: [],
                diagnostics: {
                    reason: 'trip_not_found',
                    message: 'Trip not found or has been deleted'
                }
            });
        }

        console.log(`✅ Trip found: ${trip.name || tripId}, has ${trip.matches?.length || 0} matches`);
        
        // Check if trip has stored recommendations (v2)
        const hasStoredRecommendations = trip.recommendationsVersion === 'v2' && 
                                         trip.recommendations && 
                                         Array.isArray(trip.recommendations);
        
        if (hasStoredRecommendations && !forceRefresh) {
            // Use stored recommendations
            console.log(`📤 Returning ${trip.recommendations.length} stored recommendations for trip ${tripId}`);
            res.json({
                success: true,
                recommendations: trip.recommendations || [],
                tripId,
                generatedAt: trip.recommendationsGeneratedAt?.toISOString() || new Date().toISOString(),
                cached: false, // Not from cache, but from database
                fromStorage: true,
                diagnostics: trip.recommendationsError ? {
                    reason: 'regeneration_error',
                    message: trip.recommendationsError
                } : null
            });
        } else {
            // Fallback: Generate on-demand (for migration period or force refresh)
            console.log(`🔄 Generating recommendations on-demand for trip ${tripId}${hasStoredRecommendations ? ' (force refresh)' : ' (no stored recommendations)'}`);
            const result = await recommendationService.getRecommendationsForTrip(
                tripId,
                user,
                trip,
                forceRefresh
            );
            
            // If we generated recommendations and trip doesn't have v2, store them
            if (!hasStoredRecommendations && result.recommendations) {
                try {
                    await recommendationService.regenerateTripRecommendations(tripId, user, trip, true);
                    console.log(`✅ Stored generated recommendations for trip ${tripId}`);
                } catch (storeError) {
                    console.error(`❌ Failed to store recommendations for trip ${tripId}:`, storeError);
                    // Continue - return recommendations anyway
                }
            }
            
            console.log(`📤 Returning ${result.recommendations?.length || 0} recommendations for trip ${tripId}`);
            res.json({
                success: true,
                recommendations: result.recommendations || [],
                tripId,
                generatedAt: new Date().toISOString(),
                cached: result.cached || false,
                fromStorage: false,
                diagnostics: result.diagnostics || null
            });
        }

    } catch (error) {
        console.error('Error getting recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get recommendations',
            diagnostics: {
                reason: 'error',
                message: `Error: ${error.message}`
            }
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

        // Regenerate recommendations when user interacts (dismissed/saved affects recommendations)
        if (tripId && (action === 'dismissed' || action === 'saved')) {
            try {
                const trip = user.trips.id(tripId);
                if (trip) {
                    await recommendationService.regenerateTripRecommendations(tripId, user, trip, true);
                    console.log(`✅ Regenerated recommendations for trip ${tripId} after ${action} action`);
                }
            } catch (regenError) {
                console.error(`❌ Failed to regenerate recommendations for trip ${tripId}:`, regenError);
                // Don't fail the request if regeneration fails - interaction was still tracked
            }
        }

        // Legacy cache invalidation (for backward compatibility during migration)
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
