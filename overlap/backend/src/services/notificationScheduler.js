const cron = require('node-cron');
const ScheduledNotification = require('../models/ScheduledNotification');
const { processTrip, processAllUsers } = require('./tripTicketPromptService');
const { checkReceipts } = require('./pushNotificationService');
const NotificationLog = require('../models/NotificationLog');
const User = require('../models/User');

async function processScheduledNotifications() {
    const now = new Date();
    const pending = await ScheduledNotification.find({
        status: 'pending',
        fireAt: { $lte: now }
    }).limit(100);

    let processed = 0;
    for (const scheduled of pending) {
        try {
            const user = await User.findById(scheduled.userId);
            if (!user) {
                scheduled.status = 'cancelled';
                await scheduled.save();
                continue;
            }

            const trip = user.trips.id(scheduled.tripId);
            if (!trip) {
                scheduled.status = 'cancelled';
                await scheduled.save();
                continue;
            }

            await processTrip(scheduled.userId, trip, user);
            scheduled.status = 'sent';
            await scheduled.save();
            processed++;
        } catch (error) {
            console.error(`Error processing scheduled notification ${scheduled._id}:`, error);
        }
    }
    return processed;
}

async function processReceiptChecks() {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const logs = await NotificationLog.find({
        status: 'sent',
        sentAt: { $gte: oneHourAgo, $lte: fifteenMinAgo },
        'pushTicketIds.0': { $exists: true }
    }).limit(50);

    for (const log of logs) {
        try {
            await checkReceipts(log.pushTicketIds);
            log.status = 'receipt_ok';
            await log.save();
        } catch (error) {
            console.error(`Error checking receipts for log ${log._id}:`, error);
        }
    }
}

function scheduleT30ForTrip(userId, tripId) {
    const fireAt = new Date(Date.now() + 30 * 60 * 1000);
    return ScheduledNotification.findOneAndUpdate(
        { userId, tripId, categoryId: 'trip_ticket_status_prompt' },
        { $setOnInsert: { userId, tripId, categoryId: 'trip_ticket_status_prompt', fireAt, status: 'pending' } },
        { upsert: true, new: true }
    );
}

function startScheduler() {
    // Process T+30 and other scheduled notifications every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        try {
            const count = await processScheduledNotifications();
            if (count > 0) {
                console.log(`[notif-scheduler] Processed ${count} scheduled notifications`);
            }
        } catch (error) {
            console.error('[notif-scheduler] Error processing scheduled:', error);
        }
    });

    // Daily recurring check: run at 10 AM and 6 PM UTC
    cron.schedule('0 10,18 * * *', async () => {
        try {
            const result = await processAllUsers();
            console.log(`[notif-scheduler] Daily run: ${result.totalSent} sent, ${result.tripsProcessed} trips, ${result.usersChecked} users`);
        } catch (error) {
            console.error('[notif-scheduler] Error in daily run:', error);
        }
    });

    // Receipt checks every 20 minutes
    cron.schedule('*/20 * * * *', async () => {
        try {
            await processReceiptChecks();
        } catch (error) {
            console.error('[notif-scheduler] Error checking receipts:', error);
        }
    });

    console.log('[notif-scheduler] Notification scheduler started');
}

module.exports = { startScheduler, scheduleT30ForTrip, processScheduledNotifications };
