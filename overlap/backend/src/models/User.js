const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
        select: false // Don't include password in queries by default
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    subscription: {
        tier: {
            type: String,
            enum: ['freemium', 'pro', 'planner'],
            default: 'freemium'
        },
        startDate: {
            type: Date,
            default: Date.now
        },
        endDate: {
            type: Date,
            default: null // null for freemium (unlimited), date for paid tiers
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    profile: {
        firstName: String,
        lastName: String,
        avatar: String,
        timezone: {
            type: String,
            default: 'UTC'
        }
    },
    preferences: {
        defaultLocation: {
            city: String,
            country: String,
            coordinates: [Number]
        },
        favoriteTeams: [{
            teamId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Team',
                required: true
            },
            addedAt: {
                type: Date,
                default: Date.now
            }
        }],
        favoriteLeagues: [String],
        defaultSearchRadius: {
            type: Number,
            default: 100
        },
        recommendationRadius: {
            type: Number,
            default: 400, // miles
            min: 50,
            max: 1000
        },
        currency: {
            type: String,
            default: 'USD'
        },
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            matchReminders: {
                type: Boolean,
                default: false
            },
            priceAlerts: {
                type: Boolean,
                default: false
            }
        }
    },
    savedMatches: [{
        matchId: String,
        homeTeam: {
            name: String,
            logo: String
        },
        awayTeam: {
            name: String,
            logo: String
        },
        league: String,
        venue: String,
        date: Date,
        savedAt: {
            type: Date,
            default: Date.now
        }
    }],
    visitedStadiums: [{
        venueId: {
            type: String,
            required: true
        },
        venueName: {
            type: String,
            required: true
        },
        city: String,
        country: String,
        visitDate: Date, // Optional - when they visited
        notes: String,   // Optional - personal notes about the visit
        visitedAt: {
            type: Date,
            default: Date.now
        }
    }],
    attendedMatches: [{
        matchId: {
            type: String,
            required: true
        },
        matchType: {
            type: String,
            enum: ['api', 'manual'],
            required: true
        },
        
        // Match details (common for both API and manual)
        homeTeam: {
            name: { type: String, required: true },
            logo: String,
            apiId: String // For API matches
        },
        awayTeam: {
            name: { type: String, required: true },
            logo: String,
            apiId: String // For API matches
        },
        venue: {
            name: { type: String, required: false },
            city: String,
            country: String,
            coordinates: [Number] // [longitude, latitude]
        },
        competition: String,
        date: {
            type: Date,
            required: false
        },
        
        // User-specific data
        userScore: String, // "2-1" or "Arsenal 2-1 Chelsea"
        userNotes: String,
        photos: [{
            // Cloudinary fields
            publicId: String,
            url: String,
            thumbnailUrl: String,
            width: Number,
            height: Number,
            format: String,
            size: Number,
            coordinates: {
                lat: Number,
                lng: Number
            },
            dateTaken: Date,
            uploadDate: {
                type: Date,
                default: Date.now
            },
            caption: String,
            // Legacy field for backward compatibility
            filename: String
        }],
        attendedDate: {
            type: Date,
            default: Date.now
        },
        
        // API match data (for matches found via search)
        apiMatchData: {
            fixtureId: String,
            officialScore: String,
            status: String,
            leagueId: String
        }
    }],
    trips: [{
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            default: ''
        },
        matches: [{
            matchId: String,
            homeTeam: {
                name: String,
                logo: String
            },
            awayTeam: {
                name: String,
                logo: String
            },
            league: String,
            venue: String,
            venueData: {
                type: mongoose.Schema.Types.Mixed,
                default: null
            },
            date: Date,
            addedAt: {
                type: Date,
                default: Date.now
            },
            planning: {
                ticketsAcquired: {
                    type: String,
                    enum: ['yes', 'no', 'in-progress'],
                    default: 'no'
                },
                flight: {
                    type: String,
                    enum: ['yes', 'no', 'in-progress'],
                    default: 'no'
                },
                accommodation: {
                    type: String,
                    enum: ['yes', 'no', 'in-progress'],
                    default: 'no'
                },
                notes: {
                    type: String,
                    default: ''
                }
            }
        }],
        createdAt: {
            type: Date,
            default: Date.now
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    }],
    recommendationHistory: [{
        matchId: {
            type: String,
            required: true
        },
        tripId: {
            type: String,
            default: null
        },
        recommendedDate: {
            type: Date,
            default: null
        },
        recommendedAt: {
            type: Date,
            default: Date.now
        },
        viewedAt: {
            type: Date,
            default: Date.now
        },
        action: {
            type: String,
            enum: ['viewed', 'saved', 'dismissed'],
            default: 'viewed'
        },
        score: {
            type: Number,
            default: 0
        },
        reason: {
            type: String,
            default: ''
        }
    }]
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error(error);
    }
};

// Get public profile (exclude sensitive data)
userSchema.methods.getPublicProfile = function() {
    const userObject = this.toObject();
    delete userObject.password;
    return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User; 