const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const Feedback = require('../models/Feedback');

const router = express.Router();

// POST /api/feedback
// Submit user feedback (requires authentication)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { message, type = 'general', metadata = {} } = req.body;

        // Validate message
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Feedback message is required'
            });
        }

        if (message.trim().length > 2000) {
            return res.status(400).json({
                success: false,
                error: 'Feedback message is too long (max 2000 characters)'
            });
        }

        // Validate type
        const validTypes = ['general', 'bug', 'feature', 'rating'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: `Invalid feedback type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        // Create feedback entry
        const feedback = new Feedback({
            message: message.trim(),
            type,
            user: req.user._id || req.user.id,
            userEmail: req.user.email,
            userName: req.user.name || req.user.username || req.user.email?.split('@')[0] || 'Unknown',
            status: 'new',
            metadata
        });

        await feedback.save();

        res.status(201).json({
            success: true,
            message: 'Feedback submitted successfully',
            data: {
                id: feedback._id,
                type: feedback.type,
                createdAt: feedback.createdAt
            }
        });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit feedback',
            message: error.message
        });
    }
});

module.exports = router;


