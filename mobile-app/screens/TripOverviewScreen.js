import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useItineraries } from '../contexts/ItineraryContext';
import MatchCard from '../components/MatchCard';
import HeartButton from '../components/HeartButton';

const TripOverviewScreen = ({ navigation, route }) => {
  const { getItineraryById } = useItineraries();
  const { itineraryId } = route.params;
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (itineraryId) {
      const foundItinerary = getItineraryById(itineraryId);
      if (foundItinerary) {
        console.log('📱 TripOverviewScreen received itinerary:', {
          id: foundItinerary.id || foundItinerary._id,
          name: foundItinerary.name,
          matchesCount: foundItinerary.matches?.length,
          firstMatch: foundItinerary.matches?.[0] ? JSON.stringify(foundItinerary.matches[0], null, 2) : 'No matches'
        });
        setItinerary(foundItinerary);
      }
      setLoading(false);
    }
  }, [itineraryId, getItineraryById]);



  const renderMatchItem = ({ item }) => {
    // Transform the saved match data to the format MatchCard expects
    // Use venueData if available, otherwise fall back to venue string
    const venueInfo = item.venueData || { 
      name: item.venue, 
      city: null,
      coordinates: null 
    };
    
    const transformedMatch = {
      ...item,
      id: item.matchId,
      fixture: {
        id: item.matchId,
        date: item.date,
        venue: venueInfo
      },
      teams: {
        home: { name: item.homeTeam?.name || 'Unknown', logo: item.homeTeam?.logo || '' },
        away: { name: item.awayTeam?.name || 'Unknown', logo: item.awayTeam?.logo || '' }
      },
      league: { name: item.league },
      venue: venueInfo
    };

    return (
      <View style={styles.matchCard}>
        <MatchCard
          match={transformedMatch}
          onPress={() => {
            // No navigation - match cards are not clickable
            console.log('📱 Match card tapped (no action)');
          }}
          variant="default"
          showHeart={true}
          style={styles.matchCardStyle}
        />
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="sports-soccer" size={64} color="#ccc" />
      <Text style={styles.emptyStateTitle}>No matches in this itinerary</Text>
      <Text style={styles.emptyStateSubtitle}>
        Start adding matches to build your football trip!
      </Text>
      <TouchableOpacity
        style={styles.addMatchesButton}
        onPress={() => navigation.navigate('SearchTab')}
      >
        <Icon name="search" size={20} color="white" />
        <Text style={styles.addMatchesButtonText}>Search for matches</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>Loading itinerary...</Text>
      </View>
    );
  }

  if (!itinerary) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={64} color="#ff4444" />
        <Text style={styles.errorTitle}>Itinerary not found</Text>
        <Text style={styles.errorSubtitle}>
          The itinerary you're looking for doesn't exist or has been deleted.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{itinerary.name}</Text>
          <Text style={styles.headerSubtitle}>
            {itinerary.matches?.length || 0} matches
            {itinerary.destination && ` • ${itinerary.destination}`}
          </Text>
        </View>
      </View>

      {/* Content */}
      {itinerary.matches && itinerary.matches.length > 0 ? (
        <FlatList
          data={itinerary.matches}
          renderItem={renderMatchItem}
          keyExtractor={(item, index) => (item.matchId || `match-${index}`).toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        renderEmptyState()
      )}

      {/* Map Button - Floating at bottom */}
      <TouchableOpacity
        style={styles.mapButton}
        onPress={() => navigation.navigate('ItineraryMap', { itineraryId: itinerary.id || itinerary._id })}
        activeOpacity={0.8}
      >
        <Icon name="map" size={20} color="#fff" style={styles.mapButtonIcon} />
        <Text style={styles.mapButtonText}>Map</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  matchCardStyle: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  addMatchesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addMatchesButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ff4444',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  mapButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  mapButtonIcon: {
    marginRight: 8,
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TripOverviewScreen;

