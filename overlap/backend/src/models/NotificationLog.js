const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
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
        required: true,
        index: true
    },
    sentAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    title: String,
    body: String,
    data: mongoose.Schema.Types.Mixed,
    pushTicketIds: [String],
    status: {
        type: String,
        enum: ['sent', 'failed', 'receipt_ok', 'receipt_error'],
        default: 'sent'
    },
    error: String
}, {
    timestamps: true
});

notificationLogSchema.index({ userId: 1, tripId: 1, categoryId: 1, sentAt: -1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
