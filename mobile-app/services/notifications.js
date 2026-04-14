import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { getPersistedAuthToken } from './secureAuthStorage';

// No system banner/sound while the app is foregrounded (user is "in" the app).
// Background / quit → normal alert + sound + badge. Foreground → suppress (data still delivered).
Notifications.setNotificationHandler({
    handleNotification: async () => {
        const isForeground = AppState.currentState === 'active';
        return {
            shouldShowAlert: !isForeground,
            shouldPlaySound: !isForeground,
            shouldSetBadge: !isForeground,
        };
    },
});

async function registerForPushNotifications() {
    if (!Device.isDevice) {
        console.warn('Push notifications require a physical device');
        return null;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.warn('Push notification permission not granted');
        return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
        console.error('Missing EAS projectId in app.json extra.eas.projectId');
        return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('trip-planning', {
            name: 'Trip Planning',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#1a1a2e',
        });
    }

    return token;
}

async function registerTokenWithBackend(token) {
    if (!token) return;
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    try {
        const authToken = await getPersistedAuthToken();
        if (!authToken) return;

        const response = await fetch(`${getApiBaseUrl()}/notifications/register-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ token, platform }),
        });
        const data = await response.json();
        if (!data.success) {
            console.error('Failed to register push token:', data.error);
        }
    } catch (error) {
        console.error('Error registering push token with backend:', error);
    }
}

async function unregisterTokenFromBackend(token) {
    if (!token) return;
    try {
        const authToken = await getPersistedAuthToken();
        if (!authToken) return;

        await fetch(`${getApiBaseUrl()}/notifications/unregister-token/${encodeURIComponent(token)}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
        });
    } catch (error) {
        console.error('Error unregistering push token:', error);
    }
}

function getApiBaseUrl() {
    if (!process.env.EXPO_PUBLIC_API_URL) {
        if (__DEV__) return 'http://localhost:3001/api';
        throw new Error('EXPO_PUBLIC_API_URL must be set in production.');
    }
    return process.env.EXPO_PUBLIC_API_URL;
}

async function recordNotificationOpened(notificationLogId) {
    if (notificationLogId == null || notificationLogId === '') return;
    try {
        const authToken = await getPersistedAuthToken();
        if (!authToken) return;

        const response = await fetch(
            `${getApiBaseUrl()}/notifications/log-opened/${encodeURIComponent(String(notificationLogId))}`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            }
        );
        if (!response.ok && __DEV__) {
            const err = await response.json().catch(() => ({}));
            console.warn('recordNotificationOpened failed:', response.status, err);
        }
    } catch (error) {
        if (__DEV__) {
            console.warn('recordNotificationOpened error:', error);
        }
    }
}

function addNotificationResponseListener(callback) {
    return Notifications.addNotificationResponseReceivedListener(callback);
}

function addNotificationReceivedListener(callback) {
    return Notifications.addNotificationReceivedListener(callback);
}

async function fetchUnreadCount() {
    try {
        const authToken = await getPersistedAuthToken();
        if (!authToken) return 0;

        const response = await fetch(`${getApiBaseUrl()}/notifications/unread-count`, {
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
        });
        const data = await response.json();
        if (!response.ok) return 0;
        return typeof data.unreadCount === 'number' ? data.unreadCount : 0;
    } catch {
        return 0;
    }
}

async function fetchNotifications({ cursor, limit = 50 } = {}) {
    try {
        const authToken = await getPersistedAuthToken();
        if (!authToken) {
            return { ok: false, error: 'Not signed in' };
        }

        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) params.set('cursor', cursor);

        const response = await fetch(`${getApiBaseUrl()}/notifications?${params}`, {
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
        });
        const data = await response.json();
        if (!response.ok) {
            return { ok: false, error: data.error || 'Failed to load notifications' };
        }

        return {
            ok: true,
            notifications: data.notifications || [],
            nextCursor: data.nextCursor || null,
        };
    } catch (error) {
        return { ok: false, error: error.message || 'Network error' };
    }
}

export default {
    registerForPushNotifications,
    registerTokenWithBackend,
    unregisterTokenFromBackend,
    recordNotificationOpened,
    addNotificationResponseListener,
    addNotificationReceivedListener,
    fetchUnreadCount,
    fetchNotifications,
};
