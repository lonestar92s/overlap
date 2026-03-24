const express = require('express');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const NotificationLog = require('../models/NotificationLog');
const router = express.Router();

router.post('/register-token', auth, async (req, res) => {
    try {
        const { token, platform } = req.body;

        if (!token || !platform) {
            return res.status(400).json({ error: 'Token and platform are required' });
        }
        if (!['ios', 'android', 'web'].includes(platform)) {
            return res.status(400).json({ error: 'Platform must be ios, android, or web' });
        }

        const user = await User.findById(req.user._id);
        const existing = user.deviceTokens.find(
            dt => dt.token === token && dt.platform === platform
        );

        if (existing) {
            existing.lastUsedAt = new Date();
        } else {
            user.deviceTokens.push({ token, platform });
        }

        await user.save();
        res.json({ success: true, message: 'Device token registered' });
    } catch (error) {
        console.error('Error registering device token:', error);
        res.status(500).json({ error: 'Failed to register device token' });
    }
});

router.delete('/unregister-token/:token', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        user.deviceTokens = user.deviceTokens.filter(
            dt => dt.token !== req.params.token
        );
        await user.save();
        res.json({ success: true, message: 'Device token removed' });
    } catch (error) {
        console.error('Error unregistering device token:', error);
        res.status(500).json({ error: 'Failed to unregister device token' });
    }
});

router.post('/log-opened/:logId', auth, async (req, res) => {
    try {
        const { logId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(logId)) {
            return res.status(400).json({ error: 'Invalid notification log id' });
        }

        const log = await NotificationLog.findOne({
            _id: logId,
            userId: req.user._id
        });

        if (!log) {
            return res.status(404).json({ error: 'Notification log not found' });
        }

        if (!log.openedAt) {
            log.openedAt = new Date();
            await log.save();
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error recording notification open:', error);
        res.status(500).json({ error: 'Failed to record notification open' });
    }
});

router.put('/preferences', auth, async (req, res) => {
    try {
        const { tripTicketStatus } = req.body;
        const user = await User.findById(req.user._id);

        if (tripTicketStatus !== undefined) {
            user.preferences.notifications.tripTicketStatus = tripTicketStatus;
        }

        await user.save();
        res.json({
            success: true,
            notifications: user.preferences.notifications
        });
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(500).json({ error: 'Failed to update notification preferences' });
    }
});

module.exports = router;
