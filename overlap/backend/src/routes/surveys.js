const express = require('express');
const SurveyResponse = require('../models/Survey');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

/**
 * POST /api/surveys
 * Submit a new survey response
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            overallSatisfaction,
            primaryUseCase,
            favoriteFeatures,
            improvements,
            recommendationLikelihood,
            additionalComments,
            demographics,
            appVersion,
            platform,
            deviceInfo
        } = req.body;

        // Validate required fields
        if (!overallSatisfaction || !primaryUseCase || !recommendationLikelihood || !appVersion) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: overallSatisfaction, primaryUseCase, recommendationLikelihood, appVersion'
            });
        }

        // Get user info if authenticated
        let user = null;
        if (req.user) {
            user = await User.findById(req.user.id);
        }

        // Create survey response
        const surveyData = {
            userId: user?._id,
            userEmail: user?.email || req.body.userEmail,
            overallSatisfaction,
            primaryUseCase,
            favoriteFeatures: favoriteFeatures || [],
            improvements: improvements || '',
            recommendationLikelihood,
            additionalComments: additionalComments || '',
            demographics: demographics || {},
            appVersion,
            platform: platform || 'ios',
            deviceInfo: deviceInfo || {},
            submissionDate: new Date()
        };

        const survey = new SurveyResponse(surveyData);
        await survey.save();

        console.log(`📊 New survey response submitted by ${user?.email || 'anonymous'}`);

        res.status(201).json({
            success: true,
            message: 'Survey response submitted successfully',
            data: {
                id: survey._id,
                submissionDate: survey.submissionDate
            }
        });

    } catch (error) {
        console.error('Error submitting survey:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit survey response',
            error: error.message
        });
    }
});

/**
 * GET /api/surveys/stats
 * Get survey statistics and analytics
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        // Check if user has admin access (optional - you can modify this logic)
        const user = await User.findById(req.user.id);
        const isAdmin = user?.role === 'admin' || user?.email?.includes('@yourdomain.com'); // Modify as needed

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        // Get basic stats
        const totalResponses = await SurveyResponse.countDocuments();
        const recentResponses = await SurveyResponse.countDocuments({
            submissionDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        });

        // Get NPS score
        const npsData = await SurveyResponse.calculateNPS();
        
        // Get satisfaction stats
        const satisfactionStats = await SurveyResponse.getSatisfactionStats();
        
        // Get feature popularity
        const featurePopularity = await SurveyResponse.getFeaturePopularity();

        // Get use case distribution
        const useCaseStats = await SurveyResponse.aggregate([
            {
                $group: {
                    _id: '$primaryUseCase',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get demographics if available
        const demographicsStats = {
            ageRange: await SurveyResponse.aggregate([
                { $match: { 'demographics.ageRange': { $exists: true, $ne: null } } },
                { $group: { _id: '$demographics.ageRange', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            travelFrequency: await SurveyResponse.aggregate([
                { $match: { 'demographics.travelFrequency': { $exists: true, $ne: null } } },
                { $group: { _id: '$demographics.travelFrequency', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            footballFandom: await SurveyResponse.aggregate([
                { $match: { 'demographics.footballFandom': { $exists: true, $ne: null } } },
                { $group: { _id: '$demographics.footballFandom', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        };

        // Get recent feedback comments
        const recentFeedback = await SurveyResponse.find({
            $or: [
                { improvements: { $ne: '' } },
                { additionalComments: { $ne: '' } }
            ]
        })
        .sort({ submissionDate: -1 })
        .limit(10)
        .select('improvements additionalComments submissionDate overallSatisfaction');

        res.json({
            success: true,
            data: {
                overview: {
                    totalResponses,
                    recentResponses,
                    averageSatisfaction: satisfactionStats.average,
                    npsScore: npsData.nps
                },
                nps: npsData,
                satisfaction: satisfactionStats,
                features: featurePopularity,
                useCases: useCaseStats,
                demographics: demographicsStats,
                recentFeedback
            }
        });

    } catch (error) {
        console.error('Error fetching survey stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch survey statistics',
            error: error.message
        });
    }
});

/**
 * GET /api/surveys/responses
 * Get all survey responses (admin only)
 */
router.get('/responses', authenticateToken, async (req, res) => {
    try {
        // Check admin access
        const user = await User.findById(req.user.id);
        const isAdmin = user?.role === 'admin' || user?.email?.includes('@yourdomain.com');

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const responses = await SurveyResponse.find()
            .populate('userId', 'email name')
            .sort({ submissionDate: -1 })
            .skip(skip)
            .limit(limit);

        const total = await SurveyResponse.countDocuments();

        res.json({
            success: true,
            data: {
                responses,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalResponses: total,
                    hasNextPage: page * limit < total,
                    hasPrevPage: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Error fetching survey responses:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch survey responses',
            error: error.message
        });
    }
});

/**
 * GET /api/surveys/export
 * Export survey data as CSV (admin only)
 */
router.get('/export', authenticateToken, async (req, res) => {
    try {
        // Check admin access
        const user = await User.findById(req.user.id);
        const isAdmin = user?.role === 'admin' || user?.email?.includes('@yourdomain.com');

        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        const responses = await SurveyResponse.find()
            .populate('userId', 'email')
            .sort({ submissionDate: -1 });

        // Convert to CSV format
        const csvHeaders = [
            'ID',
            'Submission Date',
            'User Email',
            'Overall Satisfaction',
            'Primary Use Case',
            'Favorite Features',
            'Improvements',
            'Recommendation Likelihood',
            'Additional Comments',
            'Age Range',
            'Travel Frequency',
            'Football Fandom',
            'App Version',
            'Platform'
        ].join(',');

        const csvRows = responses.map(response => [
            response._id,
            response.submissionDate.toISOString(),
            response.userId?.email || response.userEmail || 'Anonymous',
            response.overallSatisfaction,
            response.primaryUseCase,
            response.favoriteFeatures.join(';'),
            `"${response.improvements.replace(/"/g, '""')}"`,
            response.recommendationLikelihood,
            `"${response.additionalComments.replace(/"/g, '""')}"`,
            response.demographics?.ageRange || '',
            response.demographics?.travelFrequency || '',
            response.demographics?.footballFandom || '',
            response.appVersion,
            response.platform
        ].join(','));

        const csvContent = [csvHeaders, ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="survey-responses-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);

    } catch (error) {
        console.error('Error exporting survey data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export survey data',
            error: error.message
        });
    }
});

module.exports = router;

