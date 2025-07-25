const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    apiId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Team references
    homeTeamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    awayTeamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    
    // Venue and league references
    venueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Venue',
        required: true
    },
    leagueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'League',
        required: true
    },
    
    // Match timing
    kickoff: {
        type: Date,
        required: true
    },
    timezone: {
        type: String,
        required: true
    },
    matchday: {
        type: Number,
        min: 1
    },
    season: {
        type: String,
        required: true
    },
    
    // Match details
    status: {
        type: String,
        enum: ['SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED'],
        default: 'SCHEDULED'
    },
    stage: {
        type: String,
        default: 'REGULAR_SEASON'
    },
    
    // Score information
    score: {
        home: {
            type: Number,
            default: null
        },
        away: {
            type: Number,
            default: null
        },
        halfTime: {
            home: {
                type: Number,
                default: null
            },
            away: {
                type: Number,
                default: null
            }
        }
    },
    
    // Additional match data
    attendance: {
        type: Number,
        min: 0
    },
    
    // Weather conditions (populated closer to match date)
    weather: {
        temperature: Number,
        conditions: String,
        humidity: Number,
        windSpeed: Number
    },
    
    // User engagement metrics
    usersSaved: {
        type: Number,
        default: 0
    },
    viewCount: {
        type: Number,
        default: 0
    },
    
    // Cache timestamps
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    isStale: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes for common queries
matchSchema.index({ kickoff: 1 });
matchSchema.index({ homeTeamId: 1, awayTeamId: 1 });
matchSchema.index({ leagueId: 1, kickoff: 1 });
matchSchema.index({ venueId: 1, kickoff: 1 });
matchSchema.index({ status: 1 });
matchSchema.index({ lastUpdated: 1 });

// Compound index for date range queries
matchSchema.index({ leagueId: 1, kickoff: 1, status: 1 });

// Add geospatial index for venue coordinates
matchSchema.index({ "venue.coordinates": "2dsphere" });

// Method to check if match data is fresh
matchSchema.methods.isFresh = function(hours = 6) {
    const staleTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.lastUpdated > staleTime;
};

// Static method to find upcoming matches
matchSchema.statics.findUpcoming = function(limit = 50) {
    return this.find({
        kickoff: { $gte: new Date() },
        status: 'SCHEDULED'
    })
    .populate('homeTeamId awayTeamId venueId leagueId')
    .sort({ kickoff: 1 })
    .limit(limit);
};

// Static method to find matches needing update
matchSchema.statics.findStale = function(hours = 6) {
    const staleTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.find({
        $or: [
            { lastUpdated: { $lt: staleTime } },
            { isStale: true }
        ],
        kickoff: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Only future or recent matches
    });
};

module.exports = mongoose.model('Match', matchSchema); 