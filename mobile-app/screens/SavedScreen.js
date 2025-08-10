import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSavedMatches } from '../contexts/SavedMatchesContext';
import HeartButton from '../components/HeartButton';
import MatchCard from '../components/MatchCard';

const SavedScreen = () => {
  const { 
    savedMatchesData, 
    loading, 
    loadSavedMatchesFromBackend,
    isMatchSaved 
  } = useSavedMatches();

  useEffect(() => {
    loadSavedMatchesFromBackend();
  }, []);

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

  const renderSavedMatch = ({ item }) => {
    // Convert saved match data to match format expected by MatchCard
    const matchData = {
      id: item.matchId,
      fixture: {
        id: item.matchId,
        date: item.date,
        venue: {
          name: item.venue,
          city: '',
          country: ''
        }
      },
      teams: {
        home: item.homeTeam,
        away: item.awayTeam
      },
      league: {
        name: item.league,
        logo: ''
      }
    };

    return (
      <MatchCard
        match={matchData}
        onPress={() => {}} // No action for saved matches
        variant="default"
        showHeart={true}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>Loading saved matches...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved Matches</Text>
        <Text style={styles.subtitle}>
          {savedMatchesData.length} match{savedMatchesData.length !== 1 ? 'es' : ''} saved
        </Text>
      </View>

      {savedMatchesData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🤍</Text>
          <Text style={styles.emptyTitle}>No saved matches yet</Text>
          <Text style={styles.emptyText}>
            Heart matches you're interested in to see them here!
          </Text>
        </View>
      ) : (
        <FlatList
          data={savedMatchesData}
          renderItem={renderSavedMatch}
          keyExtractor={(item) => item.matchId}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
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
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  matchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  teamsContainer: {
    flex: 1,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  vs: {
    fontSize: 14,
    color: '#666',
    marginHorizontal: 8,
  },
  matchDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  matchTime: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
    marginBottom: 4,
  },
  venueName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  leagueName: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default SavedScreen;
 