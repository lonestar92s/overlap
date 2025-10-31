import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import HeartButton from './HeartButton';
import PlanningStatusIndicator from './PlanningStatusIndicator';
import ErrorBoundary from './ErrorBoundary';
import AttendanceModal from './AttendanceModal';
import { getMatchStatus, getMatchResult, formatMatchDate, isMatchPast } from '../utils/matchStatus';
import { formatMatchTimeInVenueTimezone, getRelativeMatchTime } from '../utils/timezoneUtils';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const MatchCard = ({ 
  match, 
  onPress, 
  variant = 'default',
  showHeart = false,
  showResults = false, // Only show detailed results for saved matches
  showRelativeTime = false, // Only show relative time on itinerary pages
  showAttendancePrompt = false, // Show attendance prompt for past matches
  style = {},
}) => {
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  
  // Extract data from the API response format with defensive programming
  const fixture = match?.fixture || {};
  const teams = match?.teams || { home: {}, away: {} };
  const league = match?.league || match?.competition || {};
  const venue = fixture?.venue || { name: 'Unknown Venue', city: null };
  
  // Ensure we have a valid match ID for the heart functionality
  const matchId = match?.id || match?.fixture?.id || 'unknown';
  
  const formatMatchDateTime = (dateString, fixture) => {
    if (!dateString) return { date: 'TBD', time: 'TBD' };
    
    try {
      // Use venue timezone for date/time display
      const formattedTime = formatMatchTimeInVenueTimezone(dateString, fixture, {
        showTimezone: true,
        showDate: true,
        showYear: true,  // Show year by default
        timeFormat: '12hour'
      });
      
      // Extract date and time parts
      const parts = formattedTime.split(' at ');
      if (parts.length === 2) {
        return { date: parts[0], time: parts[1] };
      } else {
        // Fallback if format doesn't match expected pattern
        return { date: 'TBD', time: formattedTime };
      }
    } catch (error) {
      console.warn('Error formatting date with timezone:', dateString, error);
      return { date: 'TBD', time: 'TBD' };
    }
  };

  const { date, time } = formatMatchDateTime(fixture.date, fixture);

  // Get relative time for better UX
  const relativeTime = getRelativeMatchTime(fixture.date, fixture);

  // Get match status and result
  const matchStatus = getMatchStatus(match);
  const matchResult = getMatchResult(match);
  const formattedDate = formatMatchDate(fixture.date, matchStatus.isPast);
  
  // Temporary debug to see what data we have
  if (match?.id === '1451061' || match?.fixture?.id === '1451061') {
    console.log('🔍 Arsenal match debug:', {
      match,
      status: match?.status,
      fixtureStatus: fixture?.status,
      matchStatus,
      isLive: matchStatus.type === 'live'
    });
  }
  

  // Check if match is completed and should show attendance prompt
  const isPast = isMatchPast(fixture.date);
  const isCompleted = matchStatus.type === 'completed';
  const shouldShowAttendancePrompt = showAttendancePrompt && isPast && isCompleted && !match.userAttended;

  const handlePress = () => {
    if (shouldShowAttendancePrompt) {
      setShowAttendanceModal(true);
    } else if (onPress && match) {
      onPress(match);
    }
  };

  const handleAttendanceConfirmed = () => {
    // Update the match to show it was attended
    if (match) {
      match.userAttended = true;
    }
    setShowAttendanceModal(false);
  };

  const isOverlay = variant === 'overlay' || variant === 'compact';

  return (
    <ErrorBoundary>
      <TouchableOpacity 
        style={[styles.card, isOverlay && styles.overlayCard, style]} 
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityLabel={`Match: ${teams.home?.name || 'Home Team'} vs ${teams.away?.name || 'Away Team'}`}
        accessibilityRole="button"
      >
      <View style={styles.header}>
        <View style={styles.dateTimeContainer}>
          <Icon name="access-time" size={16} color={colors.text.secondary} />
          <View style={styles.dateTimeText}>
            <Text style={[styles.dateText, isOverlay && styles.overlayDateText]}>{date || 'TBD'}</Text>
            <Text style={[styles.timeText, isOverlay && styles.overlayTimeText]}>{time || 'TBD'}</Text>
            {showRelativeTime && relativeTime && (
              <Text style={[styles.relativeTimeText, isOverlay && styles.overlayRelativeTimeText]}>
                {relativeTime}
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.headerRight}>
          {/* Match Status Badge - Only show for non-upcoming matches */}
          {(matchStatus.type !== 'upcoming') && (
            <View style={[
              styles.statusBadge,
              matchStatus.type === 'completed' && styles.statusCompleted,
              matchStatus.type === 'live' && styles.statusLive
            ]}>
              <Text style={[
                styles.statusText,
                matchStatus.type === 'completed' && styles.statusTextCompleted,
                matchStatus.type === 'live' && styles.statusTextLive
              ]}>
                {matchStatus.text}
              </Text>
            </View>
          )}

          {/* League Badge */}
          {(() => {
            const shouldShowBadge = !!(league?.name || (typeof league === 'string' && league));
            
            if (shouldShowBadge) {
              return (
                <View style={styles.leagueBadge}>
                  {typeof league !== 'string' && (league?.logo || league?.emblem) ? (
                    <Image 
                      source={{ uri: league.logo || league.emblem }} 
                      style={styles.leagueLogoSmall} 
                      resizeMode="contain" 
                    />
                  ) : null}
                  <Text style={styles.leagueText}>
                    {typeof league === 'string' ? league : league.name}
                  </Text>
                </View>
              );
            }
            return null;
          })()}
          
          {showHeart && matchId !== 'unknown' && (
            <HeartButton
              matchId={matchId}
              fixtureId={fixture?.id || matchId}
              matchData={match}
              size={20}
              style={styles.heartButton}
            />
          )}
        </View>
      </View>

      <View style={styles.teamsContainer}>
        <View style={styles.teamContainer}>
          <View style={styles.teamInfo}>
            <Text style={[styles.teamName, isOverlay && styles.overlayTeamName]} numberOfLines={1}>
              {(() => {
                const homeTeam = teams.home;
                if (typeof homeTeam === 'string') {
                  return homeTeam;
                } else if (homeTeam?.name) {
                  return homeTeam.name;
                }
                return 'TBD';
              })()}
            </Text>
            {(() => {
              const homeTeam = teams.home;
              if (homeTeam?.logo && typeof homeTeam.logo === 'string' && homeTeam.logo.trim() !== '') {
                return (
                  <Image 
                    source={{ uri: homeTeam.logo }} 
                    style={styles.teamLogo}
                    resizeMode="contain"
                  />
                );
              }
              return null;
            })()}
          </View>
        </View>

        <View style={styles.vsContainer}>
          {showResults && matchResult ? (
            <View style={styles.resultContainer}>
              <Text style={styles.resultScore}>
                {matchResult.homeScore} - {matchResult.awayScore}
              </Text>
              <Text style={styles.resultText}>
                {matchResult.result}
              </Text>
            </View>
          ) : (
            <View style={styles.vsContent}>
              <Text style={[styles.vsText, isOverlay && styles.overlayVsText]}>vs</Text>
            {/* Show match in progress indicator */}
            {matchStatus.type === 'live' && (
              <View style={styles.liveIndicator}>
                <Icon name="radio-button-on" size={16} color={colors.error} />
                <Text style={styles.liveText}>Match in Progress</Text>
              </View>
            )}
            {/* Show attendance prompt indicator for completed matches */}
            {shouldShowAttendancePrompt && (
              <View style={styles.attendancePrompt}>
                <Icon name="check-circle" size={16} color={colors.primary} />
                <Text style={styles.attendancePromptText}>Tap to confirm attendance</Text>
              </View>
            )}
            {/* Show attended indicator */}
            {match.userAttended && (
              <View style={styles.attendedIndicator}>
                <Icon name="check-circle" size={16} color={colors.success} />
                <Text style={styles.attendedText}>Attended</Text>
              </View>
            )}
            </View>
          )}
        </View>

        <View style={styles.teamContainer}>
          <View style={styles.teamInfo}>
            <Text style={styles.teamName} numberOfLines={1}>
              {(() => {
                const awayTeam = teams.away;
                if (typeof awayTeam === 'string') {
                  return awayTeam;
                } else if (awayTeam?.name) {
                  return awayTeam.name;
                }
                return 'TBD';
              })()}
            </Text>
            {(() => {
              const awayTeam = teams.away;
              if (awayTeam?.logo && typeof awayTeam.logo === 'string' && awayTeam.logo.trim() !== '') {
                return (
                  <Image 
                    source={{ uri: awayTeam.logo }} 
                    style={styles.teamLogo}
                    resizeMode="contain"
                  />
                );
              }
              return null;
            })()}
          </View>
        </View>
      </View>

      <View style={styles.venueContainer}>
        <Icon name="location-on" size={14} color={colors.text.secondary} />
        <Text style={styles.venueText} numberOfLines={1}>
          {(() => {
            if (typeof venue === 'string') {
              return venue;
            } else if (venue?.name && venue?.city) {
              return `${venue.name} • ${venue.city}`;
            } else if (venue?.name) {
              return venue.name;
            } else if (venue?.city) {
              return venue.city;
            }
            return 'Unknown Venue';
          })()}
        </Text>
      </View>

      {/* Recommendation reasons - only show for recommended matches */}
      {match.recommendationReasons && match.recommendationReasons.length > 0 && (
        <View style={styles.recommendationContainer}>
          <Icon name="star" size={14} color={colors.warning} />
          <Text style={styles.recommendationText} numberOfLines={2}>
            {match.recommendationReasons.slice(0, 2).join(' • ')}
          </Text>
        </View>
      )}

      {/* Planning Status Indicator - only show for matches with planning data */}
      {match.planning && (
        <PlanningStatusIndicator 
          planning={match.planning} 
          size={variant === 'overlay' ? 'small' : 'default'}
        />
      )}

      {/* Attendance Modal */}
      <AttendanceModal
        visible={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
        match={match}
        onAttendanceConfirmed={handleAttendanceConfirmed}
      />
      </TouchableOpacity>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  overlayCard: {
    padding: spacing.sm,
    marginBottom: 0,
    shadowOpacity: 0.15,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateTimeText: {
    marginLeft: spacing.sm,
  },
  dateText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text.primary,
  },
  overlayDateText: {
    fontSize: 13,
  },
  timeText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  overlayTimeText: {
    fontSize: 11,
  },
  relativeTimeText: {
    fontSize: 10,
    color: colors.text.light,
    marginTop: 2,
    fontStyle: 'italic',
  },
  overlayRelativeTimeText: {
    fontSize: 9,
    fontStyle: 'italic',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.xs,
    minWidth: 70,
    alignItems: 'center',
  },
  statusCompleted: {
    backgroundColor: '#e8f5e8',
  },
  statusLive: {
    backgroundColor: '#fff3cd',
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusTextCompleted: {
    color: colors.success,
  },
  statusTextLive: {
    color: colors.warning,
  },
  leagueBadge: {
    backgroundColor: colors.cardGrey,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leagueText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  leagueLogoSmall: {
    width: 14,
    height: 14,
    marginRight: 6,
  },
  heartButton: {
    marginLeft: spacing.xs,
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  teamInfo: {
    alignItems: 'center',
  },
  teamName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    maxWidth: '100%',
  },
  overlayTeamName: {
    fontSize: 15,
  },
  teamLogo: {
    width: 32,
    height: 32,
  },
  vsContainer: {
    paddingHorizontal: spacing.md,
  },
  vsText: {
    ...typography.bodySmall,
    color: colors.text.light,
    fontWeight: '500',
  },
  overlayVsText: {
    fontSize: 13,
  },
  resultContainer: {
    alignItems: 'center',
    minWidth: 80,
  },
  resultScore: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  resultText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  venueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  venueText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginLeft: 6,
    flex: 1,
  },
  recommendationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: '#fff8e1',
    borderRadius: borderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  recommendationText: {
    ...typography.caption,
    color: colors.warning,
    marginLeft: 6,
    flex: 1,
    fontWeight: '500',
  },
  vsContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendancePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#e3f2fd',
    borderRadius: borderRadius.md,
  },
  attendancePromptText: {
    fontSize: 10,
    color: colors.primary,
    marginLeft: spacing.xs,
    fontWeight: '500',
  },
  attendedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#e8f5e8',
    borderRadius: borderRadius.md,
  },
  attendedText: {
    fontSize: 10,
    color: colors.success,
    marginLeft: spacing.xs,
    fontWeight: '500',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#fff3e0',
    borderRadius: borderRadius.md,
  },
  liveText: {
    fontSize: 10,
    color: colors.error,
    marginLeft: spacing.xs,
    fontWeight: '500',
  },
});

export default MatchCard;
