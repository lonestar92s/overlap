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

const MatchCard = ({ 
  match, 
  onPress, 
  variant = 'default',
  showHeart = false,
  style = {},
}) => {
  // // Debug logging to help troubleshoot data structure issues
  // console.log('MatchCard received match data:', {
  //   matchId: match?.id,
  //   fixtureId: match?.fixture?.id,
  //   teams: match?.teams,
  //   league: match?.league || match?.competition,
  //   venue: match?.fixture?.venue,
  //   rawMatch: match
  // });
  
  // // Additional logging to identify object rendering issues
  // if (match?.league && typeof match.league === 'object') {
  //   console.log('⚠️ League is an object:', match.league);
  // }
  // if (match?.teams?.home && typeof match.teams.home === 'object') {
  //   console.log('⚠️ Home team is an object:', match.teams.home);
  // }
  // if (match?.teams?.away && typeof match.teams.away === 'object') {
  //   console.log('⚠️ Away team is an object:', match.teams.away);
  // }

  // Extract data from the API response format with defensive programming
  const fixture = match?.fixture || {};
  const teams = match?.teams || { home: {}, away: {} };
  const league = match?.league || match?.competition || {};
  const venue = fixture?.venue || { name: 'Unknown Venue', city: 'Unknown City' };
  
  // Ensure we have a valid match ID for the heart functionality
  const matchId = match?.id || match?.fixture?.id || 'unknown';
  
  const formatMatchDateTime = (dateString) => {
    if (!dateString) return { date: 'TBD', time: 'TBD' };
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return { date: 'TBD', time: 'TBD' };
      
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
      
      let dateText = '';
      if (isToday) {
        dateText = 'Today';
      } else if (isTomorrow) {
        dateText = 'Tomorrow';
      } else {
        dateText = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      }
      
      const timeText = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      return { date: dateText, time: timeText };
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return { date: 'TBD', time: 'TBD' };
    }
  };

  const { date, time } = formatMatchDateTime(fixture.date);

  const handlePress = () => {
    if (onPress && match) {
      onPress(match);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.card, style]} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.dateTimeContainer}>
          <Icon name="access-time" size={16} color="#666" />
          <View style={styles.dateTimeText}>
            <Text style={styles.dateText}>{date || 'TBD'}</Text>
            <Text style={styles.timeText}>{time || 'TBD'}</Text>
          </View>
        </View>
        
        <View style={styles.headerRight}>
          {(league?.name || (typeof league === 'string' && league)) && (
            <View style={styles.leagueBadge}>
              <Text style={styles.leagueText}>
                {typeof league === 'string' ? league : league.name}
              </Text>
            </View>
          )}
          
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
            <Text style={styles.teamName} numberOfLines={1}>
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
          <Text style={styles.vsText}>vs</Text>
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
  timeText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leagueBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  leagueText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
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
