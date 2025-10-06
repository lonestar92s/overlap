import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useItineraries } from '../contexts/ItineraryContext';
import { findNextUpcomingTrip, calculateCountdown } from '../utils/countdownUtils';

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
              size={20} 
              color="#1976d2" 
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
          <MaterialIcons name="chevron-right" size={20} color="#666" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  matchInfo: {
    marginBottom: 8,
  },
  matchText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  leagueText: {
    fontSize: 12,
    color: '#666',
  },
  countdownContainer: {
    marginBottom: 8,
  },
  countdownText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  inProgressText: {
    color: '#4CAF50',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  venueText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
    marginRight: 8,
  },
});

export default TripCountdownWidget;
