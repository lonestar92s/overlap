const mongoose = require('mongoose');

const RETENTION_SECONDS = 90 * 24 * 60 * 60;

const nlSearchLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        query: {
            type: String,
            required: true,
            trim: true,
            maxlength: 4000
        },
        source: {
            type: String,
            enum: ['ask_agent_modal', 'messages_screen', 'map_results', 'unknown'],
            default: 'unknown',
            index: true
        },
        success: {
            type: Boolean,
            required: true,
            index: true
        },
        isMultiQuery: {
            type: Boolean,
            default: false
        },
        intent: {
            type: String,
            default: null
        },
        matchCount: {
            type: Number,
            default: 0
        },
        missingFields: {
            type: [String],
            default: []
        },
        confidence: {
            type: Number,
            default: null
        },
        code: {
            type: String,
            default: null
        },
        message: {
            type: String,
            default: null,
            maxlength: 2000
        },
        parsedSummary: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        matchIds: {
            type: [String],
            default: []
        },
        conversationTurns: {
            type: Number,
            default: 0
        },
        durationMs: {
            type: Number,
            default: null
        }
    },
    {
        timestamps: true
    }
);

nlSearchLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });
nlSearchLogSchema.index({ success: 1, createdAt: -1 });
nlSearchLogSchema.index({ matchCount: 1, createdAt: -1 });

const NlSearchLog = mongoose.model('NlSearchLog', nlSearchLogSchema);

module.exports = NlSearchLog;
