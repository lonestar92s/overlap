import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Avatar, Card, Overlay } from 'react-native-elements';
import HeartButton from './HeartButton';
import ErrorBoundary from './ErrorBoundary';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';
import { formatMatchTimeInVenueTimezone } from '../utils/timezoneUtils';

const MatchModal = ({ visible, match, onClose, allMatches = [], onMatchChange }) => {
  const handleClose = () => {
    onClose();
  };

  if (!match) return null;

  const venue = match.fixture?.venue;
  
  // Format date/time in venue's local timezone with hybrid label
  const formattedTime = useMemo(() => {
    try {
      return formatMatchTimeInVenueTimezone(match.fixture.date, match.fixture, {
        showTimezone: false,
        showDate: false,
        timeFormat: '12hour'
      });
    } catch (error) {
      return 'TBD';
    }
  }, [match.fixture]);

  const formattedDate = useMemo(() => {
    try {
      const formatted = formatMatchTimeInVenueTimezone(match.fixture.date, match.fixture, {
        showTimezone: false,
        showDate: true,
        showYear: false,
        timeFormat: '12hour'
      });
      // Extract just the date part (before " at ")
      const parts = formatted.split(' at ');
      // Return short format: "Mar 15"
      const datePart = parts[0] || '';
      const shortDate = datePart.replace(/^[A-Za-z]+,\s*/, ''); // Remove day name
      return shortDate || 'TBD';
    } catch (error) {
      return 'TBD';
    }
  }, [match.fixture]);

  // Navigation logic
  const sortedMatches = [...allMatches].sort((a, b) => 
    new Date(a.fixture.date) - new Date(b.fixture.date)
  );
  
  const currentIndex = sortedMatches.findIndex(m => m.id === match.id);
  const totalMatches = sortedMatches.length;
  
  const handlePrevious = () => {
    if (currentIndex > 0) {
      const previousMatch = sortedMatches[currentIndex - 1];
      onMatchChange(previousMatch);
    } else if (totalMatches > 1) {
      // Loop to last match
      const lastMatch = sortedMatches[totalMatches - 1];
      onMatchChange(lastMatch);
    }
  };
  
  const handleNext = () => {
    if (currentIndex < totalMatches - 1) {
      const nextMatch = sortedMatches[currentIndex + 1];
      onMatchChange(nextMatch);
    } else if (totalMatches > 1) {
      // Loop to first match
      const firstMatch = sortedMatches[0];
      onMatchChange(firstMatch);
    }
  };
  
  const canNavigate = totalMatches > 1;

  return (
    <ErrorBoundary>
      <Overlay
        isVisible={visible}
        onBackdropPress={handleClose}
        overlayStyle={styles.overlayStyle}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
        {/* Handle bar */}
        <View style={styles.handleBar} />
        
        {/* Close button */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        {/* Navigation header */}
        {canNavigate && (
          <View style={styles.navigationHeader}>
            <TouchableOpacity 
              style={styles.navButton} 
              onPress={handlePrevious}
              activeOpacity={0.7}
            >
              <Text style={styles.navButtonText}>← Previous</Text>
            </TouchableOpacity>
            
            <Text style={styles.matchCounter}>
              Match {currentIndex + 1} of {totalMatches}
            </Text>
            
            <TouchableOpacity 
              style={styles.navButton} 
              onPress={handleNext}
              activeOpacity={0.7}
            >
              <Text style={styles.navButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Match content - Fixed size grey container */}
        <View style={styles.matchContentContainer}>
          {/* Stadium Image - Fits inside grey container */}
          <View style={styles.stadiumImageContainer}>
            {venue?.image ? (
              <Image 
                source={{ uri: venue.image }} 
                style={styles.stadiumImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.stadiumImagePlaceholder}>
                <Text style={styles.stadiumImagePlaceholderText}>🏟️</Text>
              </View>
            )}
          </View>

          {/* Match Details - Compact layout */}
          <View style={styles.matchDetailsContainer}>
            {/* Teams */}
            <View style={styles.teamsRow}>
              <View style={styles.teamPlaceholder}>
                <View style={styles.teamCircle}>
                  {match.teams.home.logo && (
                    <Image 
                      source={{ uri: match.teams.home.logo }} 
                      style={styles.teamLogo}
                      resizeMode="contain"
                    />
                  )}
                </View>
                <Text style={styles.teamLabel}>{match.teams.home.name}</Text>
              </View>
              
              <View style={styles.matchInfoCenter}>
                <View style={styles.timeDateButtons}>
                  <View style={styles.timeButton}>
                    <Text style={styles.timeButtonText}>
                      {formattedTime}
                    </Text>
                  </View>
                  <View style={styles.dateButton}>
                    <Text style={styles.dateButtonText}>
                      {formattedDate}
                    </Text>
                  </View>
                </View>
                <Text style={styles.placeholderText}>vs</Text>
                <Text style={styles.stadiumText}>{venue?.name || 'Stadium'}</Text>
              </View>
              
              <View style={styles.teamPlaceholder}>
                <View style={styles.teamCircle}>
                  {match.teams.away.logo && (
                    <Image 
                      source={{ uri: match.teams.away.logo }} 
                      style={styles.teamLogo}
                      resizeMode="contain"
                    />
                  )}
                </View>
                <Text style={styles.teamLabel}>{match.teams.away.name}</Text>
              </View>
            </View>

            {/* Heart Button */}
            <View style={styles.heartButtonContainer}>
              <HeartButton 
                matchId={match.id.toString()}
                fixtureId={match.fixture.id.toString()}
                matchData={{
                  id: match.id.toString(),
                  matchId: match.id.toString(),
                  homeTeam: match.teams.home,
                  awayTeam: match.teams.away,
                  league: match.league?.name,
                  venue: venue?.name,
                  date: match.fixture.date
                }}
                size={24}
                style={styles.modalHeartButton}
              />
            </View>
          </View>
        </View>
      </View>
      </Overlay>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  overlayStyle: {
    backgroundColor: 'transparent',
    padding: 0,
    margin: 0,
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
    minHeight: 400,
    marginBottom: spacing.lg,
    ...shadows.large,
  },
  handleBar: {
    width: 48,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.lg,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: 'bold',
  },
  navigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  navButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.cardGrey,
  },
  navButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },
  matchCounter: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  matchContentContainer: {
    backgroundColor: colors.cardGrey, // Grey container from wireframe
    borderRadius: borderRadius.md,
    margin: spacing.lg,
    overflow: 'hidden',
    height: 280, // Fixed height to match wireframe
    ...shadows.small,
  },
  stadiumImageContainer: {
    height: 180, // Stadium image takes up most of the container
    width: '100%',
    overflow: 'hidden',
  },
  stadiumImage: {
    width: '100%',
    height: '100%',
  },
  stadiumImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stadiumImagePlaceholderText: {
    fontSize: 48,
  },
  matchDetailsContainer: {
    padding: spacing.md,
    flex: 1,
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamPlaceholder: {
    alignItems: 'center',
  },
  teamCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  teamLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  teamLabel: {
    ...typography.caption,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  matchInfoCenter: {
    alignItems: 'center',
    flex: 1,
  },
  timeDateButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  timeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  timeButtonText: {
    color: colors.card,
    ...typography.caption,
    fontWeight: '600',
  },
  dateButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  dateButtonText: {
    color: colors.card,
    ...typography.caption,
    fontWeight: '600',
  },
  placeholderText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  stadiumText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text.primary,
  },
  heartButtonContainer: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  modalHeartButton: {
    backgroundColor: 'transparent',
  },
});

export default MatchModal; 
 