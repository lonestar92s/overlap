const express = require('express');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
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
