const User = require('../models/User');
const NotificationLog = require('../models/NotificationLog');
const { sendPushToUser } = require('./pushNotificationService');

const CATEGORY_ID = 'trip_ticket_status_prompt';
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function getEligibleMatches(trip) {
    if (!trip.matches || trip.matches.length === 0) return [];
    const now = new Date();
    return trip.matches.filter(m => {
        const isPast = m.date && new Date(m.date) < now;
        if (isPast) return false;
        const status = m.planning?.ticketsAcquired;
        return status === 'no' || status === 'in-progress';
    });
}

function buildNotificationContent(trip, eligibleMatches) {
    const notStarted = eligibleMatches.filter(m => m.planning?.ticketsAcquired === 'no');
    const inProgress = eligibleMatches.filter(m => m.planning?.ticketsAcquired === 'in-progress');
    const hasNotStarted = notStarted.length > 0;
    const hasInProgress = inProgress.length > 0;

    let title, body;

    if (hasNotStarted) {
        title = 'Still need tickets?';
        if (notStarted.length === 1 && !hasInProgress) {
            const m = notStarted[0];
            body = `${m.homeTeam?.name || 'Home'} vs ${m.awayTeam?.name || 'Away'} on your trip "${trip.name}" still needs tickets.`;
        } else {
            const parts = [];
            if (notStarted.length > 0) parts.push(`${notStarted.length} need tickets`);
            if (inProgress.length > 0) parts.push(`${inProgress.length} in progress`);
            body = `${eligibleMatches.length} matches on "${trip.name}" — ${parts.join(', ')}.`;
        }
    } else {
        title = 'Finish your tickets';
        if (inProgress.length === 1) {
            const m = inProgress[0];
            body = `Wrap up tickets for ${m.homeTeam?.name || 'Home'} vs ${m.awayTeam?.name || 'Away'} on "${trip.name}".`;
        } else {
            body = `${inProgress.length} matches on "${trip.name}" still have tickets in progress.`;
        }
    }

    return {
        title,
        body,
        data: {
            type: CATEGORY_ID,
            tripId: trip._id.toString(),
            matchIds: eligibleMatches.map(m => m.matchId),
            hasNotStarted,
            hasInProgress
        }
    };
}

function getMaxSendsPerDay(trip) {
    const now = new Date();
    const upcoming = trip.matches
        .filter(m => m.date && new Date(m.date) > now)
        .map(m => new Date(m.date))
        .sort((a, b) => a - b);

    if (upcoming.length === 0) return 1;
    const nearestMs = upcoming[0].getTime() - now.getTime();
    return nearestMs <= FOURTEEN_DAYS_MS ? 2 : 1;
}

async function getSendsToday(userId, tripId) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return NotificationLog.countDocuments({
        userId,
        tripId,
        categoryId: CATEGORY_ID,
        sentAt: { $gte: startOfDay }
    });
}

async function processTrip(userId, trip, user) {
    const eligible = getEligibleMatches(trip);
    if (eligible.length === 0) return null;

    if (!user.preferences?.notifications?.tripTicketStatus) return null;

    const maxPerDay = getMaxSendsPerDay(trip);
    const sentToday = await getSendsToday(userId, trip._id);
    if (sentToday >= maxPerDay) return null;

    const { title, body, data } = buildNotificationContent(trip, eligible);
    const result = await sendPushToUser(userId, { title, body, data });

    if (result.sent > 0) {
        await NotificationLog.create({
            userId,
            tripId: trip._id,
            categoryId: CATEGORY_ID,
            title,
            body,
            data,
            pushTicketIds: result.ticketIds || [],
            status: 'sent'
        });
    }

    return result;
}

async function processAllUsers() {
    const now = new Date();
    const users = await User.find({
        'deviceTokens.0': { $exists: true },
        'preferences.notifications.tripTicketStatus': { $ne: false }
    });

    let totalSent = 0;
    let totalFailed = 0;
    let tripsProcessed = 0;

    for (const user of users) {
        for (const trip of user.trips) {
            try {
                const result = await processTrip(user._id, trip, user);
                if (result) {
                    totalSent += result.sent;
                    totalFailed += result.failed;
                    tripsProcessed++;
                }
            } catch (error) {
                console.error(`Error processing trip ${trip._id} for user ${user._id}:`, error);
            }
        }
    }

    return { totalSent, totalFailed, tripsProcessed, usersChecked: users.length };
}

module.exports = {
    CATEGORY_ID,
    getEligibleMatches,
    buildNotificationContent,
    processTrip,
    processAllUsers
};
