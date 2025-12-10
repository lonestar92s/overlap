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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/23441687-a102-405f-bf20-3f2e950047b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PopularMatches.js:25',message:'Component render started',data:{hasOnMatchPress:!!onMatchPress,hasOnMatchesLoaded:!!onMatchesLoaded},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRecommended, setIsRecommended] = useState(false);
  const { isMatchInItinerary } = useItineraries();
  const { user } = useAuth();
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/23441687-a102-405f-bf20-3f2e950047b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PopularMatches.js:30',message:'Initial hooks called',data:{matchesLength:matches.length,loading,isRecommended,refreshing,hasUser:!!user},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  const fetchMatches = async (retryCount = 0, forceRefresh = false) => {
    try {
      setLoading(true);
      let response;
      let isRecommendedData = false;

      // Try to fetch recommended matches if user is authenticated
      if (user) {
        try {
          response = await ApiService.getRecommendedMatches(10, 30, forceRefresh);
          isRecommendedData = true;
          setIsRecommended(true);
          if (__DEV__) {
            console.log('🎯 Using recommended matches for authenticated user');
          }
        } catch (authError) {
          if (__DEV__) {
            console.log('⚠️ Failed to fetch recommended matches, falling back to popular:', authError.message);
          }
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
      if (__DEV__) {
        console.error('Error fetching matches:', error);
      }
      
      // Retry once if it's a timeout error
      if (error.message.includes('timeout') && retryCount < 1) {
        if (__DEV__) {
          console.log('🔄 Retrying matches request...');
        }
        setTimeout(() => fetchMatches(retryCount + 1), 2000);
        return;
      }
      
      const errorMessage = isRecommended 
        ? 'Failed to load recommended matches' 
        : 'Failed to load popular matches';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [user]); // Re-fetch when user authentication status changes

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

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/23441687-a102-405f-bf20-3f2e950047b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PopularMatches.js:133',message:'Before early return checks',data:{loading,matchesLength:matches.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (loading) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/23441687-a102-405f-bf20-3f2e950047b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PopularMatches.js:135',message:'Early return due to loading',data:{loading},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/23441687-a102-405f-bf20-3f2e950047b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PopularMatches.js:145',message:'Early return due to empty matches',data:{matchesLength:matches.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {isRecommended ? 'No recommended matches available' : 'No popular matches available'}
        </Text>
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
});

export default PopularMatches;
 