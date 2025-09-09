import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useItineraries } from '../contexts/ItineraryContext';

const TripsListScreen = ({ navigation }) => {
  const { itineraries, deleteItinerary, loading, refreshItineraries } = useItineraries();
  const [refreshing, setRefreshing] = useState(false);



  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshItineraries();
    } catch (error) {
      console.error('Error refreshing itineraries:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleItineraryPress = (itinerary) => {
    // Navigate to itinerary detail view
    navigation.navigate('TripOverview', { itineraryId: itinerary.id || itinerary._id });
  };

  const handleDeleteItinerary = (itinerary) => {
    Alert.alert(
      'Delete Itinerary',
      `Are you sure you want to delete "${itinerary.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteItinerary(itinerary.id || itinerary._id)
        }
      ]
    );
  };

  const renderItineraryItem = ({ item }) => (
    <View style={styles.itineraryCard}>
      <TouchableOpacity
        style={styles.itineraryContent}
        onPress={() => handleItineraryPress(item)}
        onLongPress={() => handleDeleteItinerary(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itineraryHeader}>
          <View style={styles.itineraryInfo}>
            <Text style={styles.itineraryName}>{item.name}</Text>
          </View>
          <View style={styles.itineraryStats}>
            <Text style={styles.matchCount}>{item.matches?.length || 0} matches</Text>
            <Icon name="chevron-right" size={24} color="#999" />
          </View>
        </View>
        
        {item.matches && item.matches.length > 0 && (
          <View style={styles.matchesPreview}>
            <Text style={styles.matchesPreviewTitle}>Upcoming matches:</Text>
            {item.matches.slice(0, 3).map((match, index) => {
              const homeTeam = match.homeTeam?.name || match.teams?.home?.name || 'Unknown';
              const awayTeam = match.awayTeam?.name || match.teams?.away?.name || 'Unknown';
              const date = match.date;
              return (
                <Text key={match.matchId || `match-${index}`} style={styles.matchPreview}>
                  {homeTeam} vs {awayTeam} - {date ? new Date(date).toLocaleDateString() : 'TBD'}
                </Text>
              );
            })}
            {item.matches.length > 3 && (
              <Text style={styles.moreMatches}>+{item.matches.length - 3} more</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
      
      {/* Delete Button */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteItinerary(item)}
        activeOpacity={0.7}
      >
        <Icon name="delete" size={20} color="#ff4444" />
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="flight" size={64} color="#ccc" />
      <Text style={styles.emptyStateTitle}>No trips planned yet</Text>
      <Text style={styles.emptyStateSubtitle}>
        Start planning your football adventures by saving matches to new itineraries
      </Text>
      <TouchableOpacity
        style={styles.createTripButton}
        onPress={() => navigation.navigate('SearchTab')}
      >
        <Icon name="search" size={20} color="white" />
        <Text style={styles.createTripButtonText}>Search for matches</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>Loading your trips...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Trips</Text>
        <Text style={styles.headerSubtitle}>
          {itineraries.length} {itineraries.length === 1 ? 'itinerary' : 'itineraries'}
        </Text>
        <Text style={styles.headerNote}>Shows all your planned trips and saved matches</Text>
      </View>

      {itineraries.length > 0 ? (
        <FlatList
          data={itineraries}
          renderItem={renderItineraryItem}
          keyExtractor={(item) => item.id || item._id}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        renderEmptyState()
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#444',
    marginBottom: 4,
  },
  headerNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  headerTip: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
  listContainer: {
    padding: 16,
  },
  itineraryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  itineraryContent: {
    flex: 1,
    padding: 16,
  },
  deleteButton: {
    backgroundColor: '#fff5f5',
    borderLeftWidth: 1,
    borderLeftColor: '#ffebee',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  itineraryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itineraryInfo: {
    flex: 1,
    marginRight: 16,
  },
  itineraryName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  itineraryDestination: {
    fontSize: 14,
    color: '#444',
    marginBottom: 2,
  },
  itineraryDates: {
    fontSize: 14,
    color: '#444',
  },
  itineraryStats: {
    alignItems: 'center',
  },
  matchCount: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
    marginBottom: 4,
  },
  matchesPreview: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  matchesPreviewTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#444',
    marginBottom: 8,
  },
  matchPreview: {
    fontSize: 13,
    color: '#444',
    marginBottom: 4,
  },
  moreMatches: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
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
    color: '#444',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  createTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createTripButtonText: {
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
    color: '#444',
  },
});

export default TripsListScreen;

