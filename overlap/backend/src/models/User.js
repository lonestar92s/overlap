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

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
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