import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import ApiService from '../services/api';
import HeartButton from './HeartButton';
import MatchCard from './MatchCard';
import { useSavedMatches } from '../contexts/SavedMatchesContext';

const PopularMatches = ({ onMatchPress, onMatchesLoaded }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { isMatchSaved, toggleSaveMatch } = useSavedMatches();

  const fetchPopularMatches = async (retryCount = 0) => {
    try {
      setLoading(true);
      const response = await ApiService.getPopularMatches();
      
      console.log('Popular matches API response:', response);
      
      // Handle different response structures
      let matchesData = [];
      if (response.success && response.matches) {
        matchesData = response.matches;
      } else if (response.matches) {
        matchesData = response.matches;
      } else if (Array.isArray(response)) {
        matchesData = response;
      } else if (response.data && Array.isArray(response.data)) {
        matchesData = response.data;
      }
      
      if (matchesData.length > 0) {
        setMatches(matchesData);
        if (onMatchesLoaded) {
          onMatchesLoaded(matchesData);
        }
      } else {
        setMatches([]);
        if (onMatchesLoaded) {
          onMatchesLoaded([]);
        }
      }
    } catch (error) {
      console.error('Error fetching popular matches:', error);
      
      // Retry once if it's a timeout error
      if (error.message.includes('timeout') && retryCount < 1) {
        console.log('🔄 Retrying popular matches request...');
        setTimeout(() => fetchPopularMatches(retryCount + 1), 2000);
        return;
      }
      
      Alert.alert('Error', 'Failed to load popular matches');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPopularMatches();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPopularMatches();
  };

  const formatMatchDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const renderMatchCard = ({ item }) => (
    <MatchCard
      match={item}
      onPress={() => onMatchPress(item)}
      variant="default"
      showHeart={true}
      style={styles.popularMatchCard}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>Loading popular matches...</Text>
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No popular matches available</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Popular Matches</Text>
      <FlatList
        data={matches}
        renderItem={renderMatchCard}
        keyExtractor={(item, index) => (item.id || item.fixture?.id || `match-${index}`).toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 16,
    color: '#1a1a1a',
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  matchCard: {
    width: 300,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  venueImageContainer: {
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  venueImage: {
    width: '100%',
    height: '100%',
  },
  venueImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  venueImagePlaceholderText: {
    fontSize: 32,
  },
  matchInfo: {
    padding: 16,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  matchTeams: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 12,
  },
  matchTime: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
    marginBottom: 8,
  },
  venueName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  venueLocation: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  leagueName: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  heartButton: {
    backgroundColor: 'transparent',
    padding: 2,
    marginLeft: 4,
  },
  popularMatchCard: {
    marginHorizontal: 8,
    marginVertical: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  refreshButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default PopularMatches;
 