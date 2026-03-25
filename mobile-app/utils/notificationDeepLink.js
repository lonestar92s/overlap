import { InteractionManager, Alert } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import NotificationService from '../services/notifications';
import apiService from '../services/api';

/**
 * Record open + navigate for notification payload (push tap or in-app list).
 * Uses CommonActions so it works from nested navigators and root ref.
 */
export async function executeNotificationPayload(data, navigation, options = {}) {
    const { skipRecordOpened = false } = options;

    if (!data || typeof data !== 'object') {
        return { handled: false };
    }

    if (!skipRecordOpened && data.notificationLogId != null && data.notificationLogId !== '') {
        await NotificationService.recordNotificationOpened(String(data.notificationLogId));
    }

    if (data.type === 'trip_ticket_status_prompt') {
        const tripId = data.tripId;
        if (!tripId) {
            Alert.alert(
                'Unavailable',
                "We couldn't open that trip. It may have been removed or the link is out of date."
            );
            return { handled: true, reason: 'missing_trip' };
        }

        const result = await apiService.getTripById(String(tripId));
        if (!result.success || result.status === 404) {
            Alert.alert('Trip unavailable', 'This trip no longer exists.');
            navigation.dispatch(
                CommonActions.navigate({
                    name: 'TripsTab',
                    params: { screen: 'TripsList' }
                })
            );
            return { handled: true, reason: 'trip_missing' };
        }

        const trip = result.data;
        const matchIds = data.matchIds;
        if (Array.isArray(matchIds) && matchIds.length > 0 && trip.matches?.length) {
            const idsOnTrip = new Set(trip.matches.map((m) => m.matchId).filter(Boolean));
            const anyMissing = matchIds.some((id) => id && !idsOnTrip.has(id));
            if (anyMissing) {
                Alert.alert('Match updated', 'This match is no longer on your trip.');
            }
        }

        const itineraryId = String(tripId);
        InteractionManager.runAfterInteractions(() => {
            navigation.dispatch(
                CommonActions.navigate({
                    name: 'TripsTab',
                    params: {
                        screen: 'TripOverview',
                        params: { itineraryId }
                    }
                })
            );
        });
        return { handled: true };
    }

    return { handled: false };
}
