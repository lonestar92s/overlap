const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    type: {
        type: String,
        enum: ['general', 'bug', 'feature', 'rating'],
        default: 'general',
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // Allow anonymous feedback
        index: true
    },
    userEmail: {
        type: String,
        required: false,
        index: true
    },
    userName: {
        type: String,
        required: false
    },
    status: {
        type: String,
        enum: ['new', 'reviewed', 'resolved', 'archived'],
        default: 'new',
        index: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Index for efficient queries
feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ type: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ userEmail: 1, createdAt: -1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;


