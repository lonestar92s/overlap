const { Expo } = require('expo-server-sdk');
const User = require('../models/User');
const NotificationLog = require('../models/NotificationLog');

const expo = new Expo();

async function sendPushToUser(userId, { title, body, data, channelId = 'trip-planning' }) {
    const user = await User.findById(userId);
    if (!user || !user.deviceTokens || user.deviceTokens.length === 0) {
        return { sent: 0, failed: 0, reason: 'no_tokens' };
    }

    const validTokens = user.deviceTokens.filter(dt => Expo.isExpoPushToken(dt.token));
    if (validTokens.length === 0) {
        return { sent: 0, failed: 0, reason: 'no_valid_tokens' };
    }

    const messages = validTokens.map(dt => ({
        to: dt.token,
        sound: 'default',
        title,
        body,
        data: data || {},
        priority: 'high',
        channelId
    }));

    const chunks = expo.chunkPushNotifications(messages);
    const ticketIds = [];
    let sent = 0;
    let failed = 0;

    for (const chunk of chunks) {
        try {
            const tickets = await expo.sendPushNotificationsAsync(chunk);
            for (const ticket of tickets) {
                if (ticket.status === 'ok') {
                    sent++;
                    if (ticket.id) ticketIds.push(ticket.id);
                } else {
                    failed++;
                    if (ticket.details?.error === 'DeviceNotRegistered') {
                        const badToken = chunk.find((_, i) => tickets[i] === ticket)?.to;
                        if (badToken) {
                            await removeInvalidToken(userId, badToken);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error sending push chunk:', error);
            failed += chunk.length;
        }
    }

    return { sent, failed, ticketIds };
}

async function removeInvalidToken(userId, token) {
    try {
        await User.updateOne(
            { _id: userId },
            { $pull: { deviceTokens: { token } } }
        );
    } catch (error) {
        console.error('Error removing invalid token:', error);
    }
}

async function checkReceipts(ticketIds) {
    if (!ticketIds || ticketIds.length === 0) return;

    const chunks = expo.chunkPushNotificationReceiptIds(ticketIds);
    for (const chunk of chunks) {
        try {
            const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
            for (const [receiptId, receipt] of Object.entries(receipts)) {
                if (receipt.status === 'error') {
                    console.error(`Receipt error for ${receiptId}:`, receipt.message);
                    if (receipt.details?.error === 'DeviceNotRegistered') {
                        // Token is stale — it was already cleaned on ticket check
                        // but log for visibility
                        console.warn(`DeviceNotRegistered on receipt ${receiptId}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching receipts:', error);
        }
    }
}

module.exports = { sendPushToUser, checkReceipts, removeInvalidToken };
