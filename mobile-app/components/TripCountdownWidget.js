import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useItineraries } from '../contexts/ItineraryContext';
import { findNextUpcomingTrip, calculateCountdown } from '../utils/countdownUtils';
import { colors, spacing, typography, borderRadius, shadows, iconSizes } from '../styles/designTokens';

const { width } = Dimensions.get('window');

const TripCountdownWidget = ({ onTripPress }) => {
  const { itineraries } = useItineraries();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for real-time countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Find the next upcoming trip with the closest match date
  const nextUpcomingTrip = useMemo(() => {
    return findNextUpcomingTrip(itineraries, currentTime);
  }, [itineraries, currentTime]);

  // Calculate countdown time
  const countdownData = useMemo(() => {
    if (!nextUpcomingTrip) {
      return null;
    }

    const countdown = calculateCountdown(nextUpcomingTrip.closestMatchDate, currentTime);
    
    return {
      ...countdown,
      trip: nextUpcomingTrip
    };
  }, [nextUpcomingTrip, currentTime]);

  // Don't render if no upcoming trips
  if (!countdownData) {
    return null;
  }

  // Don't render if trip has no matches (shouldn't happen with current logic, but safety check)
  if (!countdownData.trip.matches || countdownData.trip.matches.length === 0) {
    return null;
  }

  const { status, message, trip } = countdownData;
  const match = trip.closestMatch;

  const handlePress = () => {
    if (onTripPress) {
      onTripPress(trip);
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <MaterialIcons
              name={status === 'in-progress' ? 'flight-takeoff' : 'schedule'}
              size={iconSizes.sm}
              color={colors.primary}
            />
          </View>
          <Text style={styles.tripName} numberOfLines={1}>
            {trip.name}
          </Text>
        </View>

        <View style={styles.matchInfo}>
          <Text style={styles.matchText} numberOfLines={1}>
            {match.homeTeam?.name} vs {match.awayTeam?.name}
          </Text>
          <Text style={styles.leagueText} numberOfLines={1}>
            {match.league}
          </Text>
        </View>

        <View style={styles.countdownContainer}>
          <Text style={[
            styles.countdownText,
            status === 'in-progress' && styles.inProgressText
          ]}>
            {message}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.venueText} numberOfLines={1}>
            {match.venue}
          </Text>
          <MaterialIcons name="chevron-right" size={iconSizes.sm} color={colors.text.secondary} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    borderRadius: borderRadius.md,
    ...shadows.medium,
  },
  content: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.status.attendancePromptBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  tripName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  matchInfo: {
    marginBottom: spacing.sm,
  },
  matchText: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  leagueText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  countdownContainer: {
    marginBottom: spacing.sm,
  },
  countdownText: {
    ...typography.h3,
    color: colors.primary,
  },
  inProgressText: {
    color: colors.success,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  venueText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
    marginRight: spacing.sm,
  },
});

export default TripCountdownWidget;
