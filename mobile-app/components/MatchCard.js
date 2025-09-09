import React from 'react';
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
import { getMatchStatus, getMatchResult, formatMatchDate } from '../utils/matchStatus';
import { formatMatchTimeInVenueTimezone, getRelativeMatchTime } from '../utils/timezoneUtils';

const MatchCard = ({ 
  match, 
  onPress, 
  variant = 'default',
  showHeart = false,
  showResults = false, // Only show detailed results for saved matches
  showRelativeTime = false, // Only show relative time on itinerary pages
  style = {},
}) => {
  
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

  const handlePress = () => {
    if (onPress && match) {
      onPress(match);
    }
  };

  const isOverlay = variant === 'overlay' || variant === 'compact';

  return (
    <TouchableOpacity 
      style={[styles.card, isOverlay && styles.overlayCard, style]} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.dateTimeContainer}>
          <Icon name="access-time" size={16} color="#666" />
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
            <Text style={[styles.vsText, isOverlay && styles.overlayVsText]}>vs</Text>
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
        <Icon name="location-on" size={14} color="#666" />
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

      {/* Planning Status Indicator - only show for matches with planning data */}
      {match.planning && (
        <PlanningStatusIndicator 
          planning={match.planning} 
          size={variant === 'overlay' ? 'small' : 'default'}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overlayCard: {
    padding: 12,
    marginBottom: 0,
    shadowOpacity: 0.15,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateTimeText: {
    marginLeft: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  overlayDateText: {
    fontSize: 13,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  overlayTimeText: {
    fontSize: 11,
  },
  relativeTimeText: {
    fontSize: 10,
    color: '#999',
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
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
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
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusTextCompleted: {
    color: '#2e7d32',
  },
  statusTextLive: {
    color: '#f57c00',
  },
  leagueBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leagueText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  leagueLogoSmall: {
    width: 14,
    height: 14,
    marginRight: 6,
  },
  heartButton: {
    marginLeft: 4,
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  teamInfo: {
    alignItems: 'center',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
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
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 14,
    color: '#999',
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
    color: '#333',
    marginBottom: 4,
  },
  resultText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
  venueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  venueText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    flex: 1,
  },
});

export default MatchCard;
