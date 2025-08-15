import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useItineraries } from '../contexts/ItineraryContext';

const MemoriesScreen = ({ navigation }) => {
  const { itineraries } = useItineraries();
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' or 'stadiums'
  
  // Extract only PAST/ATTENDED matches from all itineraries
  // This ensures Memories page only shows matches that have already happened
  const allMatches = itineraries.flatMap(itinerary => 
    itinerary.matches
      .filter(match => {
        // Only show matches that are in the past (attended)
        // We consider a match "past" if it's more than 2 hours before now
        // This accounts for match duration and travel time
        const matchDate = new Date(match.date);
        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));
        return matchDate < twoHoursAgo;
      })
      .map(match => ({
        ...match,
        itineraryName: itinerary.name,
        itineraryDestination: itinerary.destination
      }))
  );

  // Group matches by venue to create stadium entries
  const stadiums = Array.from(
    new Map(
      allMatches.map(match => [
        match.venue,
        {
          name: match.venue,
          city: match.venueCoordinates ? 'Location tracked' : 'Unknown city',
          matches: [],
          firstVisit: null,
          lastVisit: null
        }
      ])
    ).values()
  );

  // Populate stadium data
  stadiums.forEach(stadium => {
    const venueMatches = allMatches.filter(match => match.venue === stadium.name);
    stadium.matches = venueMatches;
    
    if (venueMatches.length > 0) {
      const dates = venueMatches
        .map(match => new Date(match.date))
        .filter(date => !isNaN(date.getTime()))
        .sort((a, b) => a - b);
      
      if (dates.length > 0) {
        stadium.firstVisit = dates[0];
        stadium.lastVisit = dates[dates.length - 1];
      }
    }
  });

  const renderMatchItem = ({ item }) => (
    <View style={styles.matchItem}>
      <View style={styles.matchHeader}>
        <Text style={styles.matchTeams}>
          {item.homeTeam} vs {item.awayTeam}
        </Text>
        <View style={styles.matchMeta}>
          <Text style={styles.matchDate}>
            {new Date(item.date).toLocaleDateString()}
          </Text>
          <Text style={styles.matchLeague}>{item.league}</Text>
        </View>
      </View>
      
      <View style={styles.matchDetails}>
        <View style={styles.venueInfo}>
          <Icon name="location-on" size={16} color="#666" />
          <Text style={styles.venueName}>{item.venue}</Text>
        </View>
        <Text style={styles.itineraryName}>
          From: {item.itineraryName}
        </Text>
      </View>
    </View>
  );

  const renderStadiumItem = ({ item }) => (
    <TouchableOpacity style={styles.stadiumItem}>
      <View style={styles.stadiumHeader}>
        <View style={styles.stadiumIcon}>
          <Icon name="sports-soccer" size={24} color="#1976d2" />
        </View>
        <View style={styles.stadiumInfo}>
          <Text style={styles.stadiumName}>{item.name}</Text>
          <Text style={styles.stadiumCity}>{item.city}</Text>
        </View>
        <View style={styles.stadiumStats}>
          <Text style={styles.matchCount}>{item.matches.length}</Text>
          <Text style={styles.matchCountLabel}>matches</Text>
        </View>
      </View>
      
      {item.firstVisit && (
        <View style={styles.visitInfo}>
          <Text style={styles.visitText}>
            First visit: {item.firstVisit.toLocaleDateString()}
          </Text>
          {item.lastVisit && item.lastVisit !== item.firstVisit && (
            <Text style={styles.visitText}>
              Last visit: {item.lastVisit.toLocaleDateString()}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="sports-soccer" size={64} color="#ccc" />
      <Text style={styles.emptyStateTitle}>
        {activeTab === 'matches' ? 'No matches attended yet' : 'No stadiums visited yet'}
      </Text>
      <Text style={styles.emptyStateSubtitle}>
        {activeTab === 'matches' 
          ? 'Start planning your football trips and mark matches as attended to build your memories!'
          : 'Visit stadiums and attend matches to start building your stadium passport!'
        }
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Memories</Text>
        <Text style={styles.headerSubtitle}>Track your attended matches and visited stadiums</Text>
        <Text style={styles.headerNote}>Only shows past matches from your itineraries</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'matches' && styles.activeTab]}
          onPress={() => setActiveTab('matches')}
        >
          <Icon 
            name="event" 
            size={20} 
            color={activeTab === 'matches' ? '#1976d2' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'matches' && styles.activeTabText]}>
            Matches ({allMatches.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stadiums' && styles.activeTab]}
          onPress={() => setActiveTab('stadiums')}
        >
          <Icon 
            name="sports-soccer" 
            size={20} 
            color={activeTab === 'stadiums' ? '#1976d2' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'stadiums' && styles.activeTabText]}>
            Stadiums ({stadiums.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'matches' ? (
        <FlatList
          data={allMatches}
          renderItem={renderMatchItem}
          keyExtractor={(item, index) => `${item.matchId}-${index}`}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={stadiums}
          renderItem={renderStadiumItem}
          keyExtractor={(item, index) => `${item.name}-${index}`}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  headerNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  activeTab: {
    backgroundColor: '#e3f2fd',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#1976d2',
  },
  listContainer: {
    padding: 20,
    flexGrow: 1,
  },
  matchItem: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  matchHeader: {
    marginBottom: 12,
  },
  matchTeams: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  matchMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  matchDate: {
    fontSize: 14,
    color: '#666',
  },
  matchLeague: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  matchDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  venueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  venueName: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  itineraryName: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  stadiumItem: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  stadiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stadiumIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stadiumInfo: {
    flex: 1,
  },
  stadiumName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  stadiumCity: {
    fontSize: 14,
    color: '#666',
  },
  stadiumStats: {
    alignItems: 'center',
  },
  matchCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  matchCountLabel: {
    fontSize: 12,
    color: '#666',
  },
  visitInfo: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  visitText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
});

export default MemoriesScreen;
