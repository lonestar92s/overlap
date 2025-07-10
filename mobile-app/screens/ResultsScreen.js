import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Card, Avatar, Divider, Button, ButtonGroup } from 'react-native-elements';
import ApiService from '../services/api';

const ResultsScreen = ({ route, navigation }) => {
  const { matches: initialMatches = [], searchParams = {} } = route.params || {};
  const [matches, setMatches] = useState(initialMatches);
  const [loading, setLoading] = useState(false);
  const [showDistanceFilter, setShowDistanceFilter] = useState(false);
  const [selectedDistance, setSelectedDistance] = useState(() => {
    // Find the index of the current distance in our options
    const distanceOptions = [50, 100, 250];
    const currentDistance = searchParams.maxDistance || 100;
    return distanceOptions.indexOf(currentDistance) !== -1 ? distanceOptions.indexOf(currentDistance) : 1;
  });

  // Distance options
  const distanceOptions = [
    { label: '50 mi', value: 50 },
    { label: '100 mi', value: 100 },
    { label: '250 mi', value: 250 }
  ];

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
        setMatches(response.data);
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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
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
    console.log('Plan trip for match:', match.fixture.id);
  };

  const renderMatchItem = ({ item }) => {
    const statusInfo = getMatchStatus(item.fixture.status);
    const matchDate = formatDate(item.fixture.date);
    const matchTime = formatTime(item.fixture.date);
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
      </Text>
      {searchParams.location && (
        <Text style={styles.searchInfo}>
          📍 {searchParams.location.city}, {searchParams.location.country}
        </Text>
      )}
      <Text style={styles.searchInfo}>
        📅 {searchParams.dateFrom} to {searchParams.dateTo}
      </Text>
      
      <TouchableOpacity 
        style={styles.distanceFilterButton}
        onPress={() => setShowDistanceFilter(!showDistanceFilter)}
        disabled={loading}
      >
        <Text style={styles.distanceFilterButtonText}>
          📏 Change Distance ({distanceOptions[selectedDistance].label})
        </Text>
      </TouchableOpacity>

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
  distanceFilterButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
    alignSelf: 'center',
  },
  distanceFilterButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
});

export default ResultsScreen; 