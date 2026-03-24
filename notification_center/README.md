# Notification center — documentation

Product and engineering docs for push, scheduling, preferences, and related backend/mobile behavior.

## Documents

| File | Description |
|------|-------------|
| [NOTIFICATION_CENTER_CATEGORIES.md](./NOTIFICATION_CENTER_CATEGORIES.md) | **Category catalog**: triggers, frequency, batching, copy, payloads, MongoDB fields (e.g. trip ticket check-in). |
| [NOTIFICATIONS_SERVICE_ARCHITECTURE.md](./NOTIFICATIONS_SERVICE_ARCHITECTURE.md) | **System architecture**: detection, services, data model, scale, preferences. |
| [NOTIFICATIONS_IMPLEMENTATION_PLAN.md](./NOTIFICATIONS_IMPLEMENTATION_PLAN.md) | **Build order**: Expo push, email phases, sample patterns. |

## Implementation (code)

| Area | Location |
|------|----------|
| Mobile — permissions, Expo token, register with API, **foreground presentation** | `mobile-app/services/notifications.js` |
| Mobile — token registration after login / logout | `mobile-app/contexts/AuthContext.js` |
| Mobile — tap → navigate to trip | `mobile-app/App.js` |
| Backend — device tokens, prefs | `overlap/backend/src/routes/notifications.js`, `overlap/backend/src/models/User.js` |
| Backend — Expo send, receipts | `overlap/backend/src/services/pushNotificationService.js` |
| Backend — trip ticket prompt logic | `overlap/backend/src/services/tripTicketPromptService.js` |
| Backend — cron (T+30, daily, receipts) | `overlap/backend/src/services/notificationScheduler.js` |

## Client behavior: foreground vs background

When the app is **in the foreground** (`AppState` = `active`), the client **does not** show a system banner, play the default sound, or update the badge for an incoming remote notification (see `setNotificationHandler` in `notifications.js`). When the app is **backgrounded or quit**, normal push presentation applies.

Payloads are still delivered; you can add an in-app toast via `addNotificationReceivedListener` later if you want visibility while active.

Project-wide index: [`../ARCHITECTURE.md`](../ARCHITECTURE.md) (References → Notifications).
