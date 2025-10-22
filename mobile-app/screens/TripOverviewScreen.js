import React, { useState, useEffect, useMemo } from 'react';
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
import MatchPlanningModal from '../components/MatchPlanningModal';
import apiService from '../services/api';

/**
 * TripOverviewScreen - Shows detailed view of a saved itinerary
 * 
 * NEW: Now organizes matches chronologically with date headers
 * - Matches are grouped by date
 * - Date headers show "Today", "Tomorrow", or formatted dates
 * - Matches within each date are sorted chronologically
 * - Provides better organization and easier trip planning
 * 
 * UI CONSISTENCY: Uses exact same back button and date header styles as MapResultsScreen
 * - Back button: Same padding, text size, and color
 * - Date headers: Same padding, margins, typography, and touch target size
 * - Header structure: Same shadow, border, and layout patterns
 */
const TripOverviewScreen = ({ navigation, route }) => {
  const { getItineraryById, updateMatchPlanning, addMatchToItinerary } = useItineraries();
  const { itineraryId } = route.params;
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [planningModalVisible, setPlanningModalVisible] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [scoresLoading, setScoresLoading] = useState(false);

  useEffect(() => {
    if (itineraryId) {
      const foundItinerary = getItineraryById(itineraryId);
      if (foundItinerary) {
        setItinerary(foundItinerary);
        // Fetch recommendations if trip has matches
        if (foundItinerary.matches && foundItinerary.matches.length > 0) {
          fetchRecommendations(foundItinerary.id || foundItinerary._id);
          // Fetch scores for completed matches
          fetchScores(foundItinerary.id || foundItinerary._id);
        }
      }
      setLoading(false);
    }
  }, [itineraryId, getItineraryById]);

  const fetchRecommendations = async (tripId, forceRefresh = false) => {
    setRecommendationsLoading(true);
    try {
      const data = await apiService.getRecommendations(tripId, forceRefresh);
      if (data.success) {
        setRecommendations(data.recommendations || []);
        
        // Track that user viewed recommendations (only if not cached)
        if (!data.cached) {
          data.recommendations?.forEach(rec => {
            trackRecommendation(rec.matchId, 'viewed', tripId, rec.recommendedForDate, rec.score, rec.reason);
          });
        }
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const fetchScores = async (tripId) => {
    setScoresLoading(true);
    try {
      const data = await apiService.fetchScores(tripId);
      if (data.success && data.updatedMatches && data.updatedMatches.length > 0) {
        console.log(`🏆 Fetched scores for ${data.updatedMatches.length} matches`);
        // Update local itinerary state with new scores
        setItinerary(prevItinerary => {
          if (!prevItinerary) return prevItinerary;
          
          const updatedMatches = prevItinerary.matches.map(match => {
            const updatedScore = data.updatedMatches.find(score => score.matchId === match.matchId);
            if (updatedScore) {
              return {
                ...match,
                finalScore: updatedScore.finalScore
              };
            }
            return match;
          });
          
          return {
            ...prevItinerary,
            matches: updatedMatches
          };
        });
      }
    } catch (err) {
      console.error('Error fetching match scores:', err);
      // Don't show error to user - scores are optional
    } finally {
      setScoresLoading(false);
    }
  };

  const trackRecommendation = async (matchId, action, tripId, recommendedDate, score, reason) => {
    try {
      await apiService.trackRecommendation(matchId, action, tripId, recommendedDate, score, reason);
    } catch (err) {
      console.error('Error tracking recommendation:', err);
    }
  };

  const handleAddRecommendationToTrip = async (recommendation) => {
    try {
      // Track that user saved the recommendation
      await trackRecommendation(
        recommendation.matchId, 
        'saved', 
        itinerary.id || itinerary._id, 
        recommendation.recommendedForDate, 
        recommendation.score, 
        recommendation.reason
      );

      // Invalidate cache since trip content has changed
      apiService.invalidateRecommendationCache(itinerary.id || itinerary._id);

      // Format match data for the mobile app API
      const formattedMatchData = {
        matchId: recommendation.match.id || recommendation.match.matchId,
        homeTeam: {
          name: recommendation.match.teams.home.name,
          logo: recommendation.match.teams.home.logo
        },
        awayTeam: {
          name: recommendation.match.teams.away.name,
          logo: recommendation.match.teams.away.logo
        },
        league: recommendation.match.league.name,
        venue: recommendation.match.fixture.venue.name,
        venueData: recommendation.match.fixture.venue,
        date: recommendation.match.fixture.date
      };

      // Add match to trip
      await addMatchToItinerary(itinerary.id || itinerary._id, formattedMatchData);
      
      // Remove the recommendation from the list
      setRecommendations(prev => prev.filter(rec => rec.matchId !== recommendation.matchId));
      
    } catch (err) {
      console.error('Error adding recommendation to trip:', err);
      Alert.alert('Error', 'Failed to add match to trip');
    }
  };

  const handleDismissRecommendation = async (recommendation) => {
    try {
      // Track that user dismissed the recommendation
      await trackRecommendation(
        recommendation.matchId, 
        'dismissed', 
        itinerary.id || itinerary._id, 
        recommendation.recommendedForDate, 
        recommendation.score, 
        recommendation.reason
      );

      // Invalidate cache since user preferences have changed
      apiService.invalidateRecommendationCache(itinerary.id || itinerary._id);

      // Remove the recommendation from the list
      setRecommendations(prev => prev.filter(rec => rec.matchId !== recommendation.matchId));
      
    } catch (err) {
      console.error('Error dismissing recommendation:', err);
    }
  };

  const handleMatchPress = (match) => {
    setSelectedMatch(match);
    setPlanningModalVisible(true);
  };

  const handlePlanningUpdated = (updatedTrip) => {
    // Update local state with the updated trip data
    setItinerary(updatedTrip);
    setPlanningModalVisible(false);
    setSelectedMatch(null);
  };

  const handleClosePlanningModal = () => {
    setPlanningModalVisible(false);
    setSelectedMatch(null);
  };

  // Group matches by date for chronological organization
  // This creates a hierarchical structure: Date Headers -> Matches for that date
  // Matches are sorted chronologically within each date group
  const groupedMatches = useMemo(() => {
    if (!itinerary?.matches || itinerary.matches.length === 0) {
      return [];
    }

    // Sort matches by date first
    const sortedMatches = [...itinerary.matches].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });

    // Group by date
    const grouped = sortedMatches.reduce((acc, match) => {
      const matchDate = new Date(match.date);
      const dateKey = matchDate.toDateString();
      
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: matchDate,
          matches: []
        };
      }
      
      acc[dateKey].matches.push(match);
      return acc;
    }, {});

    // Convert to array and sort by date
    const result = Object.values(grouped).sort((a, b) => a.date - b.date);
    
    // Debug: Log the grouping results
    console.log('TripOverviewScreen: Date grouping results:', {
      totalMatches: itinerary.matches.length,
      groupedDates: result.length,
      groups: result.map(group => ({
        date: group.date.toDateString(),
        matchCount: group.matches.length
      }))
    });
    
    return result;
  }, [itinerary?.matches]);

  // Create flat list data with date headers and matches
  // This converts the grouped structure into a flat array that FlatList can render
  // Each item has a 'type' field: 'header' for date headers, 'match' for matches
  const flatListData = useMemo(() => {
    const data = [];
    
    groupedMatches.forEach((group) => {
      // Add date header
      data.push({ type: 'header', date: group.date });
      
      // Add matches for this date
      group.matches.forEach((match) => {
        data.push({ type: 'match', ...match });
      });
    });
    
    // Add recommendations section if we have recommendations
    if (recommendations.length > 0) {
      data.push({ type: 'recommendations-header' });
      recommendations.forEach((recommendation, index) => {
        data.push({ type: 'recommendation', ...recommendation, index });
      });
    }
    
    return data;
  }, [groupedMatches, recommendations]);

  // Format date for display with smart labels
  // Shows "Today", "Tomorrow", or formatted date (e.g., "Monday, January 3")
  const formatDateHeader = (date) => {
    if (!date) return 'Unknown Date';
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const matchDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (matchDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (matchDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  const renderMatchItem = ({ item }) => {
    // Transform the saved match data to the format MatchCard expects
    // Use venueData if available, otherwise fall back to venue string
    const venueInfo = item.venueData || { 
      name: item.venue, 
      city: null,
      coordinates: null 
    };
    
    // Check if match is completed and has a score
    const matchDate = new Date(item.date);
    const now = new Date();
    const isPast = matchDate < now;
    const hasScore = item.finalScore && item.finalScore.home !== null && item.finalScore.away !== null;
    const shouldShowResults = isPast && hasScore;
    
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
      league: typeof item.league === 'string' ? item.league : { name: item.league?.name || item.league || 'Unknown League' },
      venue: venueInfo,
      // Add score data if available
      score: item.finalScore ? {
        fullTime: {
          home: item.finalScore.home,
          away: item.finalScore.away
        },
        halfTime: item.finalScore.halfTime
      } : null
    };

    return (
      <View style={styles.matchCard}>
        <MatchCard
          match={transformedMatch}
          onPress={() => handleMatchPress(item)}
          variant="default"
          showHeart={true}
          showAttendancePrompt={true}
          showResults={shouldShowResults}
          style={styles.matchCardStyle}
        />
        {/* Show loading indicator for score fetching */}
        {scoresLoading && isPast && !hasScore && (
          <View style={styles.scoreLoadingContainer}>
            <ActivityIndicator size="small" color="#1976d2" />
            <Text style={styles.scoreLoadingText}>Fetching score...</Text>
          </View>
        )}
      </View>
    );
  };

  const renderRecommendationItem = ({ item }) => {
    const recommendation = item;
    const match = recommendation.match;
    
    const transformedMatch = {
      id: match.id || match.matchId,
      fixture: {
        id: match.id || match.matchId,
        date: match.fixture.date,
        venue: match.fixture.venue
      },
      teams: {
        home: {
          id: match.teams.home.id,
          name: match.teams.home.name,
          logo: match.teams.home.logo
        },
        away: {
          id: match.teams.away.id,
          name: match.teams.away.name,
          logo: match.teams.away.logo
        }
      },
      league: {
        id: match.league.id,
        name: match.league.name
      }
    };

    return (
      <View style={styles.recommendationItem}>
        <MatchCard
          match={transformedMatch}
          onPress={() => {}} // No press action for recommendations
          variant="default"
          showHeart={true}
          style={styles.matchCardStyle}
        />
        
        {/* Recommendation-specific info and actions */}
        <View style={styles.recommendationInfo}>
          <View style={styles.recommendationReason}>
            <Text style={styles.recommendationReasonText}>💡 {recommendation.reason}</Text>
          </View>
          
          <View style={styles.recommendationActions}>
            <TouchableOpacity
              style={styles.dismissRecommendationButton}
              onPress={() => handleDismissRecommendation(recommendation)}
            >
              <Text style={styles.dismissRecommendationButtonText}>Not Interested</Text>
            </TouchableOpacity>
          </View>
        </View>
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
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{itinerary.name}</Text>
          <Text style={styles.headerSubtitle}>
            {itinerary.matches?.length || 0} matches
            {groupedMatches.length > 0 && ` • ${groupedMatches.length} date${groupedMatches.length === 1 ? '' : 's'}`}
            {itinerary.destination && ` • ${itinerary.destination}`}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => setModalVisible(true)}
        >
          <Icon name="more-vert" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {itinerary.matches && itinerary.matches.length > 0 ? (
        <FlatList
          data={flatListData}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.dateHeader}>
                  <Text style={styles.dateHeaderText}>
                    {formatDateHeader(item.date)}
                  </Text>
                </View>
              );
            } else if (item.type === 'recommendations-header') {
              return (
                <View style={styles.recommendationsHeader}>
                  <Icon name="recommend" size={20} color="#FF385C" />
                  <Text style={styles.recommendationsHeaderText}>
                    Recommended Matches to Check Out on Your Trip
                  </Text>
                  <View style={styles.recommendationsCountChip}>
                    <Text style={styles.recommendationsCountText}>
                      {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              );
            } else if (item.type === 'recommendation') {
              return renderRecommendationItem({ item });
            } else {
              return renderMatchItem({ item });
            }
          }}
          keyExtractor={(item, index) => {
            if (item.type === 'header') return `header-${index}`;
            if (item.type === 'recommendations-header') return `recommendations-header-${index}`;
            if (item.type === 'recommendation') return `recommendation-${item.matchId}-${index}`;
            return item.matchId || `match-${index}`;
          }}
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

      {/* Options Modal - Slides up from bottom */}
      {modalVisible && (
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setModalVisible(false)}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.modalOption}>
                <View style={styles.modalOptionLeft}>
                  <Icon name="share" size={20} color="#666" />
                  <Text style={styles.modalOptionText}>Share Itinerary</Text>
                </View>
                <Icon name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalOption}>
                <View style={styles.modalOptionLeft}>
                  <Icon name="edit" size={20} color="#666" />
                  <Text style={styles.modalOptionText}>Rename</Text>
                </View>
                <Icon name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalOption}>
                <View style={styles.modalOptionLeft}>
                  <Icon name="home" size={20} color="#666" />
                  <Text style={styles.modalOptionText}>Homebase</Text>
                </View>
                <Icon name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalOption}>
                <View style={styles.modalOptionLeft}>
                  <Icon name="delete" size={20} color="#666" />
                  <Text style={styles.modalOptionText}>Delete</Text>
                </View>
                <Icon name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Match Planning Modal */}
      <MatchPlanningModal
        visible={planningModalVisible}
        onClose={handleClosePlanningModal}
        match={selectedMatch}
        tripId={itineraryId}
        onPlanningUpdated={handlePlanningUpdated}
      />
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
    borderBottomColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'transparent', // Explicitly set to transparent
    borderRadius: 0, // No rounded corners
    borderWidth: 0, // No border
    // No background color - matches MapResultsScreen style
  },
  backButtonText: {
    fontSize: 20,
    color: '#000',
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
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
    left: '50%',
    transform: [{ translateX: -50 }],
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    // Make button even smaller and perfectly centered like Airbnb
    width: 'auto',
    minWidth: 80,
    maxWidth: 140,
  },
  mapButtonIcon: {
    marginRight: 4,
    fontSize: 14,
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dateHeader: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 44, // Ensure minimum touch target size
  },
  dateHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize',
  },
  moreButton: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000, // High z-index to be above map button
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%', // Adjust as needed
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalContent: {
    marginTop: 10,
  },
  modalText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 10,
    lineHeight: 22,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOptionText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  // Recommendation styles
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
  },
  recommendationsHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginLeft: 8,
    flex: 1,
  },
  recommendationsCountChip: {
    backgroundColor: '#FF385C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  recommendationsCountText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  recommendationItem: {
    marginBottom: 16,
  },
  recommendationInfo: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  recommendationReason: {
    marginBottom: 12,
  },
  recommendationReasonText: {
    fontSize: 14,
    color: '#FF385C',
    fontStyle: 'italic',
  },
  recommendationActions: {
    alignItems: 'center',
  },
  dismissRecommendationButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  dismissRecommendationButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  scoreLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
    marginTop: 8,
  },
  scoreLoadingText: {
    fontSize: 12,
    color: '#1976d2',
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default TripOverviewScreen;

