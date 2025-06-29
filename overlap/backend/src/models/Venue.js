const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    city: {
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
    
    // GeoJSON location for geospatial queries
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    
    // Additional location info
    address: {
        type: String
    },
    
    // Stadium details
    capacity: {
        type: Number,
        min: 0
    },
    opened: {
        type: Number
    },
    surface: {
        type: String,
        enum: ['Natural grass', 'Artificial turf', 'Hybrid'],
        default: 'Natural grass'
    },
    
    // Practical information
    ticketUrl: {
        type: String
    },
    website: {
        type: String
    },
    parkingSpaces: {
        type: Number,
        min: 0
    },
    
    // Public transport info
    publicTransport: {
        nearest: {
            type: String
        },
        lines: [{
            type: String
        }],
        walkingMinutes: {
            type: Number,
            min: 0
        }
    },
    
    // Reference to home team
    homeTeamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team'
    },
    
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Geospatial index for location-based queries
venueSchema.index({ location: '2dsphere' });

// Other useful indexes
venueSchema.index({ city: 1 });
venueSchema.index({ country: 1 });
venueSchema.index({ homeTeamId: 1 });

// Virtual for backwards compatibility with existing code
venueSchema.virtual('coordinates').get(function() {
    return this.location ? this.location.coordinates : null;
});

// Method to find venues near a location
venueSchema.statics.findNear = function(longitude, latitude, maxDistance = 50000) {
    return this.find({
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                },
                $maxDistance: maxDistance // in meters
            }
        }
    });
};

module.exports = mongoose.model('Venue', venueSchema); 