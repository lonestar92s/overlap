const mongoose = require('mongoose');

const surveyResponseSchema = new mongoose.Schema({
    // User information
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Allow anonymous submissions
    },
    userEmail: {
        type: String,
        required: false
    },
    
    // Survey responses
    overallSatisfaction: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    primaryUseCase: {
        type: String,
        enum: ['finding_matches', 'planning_trips', 'discovering_venues', 'tracking_memories', 'other'],
        required: true
    },
    favoriteFeatures: [{
        type: String,
        enum: [
            'match_search',
            'map_view', 
            'trip_planning',
            'memories',
            'international_competitions',
            'venue_information',
            'notifications'
        ]
    }],
    improvements: {
        type: String,
        maxlength: 1000
    },
    recommendationLikelihood: {
        type: Number,
        min: 1,
        max: 10,
        required: true
    },
    additionalComments: {
        type: String,
        maxlength: 1000
    },
    
    // Demographics (optional)
    demographics: {
        ageRange: {
            type: String,
            enum: ['18-24', '25-34', '35-44', '45-54', '55+', 'prefer_not_to_say']
        },
        travelFrequency: {
            type: String,
            enum: ['weekly', 'monthly', 'few_times_year', 'annually', 'rarely']
        },
        footballFandom: {
            type: String,
            enum: ['die_hard_fan', 'general_fan', 'casual_viewer', 'travel_focused']
        }
    },
    
    // Metadata
    appVersion: {
        type: String,
        required: true
    },
    platform: {
        type: String,
        enum: ['ios', 'android', 'web'],
        default: 'ios'
    },
    deviceInfo: {
        type: Object
    },
    submissionDate: {
        type: Date,
        default: Date.now
    },
    
    // Analytics
    isProcessed: {
        type: Boolean,
        default: false
    },
    processingNotes: {
        type: String
    }
}, {
    timestamps: true
});

// Indexes for analytics
surveyResponseSchema.index({ submissionDate: -1 });
surveyResponseSchema.index({ overallSatisfaction: 1 });
surveyResponseSchema.index({ recommendationLikelihood: 1 });
surveyResponseSchema.index({ primaryUseCase: 1 });
surveyResponseSchema.index({ userId: 1 });

// Calculate NPS score helper
surveyResponseSchema.statics.calculateNPS = async function() {
    const surveys = await this.find({ recommendationLikelihood: { $exists: true } });
    
    if (surveys.length === 0) return { nps: 0, total: 0 };
    
    const promoters = surveys.filter(s => s.recommendationLikelihood >= 9).length;
    const detractors = surveys.filter(s => s.recommendationLikelihood <= 6).length;
    const total = surveys.length;
    
    const nps = ((promoters - detractors) / total) * 100;
    
    return {
        nps: Math.round(nps),
        total,
        promoters,
        detractors,
        passives: total - promoters - detractors
    };
};

// Get satisfaction distribution
surveyResponseSchema.statics.getSatisfactionStats = async function() {
    const pipeline = [
        {
            $group: {
                _id: '$overallSatisfaction',
                count: { $sum: 1 }
            }
        },
        {
            $sort: { _id: 1 }
        }
    ];
    
    const results = await this.aggregate(pipeline);
    const total = results.reduce((sum, item) => sum + item.count, 0);
    
    return {
        distribution: results.map(item => ({
            rating: item._id,
            count: item.count,
            percentage: Math.round((item.count / total) * 100)
        })),
        total,
        average: results.reduce((sum, item) => sum + (item._id * item.count), 0) / total
    };
};

// Get feature popularity
surveyResponseSchema.statics.getFeaturePopularity = async function() {
    const pipeline = [
        { $unwind: '$favoriteFeatures' },
        {
            $group: {
                _id: '$favoriteFeatures',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ];
    
    const results = await this.aggregate(pipeline);
    const totalResponses = await this.countDocuments({ favoriteFeatures: { $exists: true, $ne: [] } });
    
    return results.map(item => ({
        feature: item._id,
        count: item.count,
        percentage: Math.round((item.count / totalResponses) * 100)
    }));
};

module.exports = mongoose.model('SurveyResponse', surveyResponseSchema);

