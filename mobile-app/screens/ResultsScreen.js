import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Card, Avatar, Divider, Button, ButtonGroup } from 'react-native-elements';
import ApiService from '../services/api';
import { formatMatchTimeInVenueTimezone, getTimezoneLabel, getVenueTimezone } from '../utils/timezoneUtils';

const ResultsScreen = ({ route, navigation }) => {
  const { matches: initialMatches = [], searchParams = {} } = route.params || {};
  const [allMatches, setAllMatches] = useState(initialMatches); // Keep all matches
  const [matches, setMatches] = useState(initialMatches);
  const [loading, setLoading] = useState(false);
  const [showDistanceFilter, setShowDistanceFilter] = useState(false);
  const [selectedDistance, setSelectedDistance] = useState(() => {
    // Find the index of the current distance in our options
    const distanceOptions = [50, 100, 250];
    const currentDistance = searchParams.maxDistance || 100;
    return distanceOptions.indexOf(currentDistance) !== -1 ? distanceOptions.indexOf(currentDistance) : 1;
  });

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLeagues, setSelectedLeagues] = useState([]);
  const [selectedClubs, setSelectedClubs] = useState([]);

  // Distance options
  const distanceOptions = [
    { label: '50 mi', value: 50 },
    { label: '100 mi', value: 100 },
    { label: '250 mi', value: 250 }
  ];

  // Get available leagues and clubs from current matches
  const { availableLeagues, availableClubs } = useMemo(() => {
    const leagues = new Map();
    const clubs = new Map();
    
    allMatches.forEach(match => {
      const league = match.competition || match.league;
      const homeTeam = match.teams?.home;
      const awayTeam = match.teams?.away;
      
      if (league) {
        // Add league
        if (!leagues.has(league.id)) {
          leagues.set(league.id, {
            id: league.id,
            name: league.name,
            logo: league.logo,
            matchCount: 0
          });
        }
        leagues.get(league.id).matchCount++;
        
        // Add clubs for this league
        [homeTeam, awayTeam].forEach(team => {
          if (team) {
            const clubKey = `${team.id}-${league.id}`;
            if (!clubs.has(clubKey)) {
              clubs.set(clubKey, {
                id: team.id,
                name: team.name,
                logo: team.logo,
                leagueId: league.id,
                leagueName: league.name,
                matchCount: 0
              });
            }
            clubs.get(clubKey).matchCount++;
          }
        });
      }
    });

    return {
      availableLeagues: Array.from(leagues.values()).sort((a, b) => a.name.localeCompare(b.name)),
      availableClubs: Array.from(clubs.values()).sort((a, b) => a.name.localeCompare(b.name))
    };
  }, [allMatches]);

  // Get clubs for selected leagues
  const clubsForSelectedLeagues = useMemo(() => {
    if (selectedLeagues.length === 0) return [];
    return availableClubs.filter(club => selectedLeagues.includes(club.leagueId));
  }, [availableClubs, selectedLeagues]);

  // Apply filters to matches
  const filteredMatches = useMemo(() => {
    let filtered = allMatches;

    // Filter by selected clubs (if any clubs are selected)
    if (selectedClubs.length > 0) {
      filtered = filtered.filter(match => {
        const homeTeamId = match.teams?.home?.id;
        const awayTeamId = match.teams?.away?.id;
        return selectedClubs.includes(homeTeamId) || selectedClubs.includes(awayTeamId);
      });
    }
    // If no clubs selected but leagues are selected, show all matches from selected leagues
    else if (selectedLeagues.length > 0) {
      filtered = filtered.filter(match => {
        const leagueId = match.competition?.id || match.league?.id;
        // Convert both to strings for comparison to handle data type mismatches
        return selectedLeagues.includes(String(leagueId));
      });
    }

    return filtered;
  }, [allMatches, selectedLeagues, selectedClubs]);

  // Update matches when filters change
  React.useEffect(() => {
    setMatches(filteredMatches);
  }, [filteredMatches]);

  // Update filters when allMatches changes (distance filter)
  React.useEffect(() => {
    // Remove selected leagues that no longer exist
    const currentLeagueIds = availableLeagues.map(l => l.id);
    setSelectedLeagues(prev => prev.filter(id => currentLeagueIds.includes(id)));
    
    // Remove selected clubs that no longer exist
    const currentClubIds = availableClubs.map(c => c.id);
    setSelectedClubs(prev => prev.filter(id => currentClubIds.includes(id)));
  }, [availableLeagues, availableClubs]);

  const handleDistanceChange = async (newDistanceIndex) => {
    if (newDistanceIndex === selectedDistance) {
      setShowDistanceFilter(false);
      return;
    }

    setSelectedDistance(newDistanceIndex);
    setLoading(true);

    try {
      const newSearchParams = {
        ...searchParams,
        maxDistance: distanceOptions[newDistanceIndex].value
      };

      const response = await ApiService.searchAllMatchesByLocation(newSearchParams);
      
      if (response.success) {
        setAllMatches(response.data); // This will trigger filter updates
        setShowDistanceFilter(false);
        
        // Update the route params for consistency
        navigation.setParams({
          matches: response.data,
          searchParams: newSearchParams
        });
      } else {
        Alert.alert('Error', response.error || 'Failed to search with new distance');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to search matches');
    } finally {
      setLoading(false);
    }
  };

  const handleLeagueToggle = (leagueId) => {
    setSelectedLeagues(prev => {
      const newSelected = prev.includes(leagueId) 
        ? prev.filter(id => id !== leagueId)
        : [...prev, leagueId];
      
      // Clear club selections when league selection changes
      if (!prev.includes(leagueId)) {
        // League was added - no need to clear clubs
      } else {
        // League was removed - clear clubs from that league
        setSelectedClubs(prevClubs => 
          prevClubs.filter(clubId => {
            const club = availableClubs.find(c => c.id === clubId);
            return club && club.leagueId !== leagueId;
          })
        );
      }
      
      return newSelected;
    });
  };

  const handleClubToggle = (clubId) => {
    setSelectedClubs(prev => 
      prev.includes(clubId) 
        ? prev.filter(id => id !== clubId)
        : [...prev, clubId]
    );
  };

  const clearFilters = () => {
    setSelectedLeagues([]);
    setSelectedClubs([]);
  };

  const hasActiveFilters = selectedLeagues.length > 0 || selectedClubs.length > 0;

  // Format date in venue local timezone
  const formatDate = (dateString, fixture) => {
    try {
      const formatted = formatMatchTimeInVenueTimezone(dateString, fixture, {
        showTimezone: false,
        showDate: true,
        showYear: true,
        timeFormat: '12hour'
      });
      // Extract just the date part (before " at ")
      const parts = formatted.split(' at ');
      return parts[0] || 'Date TBD';
    } catch (error) {
      return 'Date TBD';
    }
  };

  // Format time in venue local timezone with hybrid label
  const formatTime = (dateString, fixture) => {
    try {
      const formatted = formatMatchTimeInVenueTimezone(dateString, fixture, {
        showTimezone: true,
        showDate: false,
        timeFormat: '12hour'
      });
      return formatted || 'Time TBD';
    } catch (error) {
      return 'Time TBD';
    }
  };

  const getMatchStatus = (status) => {
    switch (status.short) {
      case 'NS':
        return { text: 'Upcoming', color: '#2196F3' };
      case 'LIVE':
        return { text: 'Live Now', color: '#4CAF50' };
      case 'FT':
        return { text: 'Finished', color: '#757575' };
      case 'HT':
        return { text: 'Half Time', color: '#FF9800' };
      case 'PST':
        return { text: 'Postponed', color: '#F44336' };
      case 'CANC':
        return { text: 'Cancelled', color: '#F44336' };
      default:
        return { text: status.long || 'Unknown', color: '#757575' };
    }
  };

  const handlePlanTrip = (match) => {
    // TODO: Navigate to trip planning screen
  };

  const renderMatchItem = ({ item }) => {
    const statusInfo = getMatchStatus(item.fixture.status);
    // Format date/time in venue's local timezone
    const matchDate = formatDate(item.fixture.date, item.fixture);
    const matchTime = formatTime(item.fixture.date, item.fixture);
    const isUpcoming = item.fixture.status.short === 'NS';

    return (
      <Card containerStyle={styles.matchCard}>
        <View style={styles.matchHeader}>
          <View style={styles.dateTimeContainer}>
            <Text style={styles.dateText}>{matchDate}</Text>
            <Text style={styles.timeText}>{matchTime}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
            <Text style={styles.statusText}>{statusInfo.text}</Text>
          </View>
        </View>

        <View style={styles.teamsContainer}>
          <View style={styles.teamRow}>
            <Avatar
              source={{ uri: item.teams.home.logo }}
              size={35}
              rounded
              containerStyle={styles.teamLogo}
            />
            <Text style={styles.teamName}>{item.teams.home.name}</Text>
          </View>

          <View style={styles.vsContainer}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          <View style={styles.teamRow}>
            <Avatar
              source={{ uri: item.teams.away.logo }}
              size={35}
              rounded
              containerStyle={styles.teamLogo}
            />
            <Text style={styles.teamName}>{item.teams.away.name}</Text>
          </View>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.venueContainer}>
          <View style={styles.venueHeader}>
            <Text style={styles.venueTitle}>📍 Venue</Text>
            {item.fixture.venue.distance !== null && item.fixture.venue.distance !== undefined && (
              <Text style={styles.distanceText}>
                {Math.round(item.fixture.venue.distance)} mi
              </Text>
            )}
          </View>
          <Text style={styles.venueName}>{item.fixture.venue.name}</Text>
          <Text style={styles.venueLocation}>
            {item.fixture.venue.city}, {item.fixture.venue.country}
          </Text>
        </View>

        <View style={styles.leagueContainer}>
          <Avatar
            source={{ uri: item.league.logo }}
            size={20}
            rounded
            containerStyle={styles.leagueLogo}
          />
          <Text style={styles.leagueName}>{item.league.name}</Text>
        </View>

        {isUpcoming && (
          <View style={styles.actionContainer}>
            <Button
              title="Plan Trip"
              onPress={() => handlePlanTrip(item)}
              buttonStyle={styles.planButton}
              titleStyle={styles.planButtonText}
              icon={{
                name: 'flight',
                type: 'material',
                size: 18,
                color: 'white',
              }}
            />
          </View>
        )}
      </Card>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>Available Matches</Text>
      <Text style={styles.headerSubtitle}>
        {matches.length} matches found within {distanceOptions[selectedDistance].label}
        {hasActiveFilters && ` (filtered from ${allMatches.length})`}
      </Text>
      {searchParams.location && (
        <Text style={styles.searchInfo}>
          📍 {searchParams.location.city}, {searchParams.location.country}
        </Text>
      )}
      <Text style={styles.searchInfo}>
        📅 {searchParams.dateFrom} to {searchParams.dateTo}
      </Text>
      
      <View style={styles.filterButtonsContainer}>
        <TouchableOpacity 
          style={styles.distanceFilterButton}
          onPress={() => setShowDistanceFilter(!showDistanceFilter)}
          disabled={loading}
        >
          <Text style={styles.distanceFilterButtonText}>
            📏 Distance ({distanceOptions[selectedDistance].label})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filtersButton, hasActiveFilters && styles.filtersButtonActive]}
          onPress={() => setShowFilters(!showFilters)}
          disabled={loading}
        >
          <Text style={[styles.filtersButtonText, hasActiveFilters && styles.filtersButtonTextActive]}>
            🔍 Filters {hasActiveFilters && '●'}
          </Text>
        </TouchableOpacity>
      </View>

      {showDistanceFilter && (
        <View style={styles.distanceFilterContainer}>
          <ButtonGroup
            onPress={handleDistanceChange}
            selectedIndex={selectedDistance}
            buttons={distanceOptions.map(option => option.label)}
            containerStyle={styles.headerDistanceButtonGroup}
            selectedButtonStyle={styles.headerSelectedDistanceButton}
            textStyle={styles.headerDistanceButtonText}
            selectedTextStyle={styles.headerSelectedDistanceButtonText}
            disabled={loading}
          />
        </View>
      )}

              {showFilters && (
          <View style={styles.filtersContainer}>
            <Text style={styles.filterSectionTitle}>Leagues ({availableLeagues.length})</Text>
            <ScrollView style={styles.leagueFiltersContainer} showsVerticalScrollIndicator={false}>
              {availableLeagues.map(league => (
                <TouchableOpacity
                  key={league.id}
                  style={styles.leagueFilterItem}
                  onPress={() => handleLeagueToggle(league.id)}
                >
                  <View style={styles.leagueFilterContent}>
                    <Avatar
                      source={{ uri: league.logo }}
                      size={20}
                      rounded
                      containerStyle={styles.leagueFilterLogo}
                    />
                    <Text style={styles.leagueFilterName}>{league.name}</Text>
                    <Text style={styles.leagueFilterCount}>({league.matchCount})</Text>
                  </View>
                  <View style={[
                    styles.leagueFilterCheckbox,
                    selectedLeagues.includes(league.id) && styles.leagueFilterCheckboxSelected
                  ]}>
                    {selectedLeagues.includes(league.id) && (
                      <Text style={styles.leagueFilterCheckmark}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedLeagues.length > 0 && (
              <View style={styles.clubFiltersContainer}>
                <Text style={styles.filterSectionTitle}>
                  Clubs from Selected Leagues ({clubsForSelectedLeagues.length})
                </Text>
                <ScrollView style={styles.clubScrollContainer} showsVerticalScrollIndicator={false}>
                  {clubsForSelectedLeagues.map(club => (
                    <TouchableOpacity
                      key={`${club.id}-${club.leagueId}`}
                      style={styles.clubFilterItem}
                      onPress={() => handleClubToggle(club.id)}
                    >
                      <View style={styles.clubFilterContent}>
                        <Avatar
                          source={{ uri: club.logo }}
                          size={18}
                          rounded
                          containerStyle={styles.clubFilterLogo}
                        />
                        <Text style={styles.clubFilterName}>{club.name}</Text>
                        <Text style={styles.clubFilterLeague}>({club.leagueName})</Text>
                        <Text style={styles.clubFilterCount}>{club.matchCount}</Text>
                      </View>
                      <View style={[
                        styles.clubFilterCheckbox,
                        selectedClubs.includes(club.id) && styles.clubFilterCheckboxSelected
                      ]}>
                        {selectedClubs.includes(club.id) && (
                          <Text style={styles.clubFilterCheckmark}>✓</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {hasActiveFilters && (
              <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                <Text style={styles.clearFiltersButtonText}>Clear All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

      {loading && (
        <Text style={styles.loadingText}>Searching...</Text>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No matches found</Text>
      <Text style={styles.emptySubtitle}>
        Try adjusting your search criteria or date range to find matches for your trip.
      </Text>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>Search Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLoadingOverlay = () => (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingOverlayText}>
          Searching matches within {distanceOptions[selectedDistance].label}...
        </Text>
      </View>
    </View>
  );

  if (matches.length === 0) {
    return renderEmptyState();
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={matches}
        renderItem={renderMatchItem}
        keyExtractor={(item) => item.fixture.id.toString()}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!loading}
      />
      {loading && renderLoadingOverlay()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    paddingBottom: 20,
  },
  headerContainer: {
    backgroundColor: '#1976d2',
    padding: 20,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    marginTop: 5,
  },
  searchInfo: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 2,
  },
  filterButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  distanceFilterButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 5,
  },
  distanceFilterButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  filtersButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 5,
  },
  filtersButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  filtersButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  filtersButtonTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  distanceFilterContainer: {
    marginTop: 10,
  },
  headerDistanceButtonGroup: {
    borderRadius: 8,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerDistanceButtonText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerSelectedDistanceButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerSelectedDistanceButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  loadingOverlayText: {
    marginTop: 15,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  matchCard: {
    margin: 10,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  dateTimeContainer: {
    flex: 1,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  teamsContainer: {
    marginBottom: 15,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  teamLogo: {
    marginRight: 12,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  vsContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  vsText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  divider: {
    marginVertical: 10,
  },
  venueContainer: {
    marginBottom: 15,
  },
  venueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  venueTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  venueName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  venueLocation: {
    fontSize: 15,
    color: '#666',
  },
  leagueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  leagueLogo: {
    marginRight: 8,
  },
  leagueName: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  actionContainer: {
    marginTop: 10,
  },
  planButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
  },
  planButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  backButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  filtersContainer: {
    marginTop: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
  },
  leagueFiltersContainer: {
    maxHeight: 200,
    marginBottom: 15,
  },
  leagueFilterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 5,
    marginBottom: 5,
  },
  leagueFilterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  leagueFilterLogo: {
    marginRight: 10,
  },
  leagueFilterName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  leagueFilterCount: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginLeft: 5,
  },
  leagueFilterCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leagueFilterCheckboxSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderColor: 'white',
  },
  leagueFilterCheckmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  clearFiltersButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignSelf: 'center',
  },
  clearFiltersButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  filterSectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  clubFiltersContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  clubScrollContainer: {
    maxHeight: 150,
    marginBottom: 10,
  },
  clubFilterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginLeft: 15,
    borderRadius: 5,
    marginBottom: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  clubFilterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clubFilterLogo: {
    marginRight: 8,
  },
  clubFilterName: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  clubFilterLeague: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    marginLeft: 5,
    fontStyle: 'italic',
  },
  clubFilterCount: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    marginLeft: 5,
    minWidth: 20,
    textAlign: 'center',
  },
  clubFilterCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clubFilterCheckboxSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderColor: 'white',
  },
  clubFilterCheckmark: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default ResultsScreen; 