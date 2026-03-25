const express = require('express');
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const NotificationLog = require('../models/NotificationLog');
const router = express.Router();

const MAX_NOTIFICATION_PAGE = 100;

router.get('/unread-count', auth, async (req, res) => {
    try {
        const count = await NotificationLog.countDocuments({
            userId: req.user._id,
            openedAt: null
        });
        res.json({ success: true, unreadCount: count });
    } catch (error) {
        console.error('Error counting unread notifications:', error);
        res.status(500).json({ error: 'Failed to count notifications' });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const limit = Math.min(
            Math.max(parseInt(req.query.limit, 10) || 50, 1),
            MAX_NOTIFICATION_PAGE
        );
        const cursor = req.query.cursor;
        const query = { userId: req.user._id };
        if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
            query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
        }

        const raw = await NotificationLog.find(query)
            .sort({ sentAt: -1, _id: -1 })
            .limit(limit + 1)
            .lean();

        const hasMore = raw.length > limit;
        const slice = hasMore ? raw.slice(0, limit) : raw;
        const nextCursor =
            hasMore && slice.length > 0
                ? String(slice[slice.length - 1]._id)
                : null;

        res.json({
            success: true,
            notifications: slice.map((n) => ({
                id: String(n._id),
                title: n.title || '',
                body: n.body || '',
                sentAt: n.sentAt,
                openedAt: n.openedAt,
                categoryId: n.categoryId,
                data: n.data || {}
            })),
            nextCursor
        });
    } catch (error) {
        console.error('Error listing notifications:', error);
        res.status(500).json({ error: 'Failed to list notifications' });
    }
});

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
