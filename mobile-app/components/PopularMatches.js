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
  Dimensions,
} from 'react-native';
import ApiService from '../services/api';
import HeartButton from './HeartButton';
import MatchCard from './MatchCard';
import { useItineraries } from '../contexts/ItineraryContext';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.85; // 85% of screen width for horizontal cards

const PopularMatches = ({ onMatchPress, onMatchesLoaded }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRecommended, setIsRecommended] = useState(false);
  const { isMatchInItinerary } = useItineraries();
  const { user } = useAuth();

  const fetchMatches = async (retryCount = 0) => {
    try {
      setLoading(true);
      let response;
      let isRecommendedData = false;

      // Try to fetch recommended matches if user is authenticated
      if (user) {
        try {
          response = await ApiService.getRecommendedMatches();
          isRecommendedData = true;
          setIsRecommended(true);
          console.log('🎯 Using recommended matches for authenticated user');
        } catch (authError) {
          console.log('⚠️ Failed to fetch recommended matches, falling back to popular:', authError.message);
          // Fall back to popular matches if recommended fails
          response = await ApiService.getPopularMatches();
          setIsRecommended(false);
        }
      } else {
        // Use popular matches for non-authenticated users
        response = await ApiService.getPopularMatches();
        setIsRecommended(false);
      }
      
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
      console.error('Error fetching matches:', error);
      
      // Retry once if it's a timeout error
      if (error.message.includes('timeout') && retryCount < 1) {
        console.log('🔄 Retrying matches request...');
        setTimeout(() => fetchMatches(retryCount + 1), 2000);
        return;
      }
      
      const errorMessage = isRecommended 
        ? 'Failed to load recommended matches' 
        : 'Failed to load popular matches';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [user]); // Re-fetch when user authentication status changes

  const onRefresh = () => {
    setRefreshing(true);
    fetchMatches();
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
    <View style={styles.cardWrapper}>
      <MatchCard
        match={item}
        onPress={() => onMatchPress(item)}
        variant="default"
        showHeart={true}
        style={styles.popularMatchCard}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          {isRecommended ? 'Loading recommended matches...' : 'Loading popular matches...'}
        </Text>
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {isRecommended ? 'No recommended matches available' : 'No popular matches available'}
        </Text>
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={onRefresh}
          accessibilityLabel="Refresh matches"
          accessibilityRole="button"
        >
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        {isRecommended ? 'Recommended for You' : 'Recommended for You'}
      </Text>
      <FlatList
        data={matches}
        renderItem={renderMatchCard}
        keyExtractor={(item, index) => (item.id || item.fixture?.id || `match-${index}`).toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={onRefresh}
        snapToInterval={CARD_WIDTH + spacing.md * 2}
        decelerationRate="fast"
        snapToAlignment="start"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  sectionTitle: {
    ...typography.h2,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginLeft: spacing.md,
    color: colors.text.primary,
  },
  listContainer: {
    paddingHorizontal: spacing.md,
    paddingRight: spacing.lg, // Extra padding on right for last card
  },
  cardWrapper: {
    width: CARD_WIDTH,
    marginRight: spacing.md,
  },
  matchCard: {
    width: 300,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginRight: spacing.md,
  },
  venueImageContainer: {
    height: 120,
    borderTopLeftRadius: borderRadius.md,
    borderTopRightRadius: borderRadius.md,
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
    backgroundColor: colors.cardGrey,
    justifyContent: 'center',
    alignItems: 'center',
  },
  venueImagePlaceholderText: {
    fontSize: 32,
  },
  matchInfo: {
    padding: spacing.md,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  matchTeams: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  matchTime: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  venueName: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  venueLocation: {
    ...typography.caption,
    color: colors.text.light,
    marginBottom: spacing.sm,
  },
  leagueName: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '500',
  },
  heartButton: {
    backgroundColor: 'transparent',
    padding: 2,
    marginLeft: spacing.xs,
  },
  popularMatchCard: {
    width: '100%',
    marginVertical: spacing.xs,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    ...typography.body,
    color: colors.text.secondary,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  refreshButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  refreshButtonText: {
    color: colors.card,
    ...typography.bodySmall,
    fontWeight: '500',
  },
});

export default PopularMatches;
 