const mongoose = require('mongoose');

const scheduledNotificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    tripId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    categoryId: {
        type: String,
        required: true
    },
    fireAt: {
        type: Date,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'sent', 'cancelled'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

scheduledNotificationSchema.index({ status: 1, fireAt: 1 });
scheduledNotificationSchema.index({ userId: 1, tripId: 1, categoryId: 1 }, { unique: true });

module.exports = mongoose.model('ScheduledNotification', scheduledNotificationSchema);
