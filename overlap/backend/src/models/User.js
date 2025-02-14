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
    preferences: {
        defaultLocation: {
            city: String,
            country: String,
            coordinates: {
                type: [Number],
                validate: {
                    validator: function(v) {
                        return v.length === 2;
                    },
                    message: 'Coordinates must be [longitude, latitude]'
                }
            }
        },
        favoriteTeams: [String],
        favoriteLeagues: [String],
        defaultSearchRadius: {
            type: Number,
            default: 100
        }
    }
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

const User = mongoose.model('User', userSchema);

module.exports = User; 