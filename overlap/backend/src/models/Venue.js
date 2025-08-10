const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
    venueId: {
        type: Number,
        required: true,
        unique: true
    },
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
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: false
        },
        coordinates: {
            type: [Number],
            required: false,
            validate: {
                validator: function(v) {
                    return Array.isArray(v) && v.length === 2 &&
                           v[0] >= -180 && v[0] <= 180 && // longitude
                           v[1] >= -90 && v[1] <= 90;     // latitude
                },
                message: 'Coordinates must be [longitude, latitude] array with valid ranges'
            }
        }
    },
    address: {
        type: String
    },
    capacity: {
        type: Number,
        min: 0
    },
    surface: {
        type: String
    },
    image: {
        type: String
    },
    coordinates: {
        type: [Number],
        required: false,
        validate: {
            validator: function(v) {
                return Array.isArray(v) && v.length === 2 &&
                       v[0] >= -180 && v[0] <= 180 && // longitude
                       v[1] >= -90 && v[1] <= 90;     // latitude
            },
            message: 'Coordinates must be [longitude, latitude] array with valid ranges'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Create a 2dsphere index on location for geospatial queries (only for venues with coordinates)
venueSchema.index({ location: '2dsphere' }, { sparse: true });

// Other useful indexes
venueSchema.index({ city: 1 });
venueSchema.index({ country: 1 });
venueSchema.index({ name: 1 });

// Method to find venues near a location
venueSchema.statics.findNear = function(longitude, latitude, maxDistance = 50000) {
    return this.find({
        location: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                },
                $maxDistance: maxDistance
            }
        }
    });
};

// Virtual getters for backward compatibility
venueSchema.virtual('longitude').get(function() {
    return this.location?.coordinates?.[0];
});

venueSchema.virtual('latitude').get(function() {
    return this.location?.coordinates?.[1];
});

module.exports = mongoose.model('Venue', venueSchema); 