const User = require('../models/User');
const NotificationLog = require('../models/NotificationLog');
const ScheduledNotification = require('../models/ScheduledNotification');
const Feedback = require('../models/Feedback');
const cloudinaryService = require('./cloudinaryService');
const { invalidateRecommendedMatchesCache } = require('../utils/cache');

/**
 * Permanently delete a user and scrub linked PII (CCPA-style deletion).
 * @param {import('mongoose').Document} user - Mongoose user document (req.user)
 */
async function deleteUserAccount(user) {
    const userId = user._id;

    if (user.role === 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
            const err = new Error(
                'Cannot delete the only administrator account. Promote another user to admin first.'
            );
            err.statusCode = 400;
            throw err;
        }
    }

    const cloudinaryEnabled = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'demo';

    if (cloudinaryEnabled) {
        const publicIds = new Set();
        const avatarPid = user.profile?.avatarPublicId;
        if (avatarPid) {
            publicIds.add(avatarPid);
        }
        for (const match of user.attendedMatches || []) {
            for (const photo of match.photos || []) {
                if (photo.publicId) {
                    publicIds.add(photo.publicId);
                }
            }
        }
        for (const pid of publicIds) {
            try {
                await cloudinaryService.deletePhoto(pid);
            } catch (e) {
                console.warn('Cloudinary delete failed (continuing):', pid, e.message);
            }
        }
    }

    await NotificationLog.deleteMany({ userId });
    await ScheduledNotification.deleteMany({ userId });

    const feedbackOr = [{ user: userId }];
    if (user.email) {
        feedbackOr.push({ userEmail: user.email });
    }
    await Feedback.updateMany(
        { $or: feedbackOr },
        { $set: { user: null, userEmail: '', userName: '' } }
    );

    invalidateRecommendedMatchesCache(String(userId));

    await User.findByIdAndDelete(userId);
}

module.exports = { deleteUserAccount };
