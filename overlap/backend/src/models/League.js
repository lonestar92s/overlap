const mongoose = require('mongoose');

const leagueSchema = new mongoose.Schema({
    apiId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    shortName: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    countryCode: {
        type: String,
        required: true,
        length: 2
    },
    tier: {
        type: Number,
        required: true,
        min: 1,
        max: 10
    },
    emblem: {
        type: String
    },
    season: {
        start: {
            type: String,
            required: true
        },
        end: {
            type: String,
            required: true
        },
        current: {
            type: Boolean,
            default: true
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for common queries
leagueSchema.index({ country: 1 });
leagueSchema.index({ tier: 1 });
leagueSchema.index({ 'season.current': 1 });

module.exports = mongoose.model('League', leagueSchema); 