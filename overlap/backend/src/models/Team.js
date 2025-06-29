const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    // External API identifier
    apiId: {
        type: String,
        required: true,
        unique: true
    },
    
    // Team basic info
    name: {
        type: String,
        required: true,
        index: true // For fast text searches
    },
    
    // API-Sports specific name (for mapping API responses)
    apiName: {
        type: String,
        index: true // For fast API name lookups
    },
    
    // Alternative names for better search (Ajax, AFC Ajax, etc.)
    aliases: [String],
    
    // Team details
    shortName: String, // FCZ, FCB, etc.
    fullName: String, // Full official name
    code: String, // 3-letter code like "LIV", "MUN"
    founded: Number,
    logo: String,
    website: String,
    
    // Team colors for UI
    colors: {
        primary: String,
        secondary: String
    },
    
    // Social media
    social: {
        twitter: String,
        instagram: String,
        facebook: String
    },
    
    // Location info
    country: {
        type: String,
        required: true,
        index: true
    },
    countryCode: String,
    city: String,
    
    // References to related entities
    leagueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'League',
        required: true
    },
    venueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Venue'
    },
    
    // Legacy venue data (for backwards compatibility during migration)
    venue: {
        name: String,
        capacity: Number,
        coordinates: [Number] // [longitude, latitude]
    },
    
    // Caching metadata
    searchCount: {
        type: Number,
        default: 1 // How many times this team has been searched
    },
    popularity: {
        type: Number,
        default: 0 // Calculated popularity score
    },
    
    // API data freshness
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    apiSource: {
        type: String,
        default: 'football-api' // Track which API this came from
    }
}, {
    timestamps: true
});

// Indexes for efficient searching
teamSchema.index({ name: 'text', aliases: 'text' }); // Full-text search
// Note: apiName index already defined as field-level index: true
teamSchema.index({ country: 1, name: 1 }); // Country + name lookup
teamSchema.index({ searchCount: -1 }); // Popular teams first
teamSchema.index({ 'leagues.leagueId': 1 }); // League-based queries

// Method to increment search count and update popularity
teamSchema.methods.incrementSearch = function() {
    this.searchCount += 1;
    // Simple popularity calculation: search count + recency boost
    const daysSinceUpdate = (Date.now() - this.lastUpdated) / (1000 * 60 * 60 * 24);
    this.popularity = this.searchCount * (1 / (1 + daysSinceUpdate * 0.1));
    return this.save();
};

// Static method to find teams by search term
teamSchema.statics.searchTeams = function(searchTerm, limit = 20) {
    return this.find({
        $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { aliases: { $regex: searchTerm, $options: 'i' } },
            { code: { $regex: searchTerm, $options: 'i' } }
        ]
    })
    .sort({ popularity: -1, searchCount: -1 })
    .limit(limit);
};

// Static method to get popular teams
teamSchema.statics.getPopularTeams = function(limit = 50) {
    return this.find({})
        .sort({ popularity: -1, searchCount: -1 })
        .limit(limit);
};

// Check if team data is stale (older than 30 days)
teamSchema.methods.isStale = function() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.lastUpdated < thirtyDaysAgo;
};

const Team = mongoose.model('Team', teamSchema);

module.exports = Team; 