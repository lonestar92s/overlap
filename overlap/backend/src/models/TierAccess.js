const mongoose = require('mongoose');

const tierAccessSchema = new mongoose.Schema({
    tier: {
        type: String,
        enum: ['freemium', 'pro', 'planner'],
        required: true,
        unique: true
    },
    restrictedLeagues: [{
        type: String, // League API IDs (deprecated - use allowedLeagues instead)
        required: false
    }],
    allowedLeagues: [{
        type: String, // League API IDs - leagues this tier can access
        required: false
    }],
    description: {
        type: String,
        required: false
    }
}, {
    timestamps: true
});

// Index for fast tier lookups
tierAccessSchema.index({ tier: 1 });

module.exports = mongoose.model('TierAccess', tierAccessSchema);
