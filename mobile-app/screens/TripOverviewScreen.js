import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Modal,
  InteractionManager
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MaterialIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useItineraries } from '../contexts/ItineraryContext';
import MatchCard from '../components/MatchCard';
import HeartButton from '../components/HeartButton';
import MatchPlanningModal from '../components/MatchPlanningModal';
import AddFlightModal from '../components/AddFlightModal';
import HomeBaseSection from '../components/HomeBaseSection';
import apiService from '../services/api';
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../styles/designTokens';
import { createDateRange } from '../utils/dateUtils';
import { useRecommendations } from '../hooks/useRecommendations';

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
  const { getItineraryById, updateMatchPlanning, addMatchToItinerary, deleteItinerary, refreshItinerary, updateItinerary } = useItineraries();
  const itineraryId = route?.params?.itineraryId;
  const fromAccountTab = route?.params?.fromAccountTab === true;
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [planningModalVisible, setPlanningModalVisible] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  
  // Use recommendations hook (disabled for past trips)
  // Pass trip object so hook can read recommendations from trip.recommendations
  const tripId = itinerary?.id || itinerary?._id;
  const isPastTripForHook = itinerary?.isCompleted === true;
  const { 
    recommendations, 
    loading: recommendationsLoading, 
    error: recommendationsError,
    refetch: refetchRecommendations,
    dismiss: dismissRecommendation,
    addToTrip: addRecommendationToTrip
  } = useRecommendations(tripId, itinerary, { autoFetch: !!tripId && !isPastTripForHook });
  const [scoresLoading, setScoresLoading] = useState(false);
  const [matchesExpanded, setMatchesExpanded] = useState(true);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [recommendationsExpanded, setRecommendationsExpanded] = useState(true);
  const [descriptionText, setDescriptionText] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [flightsExpanded, setFlightsExpanded] = useState(false);
  const [addFlightModalVisible, setAddFlightModalVisible] = useState(false);
  const [deletingFlightId, setDeletingFlightId] = useState(null);
  const [editDatesModalVisible, setEditDatesModalVisible] = useState(false);
  const [editStartDate, setEditStartDate] = useState(null);
  const [editEndDate, setEditEndDate] = useState(null);
  const [showEditCalendar, setShowEditCalendar] = useState(false);
  const [editSelectedDates, setEditSelectedDates] = useState({});
  const [isSavingDates, setIsSavingDates] = useState(false);
  const scrollViewRef = useRef(null);
  const notesInputRef = useRef(null);
  const descriptionInputRef = useRef(null);
  const notesSectionRef = useRef(null);
  const [notesSectionY, setNotesSectionY] = useState(0);

  // Detect if this is a past trip (completed trip)
  const isPastTrip = itinerary?.isCompleted === true;

  useEffect(() => {
    if (itineraryId) {
      // Load cached recommendations immediately (synchronously) for instant display
      // Note: The useRecommendations hook will handle loading recommendations automatically
      // We just log here for debugging - the hook manages its own state
      const cachedRecs = apiService.getCachedRecommendations(itineraryId);
      if (cachedRecs && cachedRecs.success && cachedRecs.recommendations) {
        const recommendations = cachedRecs.recommendations || [];
        const seenMatchIds = new Set();
        const uniqueRecommendations = recommendations.filter(rec => {
          const matchId = String(rec.matchId || rec.match?.fixture?.id || rec.match?.id);
          if (seenMatchIds.has(matchId)) {
            return false;
          }
          seenMatchIds.add(matchId);
          return true;
        });
        // Recommendations are managed by useRecommendations hook - no need to set manually
        console.log('⚡ Cached recommendations available:', uniqueRecommendations.length);
      }

      // Always fetch fresh data from API on mount to ensure we have latest flights
      const loadItinerary = async () => {
        try {
          const response = await apiService.getTripById(itineraryId);
          // Handle both response.trip and response.data formats
          const tripData = response.trip || response.data;
          if (response.success && tripData) {
            console.log('Loaded itinerary on mount with flights:', tripData.flights?.length || 0);
            setItinerary(tripData);
            setDescriptionText(tripData.description || '');
            setNotesText(tripData.notes || '');
            // Recommendations are automatically fetched by useRecommendations hook
            // Fetch scores for completed matches
            if (tripData.matches && tripData.matches.length > 0) {
              fetchScores(tripData.id || tripData._id);
            }
          } else {
            // Fallback to context if API fails
            const foundItinerary = getItineraryById(itineraryId);
            if (foundItinerary) {
              setItinerary(foundItinerary);
              setDescriptionText(foundItinerary.description || '');
              setNotesText(foundItinerary.notes || '');
              // Recommendations are automatically fetched by useRecommendations hook
              // The hook will fetch when tripId becomes available
            }
          }
        } catch (error) {
          console.error('Error loading itinerary:', error);
          // Fallback to context
          const foundItinerary = getItineraryById(itineraryId);
          if (foundItinerary) {
            setItinerary(foundItinerary);
            setDescriptionText(foundItinerary.description || '');
            setNotesText(foundItinerary.notes || '');
            // Recommendations are automatically fetched by useRecommendations hook
          }
        } finally {
          setLoading(false);
        }
      };
      loadItinerary();
    } else {
      // No itineraryId provided, stop loading
      setLoading(false);
    }
  }, [itineraryId, getItineraryById]);

  // Refetch recommendations when screen comes into focus (to sync with other screens)
  // Use a ref to track if this is the initial mount to avoid double-fetching
  const isInitialMount = React.useRef(true);
  
  useFocusEffect(
    React.useCallback(() => {
      // Skip the first focus (initial mount) - recommendations are already fetched in useEffect
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      
      // Only refetch if we have an itinerary loaded and we're coming back to the screen
      if (itinerary?.id || itinerary?._id) {
        refetchRecommendations(true); // Force refresh to get latest (including dismissed items removed)
      }
    }, [itinerary])
  );

  // Refresh itinerary after flight is added
  const handleFlightAdded = async () => {
    if (itineraryId) {
      try {
        console.log('Refreshing itinerary after flight added:', itineraryId);
        // Refresh from context (which will update both context and local state)
        const updatedItinerary = await refreshItinerary(itineraryId);
        console.log('Updated itinerary from context:', updatedItinerary);
        if (updatedItinerary) {
          console.log('Setting itinerary with flights:', updatedItinerary.flights?.length || 0);
          setItinerary(updatedItinerary);
        } else {
          // Fallback: fetch directly if context refresh fails
          console.log('Context refresh failed, fetching directly...');
          const response = await apiService.getTripById(itineraryId);
          console.log('Direct fetch response:', response);
          // Handle both response.trip and response.data formats
          const tripData = response.trip || response.data;
          if (response.success && tripData) {
            console.log('Setting itinerary from direct fetch with flights:', tripData.flights?.length || 0);
            setItinerary(tripData);
          }
        }
      } catch (error) {
        console.error('Error refreshing itinerary:', error);
      }
    }
  };

  // Delete flight from trip
  const handleDeleteFlight = async (flightId) => {
    if (!itinerary || !flightId) return;

    Alert.alert(
      'Delete Flight',
      'Are you sure you want to remove this flight from your trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingFlightId(flightId);
              const tripId = itinerary.id || itinerary._id;
              
              // Ensure flightId is a string (Mongoose subdocuments use _id)
              const flightIdString = String(flightId);
              
              console.log('Deleting flight:', { tripId, flightId: flightIdString, originalFlightId: flightId });
              
              await apiService.deleteFlightFromTrip(tripId, flightIdString);
              
              console.log('Flight deleted, refreshing itinerary...');
              
              // Refresh itinerary from context (which updates both context and local state)
              const updatedItinerary = await refreshItinerary(tripId);
              console.log('Updated itinerary after delete:', updatedItinerary);
              if (updatedItinerary) {
                console.log('Setting itinerary with flights:', updatedItinerary.flights?.length || 0);
                setItinerary(updatedItinerary);
              } else {
                // Fallback: fetch directly if context refresh fails
                console.log('Context refresh failed, fetching directly...');
                const response = await apiService.getTripById(tripId);
                console.log('Direct fetch response:', response);
                // Handle both response.trip and response.data formats
                const tripData = response.trip || response.data;
                if (response.success && tripData) {
                  console.log('Setting itinerary from direct fetch with flights:', tripData.flights?.length || 0);
                  setItinerary(tripData);
                }
              }
            } catch (error) {
              console.error('Error deleting flight:', error);
              console.error('Error details:', {
                message: error.message,
                tripId: itinerary.id || itinerary._id,
                flightId: flightId
              });
              Alert.alert('Error', error.message || 'Failed to delete flight. Please try again.');
            } finally {
              setDeletingFlightId(null);
            }
          }
        }
      ]
    );
  };

  // Get sorted flights (chronological)
  const getSortedFlights = () => {
    if (!itinerary?.flights || itinerary.flights.length === 0) return [];
    
    return [...itinerary.flights].sort((a, b) => {
      const dateA = a.departure?.date || '';
      const timeA = a.departure?.time || '';
      const dateB = b.departure?.date || '';
      const timeB = b.departure?.time || '';
      
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }
      return (timeA || '').localeCompare(timeB || '');
    });
  };

  // Save description (trip info card text)
  const handleSaveDescription = async () => {
    if (!itinerary) return;
    
    setIsSavingDescription(true);
    try {
      const tripId = itinerary.id || itinerary._id;
      await apiService.updateTrip(tripId, { description: descriptionText });
      
      // Update local state
      setItinerary(prev => ({
        ...prev,
        description: descriptionText
      }));
      
      setIsEditingDescription(false);
    } catch (error) {
      console.error('Error saving description:', error);
      Alert.alert('Error', 'Failed to save description. Please try again.');
    } finally {
      setIsSavingDescription(false);
    }
  };

  // Save notes (notes dropdown)
  const handleSaveNotes = async () => {
    if (!itinerary) return;
    
    setIsSavingNotes(true);
    try {
      const tripId = itinerary.id || itinerary._id;
      await apiService.updateTrip(tripId, { notes: notesText });
      
      // Update local state
      setItinerary(prev => ({
        ...prev,
        notes: notesText
      }));
      
      setIsEditingNotes(false);
    } catch (error) {
      console.error('Error saving notes:', error);
      Alert.alert('Error', 'Failed to save notes. Please try again.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Save dates
  const handleSaveDates = async () => {
    if (!itinerary || !editStartDate || !editEndDate) return;
    
    if (new Date(editEndDate) < new Date(editStartDate)) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }
    
    setIsSavingDates(true);
    try {
      const tripId = itinerary.id || itinerary._id;
      
      // Update via context which will update both local state and context state
      const updatedItinerary = await updateItinerary(tripId, {
        startDate: new Date(editStartDate).toISOString(),
        endDate: new Date(editEndDate).toISOString()
      });
      
      if (updatedItinerary) {
        setItinerary(updatedItinerary);
      }
      
      setEditDatesModalVisible(false);
    } catch (error) {
      console.error('Error saving dates:', error);
      Alert.alert('Error', 'Failed to save dates. Please try again.');
    } finally {
      setIsSavingDates(false);
    }
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Select date';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const onEditDayPress = (day) => {
    const selectedDate = day.dateString;
    
    if (!editStartDate || (editStartDate && editEndDate)) {
      // Start new selection
      setEditStartDate(selectedDate);
      setEditEndDate(null);
      setEditSelectedDates({
        [selectedDate]: {
          selected: true,
          startingDay: true,
          endingDay: true,
          color: colors.primary,
          textColor: '#ffffff',
        }
      });
    } else {
      // Complete selection
      if (selectedDate < editStartDate) {
        // Swap dates if end is before start
        setEditStartDate(selectedDate);
        setEditEndDate(editStartDate);
        const dateRange = createDateRange(selectedDate, editStartDate);
        const dates = {};
        dateRange.forEach((dateStr, index) => {
          dates[dateStr] = {
            selected: true,
            startingDay: index === 0,
            endingDay: index === dateRange.length - 1,
            color: colors.primary,
            textColor: index === 0 || index === dateRange.length - 1 ? '#ffffff' : colors.text.primary,
          };
        });
        setEditSelectedDates(dates);
      } else {
        setEditEndDate(selectedDate);
        const dateRange = createDateRange(editStartDate, selectedDate);
        const dates = {};
        dateRange.forEach((dateStr, index) => {
          dates[dateStr] = {
            selected: true,
            startingDay: index === 0,
            endingDay: index === dateRange.length - 1,
            color: colors.primary,
            textColor: index === 0 || index === dateRange.length - 1 ? '#ffffff' : colors.text.primary,
          };
        });
        setEditSelectedDates(dates);
      }
      // Auto-close calendar after selecting date range
      setTimeout(() => setShowEditCalendar(false), 500);
    }
  };

  // Format date range for trip info card
  // Prefer stored dates, fallback to calculated dates from matches
  const formatDateRange = () => {
    // First check if trip has stored dates
    if (itinerary?.startDate && itinerary?.endDate) {
      const start = new Date(itinerary.startDate);
      const end = new Date(itinerary.endDate);
      
      if (start.toDateString() === end.toDateString()) {
        return start.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
      }
      
      const startStr = start.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
      return `${startStr}-${endStr}`;
    }
    
    // Fallback to calculating from matches
    if (!itinerary?.matches || itinerary.matches.length === 0) {
      return null;
    }
    
    const dates = itinerary.matches
      .map(m => new Date(m.date))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a - b);
    
    if (dates.length === 0) return null;
    
    const start = dates[0];
    const end = dates[dates.length - 1];
    
    if (start.toDateString() === end.toDateString()) {
      return start.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    }
    
    const startStr = start.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    return `${startStr}-${endStr}`;
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

  const handleAddRecommendationToTrip = async (recommendation) => {
    try {
      await addRecommendationToTrip(recommendation, addMatchToItinerary);
    } catch (err) {
      console.error('Error adding recommendation to trip:', err);
      Alert.alert('Error', 'Failed to add match to trip');
    }
  };

  const handleDismissRecommendation = async (recommendation) => {
    try {
      await dismissRecommendation(recommendation);
    } catch (err) {
      console.error('Error dismissing recommendation:', err);
      Alert.alert('Error', 'Failed to dismiss recommendation');
    }
  };

  const handleMatchPress = (match) => {
    // Don't allow match selection for past trips
    if (isPastTrip) return;
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
    
    // Recommendations are now in a separate collapsible section, not in the flat list
    
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
          onPress={isPastTrip ? undefined : () => handleMatchPress(item)}
          variant="default"
          showHeart={!isPastTrip}
          showAttendancePrompt={true}
          showResults={shouldShowResults}
          style={styles.matchCardStyle}
        />
        {/* Show loading indicator for score fetching */}
        {scoresLoading && isPast && !hasScore && (
          <View style={styles.scoreLoadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
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

  // Carousel component for recommendations (shows all recommendations in horizontal scroll)
  const RecommendationsCarousel = React.memo(({ recommendations, renderRecommendationItem }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollViewRef = useRef(null);
    const screenWidth = Dimensions.get('window').width;
    const cardWidth = screenWidth - (spacing.lg * 2) - spacing.md; // Account for padding and spacing

    const handleScroll = (event) => {
      const scrollPosition = event.nativeEvent.contentOffset.x;
      const index = Math.round(scrollPosition / cardWidth);
      setCurrentIndex(Math.min(index, recommendations.length - 1));
    };

    if (recommendations.length === 0) {
      return (
        <View style={styles.emptyRecommendationsContainer}>
          <Text style={styles.emptyRecommendationsText}>No recommendations available</Text>
        </View>
      );
    }

    return (
      <View style={styles.carouselContainer}>
        {/* Counter showing current position */}
        {recommendations.length > 1 && (
          <View style={styles.carouselCounter}>
            <Text style={styles.carouselCounterText}>
              {currentIndex + 1} of {recommendations.length}
            </Text>
          </View>
        )}

        {/* Horizontal scrollable carousel */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.carouselContent}
          style={styles.carouselScrollView}
          snapToInterval={cardWidth + spacing.md}
          decelerationRate="fast"
        >
          {recommendations.map((recommendation, index) => (
            <View key={recommendation.matchId || index} style={[styles.carouselItem, { width: cardWidth }]}>
              {renderRecommendationItem({ item: recommendation })}
            </View>
          ))}
        </ScrollView>

        {/* Pagination indicators */}
        {recommendations.length > 1 && (
          <View style={styles.carouselPagination}>
            {recommendations.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.carouselDot,
                  index === currentIndex && styles.carouselDotActive
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  });

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="sports-soccer" size={64} color={colors.text.light} />
      <Text style={styles.emptyStateTitle}>No matches in this itinerary</Text>
      <Text style={styles.emptyStateSubtitle}>
        Start adding matches to build your football trip!
      </Text>
      <TouchableOpacity
        style={styles.addMatchesButton}
        onPress={() => navigation.navigate('SearchTab')}
      >
        <Icon name="search" size={20} color={colors.onPrimary} />
        <Text style={styles.addMatchesButtonText}>Search for matches</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading itinerary...</Text>
      </View>
    );
  }

  if (!itineraryId) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={64} color={colors.error} />
        <Text style={styles.errorTitle}>Invalid Itinerary</Text>
        <Text style={styles.errorSubtitle}>
          No itinerary ID provided. Please go back and try again.
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

  if (!itinerary) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={64} color={colors.error} />
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
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with back button and settings */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButtonIcon}
          onPress={() => {
            // For past trips navigated from AccountTab, go back to AccountTab
            if (fromAccountTab && isPastTrip) {
              navigation.navigate('AccountTab');
            } else {
              navigation.goBack();
            }
          }}
        >
          <MaterialIcons name="arrow-back" size={16} color={colors.text.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setModalVisible(true)}
          >
            <MaterialIcons name="more-vert" size={16} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Trip Info Card */}
        <View style={styles.tripInfoCard}>
          <View style={styles.tripInfoHeader}>
            <Text style={styles.tripInfoTitle}>{itinerary.name}</Text>
            {formatDateRange() && (
              isPastTrip ? (
                <View style={styles.dateRangeContainer}>
                  <MaterialIcons name="calendar-today" size={21} color="rgba(0, 0, 0, 0.5)" />
                  <Text style={styles.dateRangeText}>{formatDateRange()}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.dateRangeContainer}
                  onPress={() => {
                    // Initialize edit dates from current trip dates or calculated dates
                    if (itinerary?.startDate && itinerary?.endDate) {
                      const start = new Date(itinerary.startDate).toISOString().split('T')[0];
                      const end = new Date(itinerary.endDate).toISOString().split('T')[0];
                      setEditStartDate(start);
                      setEditEndDate(end);
                      const dateRange = createDateRange(start, end);
                      const dates = {};
                      dateRange.forEach((dateStr, index) => {
                        dates[dateStr] = {
                          selected: true,
                          startingDay: index === 0,
                          endingDay: index === dateRange.length - 1,
                        };
                      });
                      setEditSelectedDates(dates);
                    } else if (itinerary?.matches && itinerary.matches.length > 0) {
                      const dates = itinerary.matches
                        .map(m => new Date(m.date))
                        .filter(d => !isNaN(d.getTime()))
                        .sort((a, b) => a - b);
                      if (dates.length > 0) {
                        const start = dates[0].toISOString().split('T')[0];
                        const end = dates[dates.length - 1].toISOString().split('T')[0];
                        setEditStartDate(start);
                        setEditEndDate(end);
                        const dateRange = createDateRange(start, end);
                        const datesObj = {};
                        dateRange.forEach((dateStr, index) => {
                          datesObj[dateStr] = {
                            selected: true,
                            startingDay: index === 0,
                            endingDay: index === dateRange.length - 1,
                          };
                        });
                        setEditSelectedDates(datesObj);
                      }
                    }
                    setEditDatesModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="calendar-today" size={21} color="rgba(0, 0, 0, 0.5)" />
                  <Text style={styles.dateRangeText}>{formatDateRange()}</Text>
                  <MaterialIcons name="edit" size={16} color="rgba(0, 0, 0, 0.3)" style={styles.editIcon} />
                </TouchableOpacity>
              )
            )}
          </View>
          
          {/* User section - placeholder for now */}
          <View style={styles.userSection}>
            <View style={styles.userInfo}>
              <View style={styles.profileIcon}>
                <Text style={styles.profileIconText}>A</Text>
              </View>
              <Text style={styles.userName}>Andrew Aluko</Text>
            </View>
            <TouchableOpacity style={styles.followButton}>
              <Text style={styles.followButtonText}>Follow</Text>
            </TouchableOpacity>
          </View>
          
          {/* Description - Editable inline (read-only for past trips) */}
          {isPastTrip ? (
            <View>
              {descriptionText ? (
                <Text style={styles.tripDescription}>{descriptionText}</Text>
              ) : (
                <Text style={styles.descriptionPlaceholder}>No description</Text>
              )}
            </View>
          ) : isEditingDescription ? (
            <View>
              <TextInput
                ref={descriptionInputRef}
                style={styles.descriptionInput}
                multiline
                value={descriptionText}
                onChangeText={setDescriptionText}
                placeholder="Describe your trip..."
                placeholderTextColor={colors.text.light}
                autoFocus
              />
              <View style={styles.descriptionActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setDescriptionText(itinerary.description || '');
                    setIsEditingDescription(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveDescription}
                  disabled={isSavingDescription}
                >
                  {isSavingDescription ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setIsEditingDescription(true)}
              activeOpacity={0.7}
            >
              {descriptionText ? (
                <Text style={styles.tripDescription}>{descriptionText}</Text>
              ) : (
                <Text style={styles.descriptionPlaceholder}>Tap to add a description...</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Matches Section - Collapsible */}
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setMatchesExpanded(!matchesExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>Matches</Text>
            <MaterialIcons
              name={matchesExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
              size={24}
              color={colors.text.primary}
            />
          </TouchableOpacity>
          
          {matchesExpanded && (
            <View style={styles.sectionContent}>
              {itinerary.matches && itinerary.matches.length > 0 ? (
                <View>
                  {flatListData.map((item, index) => {
                    if (item.type === 'header') {
                      return (
                        <View key={`header-${index}`} style={styles.dateHeader}>
                          <Text style={styles.dateHeaderText}>
                            {formatDateHeader(item.date)}
                          </Text>
                        </View>
                      );
                    } else {
                      return (
                        <View key={item.matchId || `match-${index}`}>
                          {renderMatchItem({ item })}
                        </View>
                      );
                    }
                  })}
                </View>
              ) : (
                renderEmptyState()
              )}
            </View>
          )}
        </View>

        {/* Recommendations Section - Collapsible (hidden for past trips) */}
        {!isPastTrip && (
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setRecommendationsExpanded(!recommendationsExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Recommended Matches</Text>
              <MaterialIcons
                name={recommendationsExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>
            
            {recommendationsExpanded && (
              <View style={styles.recommendationsContent}>
                {recommendationsLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.secondary} />
                    <Text style={styles.loadingText}>Loading recommendations...</Text>
                  </View>
                ) : recommendationsError ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{recommendationsError}</Text>
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={() => refetchRecommendations(true)}
                    >
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : recommendations.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No recommendations available</Text>
                  </View>
                ) : (
                  <RecommendationsCarousel
                    recommendations={recommendations}
                    renderRecommendationItem={renderRecommendationItem}
                  />
                )}
              </View>
            )}
          </View>
        )}

        {/* Notes Section - Collapsible */}
        <View 
          ref={notesSectionRef} 
          style={styles.sectionCard}
          onLayout={(event) => {
            const { y } = event.nativeEvent.layout;
            setNotesSectionY(y);
          }}
        >
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => {
              const newExpanded = !notesExpanded;
              setNotesExpanded(newExpanded);
              // Scroll to notes section when expanding
              if (newExpanded && notesSectionY > 0) {
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({
                    y: notesSectionY - 50, // Small offset to show some space above
                    animated: true,
                  });
                }, 100);
              } else if (newExpanded) {
                // Fallback: scroll to end if position not yet measured
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>Notes</Text>
            <MaterialIcons
              name={notesExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
              size={24}
              color={colors.text.primary}
            />
          </TouchableOpacity>
          
          {notesExpanded && (
            <View style={styles.notesContent}>
              {isPastTrip ? (
                <View>
                  {notesText ? (
                    <Text style={styles.notesText}>{notesText}</Text>
                  ) : (
                    <Text style={styles.notesPlaceholder}>No notes</Text>
                  )}
                </View>
              ) : isEditingNotes ? (
                <View>
                  <TextInput
                    ref={notesInputRef}
                    style={styles.notesInput}
                    multiline
                    value={notesText}
                    onChangeText={setNotesText}
                    placeholder="Add notes about your trip..."
                    placeholderTextColor={colors.text.light}
                    autoFocus
                    onFocus={() => {
                      // Scroll to input after a short delay to ensure it's rendered
                      // Use the notes section position + estimated input offset
                      setTimeout(() => {
                        if (notesSectionY > 0) {
                          scrollViewRef.current?.scrollTo({
                            y: notesSectionY + 100, // Approximate position of input within section
                            animated: true,
                          });
                        } else {
                          // Fallback: scroll to end if position not yet measured
                          scrollViewRef.current?.scrollToEnd({ animated: true });
                        }
                      }, 100);
                    }}
                  />
                  <View style={styles.notesActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setNotesText(itinerary.notes || '');
                        setIsEditingNotes(false);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={handleSaveNotes}
                      disabled={isSavingNotes}
                    >
                      {isSavingNotes ? (
                        <ActivityIndicator size="small" color={colors.onPrimary} />
                      ) : (
                        <Text style={styles.saveButtonText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsEditingNotes(true)}
                  activeOpacity={0.7}
                >
                  {notesText ? (
                    <Text style={styles.notesText}>{notesText}</Text>
                  ) : (
                    <Text style={styles.notesPlaceholder}>Tap to add notes...</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Home Bases Section - Below Notes */}
        <HomeBaseSection
          tripId={itineraryId}
          homeBases={itinerary?.homeBases || []}
          isPastTrip={isPastTrip}
          onHomeBasesUpdated={async () => {
            // Refresh itinerary to get updated home bases
            try {
              const response = await apiService.getTripById(itineraryId);
              const tripData = response.trip || response.data;
              if (response.success && tripData) {
                setItinerary(tripData);
              }
            } catch (error) {
              console.error('Error refreshing itinerary:', error);
            }
          }}
          tripDateRange={
            itinerary?.matches && itinerary.matches.length > 0
              ? {
                  from: new Date(Math.min(...itinerary.matches.map(m => new Date(m.date)))),
                  to: new Date(Math.max(...itinerary.matches.map(m => new Date(m.date))))
                }
              : null
          }
        />

        {/* Flights Section - Below Home Bases (hidden for past trips) */}
        {!isPastTrip && (
          <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Flights</Text>
            <View style={styles.sectionHeaderRight}>
              {itinerary?.flights && itinerary.flights.length > 0 && (
                <Text style={styles.flightCount}>
                  {itinerary.flights.length} {itinerary.flights.length === 1 ? 'flight' : 'flights'}
                </Text>
              )}
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setAddFlightModalVisible(true)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="add" size={20} color={colors.primary} />
                <Text style={styles.addButtonText}>Add Flight</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {itinerary?.flights && Array.isArray(itinerary.flights) && itinerary.flights.length > 0 ? (
            <View style={styles.flightsList}>
              {getSortedFlights().map((flight) => {
                const flightId = flight._id || flight.id || `flight-${flight.flightNumber}-${flight.departure?.date}`;
                const departureTime = flight.departure?.time || '--:--';
                const arrivalTime = flight.arrival?.time || '--:--';
                const departureDate = flight.departure?.date || '';
                const arrivalDate = flight.arrival?.date || '';
                const airlineCode = flight.airline?.code || '';
                const airlineName = flight.airline?.name || airlineCode;
                const duration = flight.duration || 0;
                const stops = flight.stops || 0;
                
                // Format duration
                const formatDuration = (minutes) => {
                  if (!minutes) return '--';
                  const hours = Math.floor(minutes / 60);
                  const mins = minutes % 60;
                  return `${hours}h ${mins}m`;
                };
                
                // Format date
                const formatDate = (dateStr) => {
                  if (!dateStr) return '';
                  const [year, month, day] = dateStr.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                };
                
                // Get airline logo URL
                const getAirlineLogoUrl = (code) => {
                  if (!code) return null;
                  return `https://www.gstatic.com/flights/airline_logos/70px/${code.toUpperCase()}.png`;
                };
                
                const airlineLogoUrl = airlineCode ? getAirlineLogoUrl(airlineCode) : null;
                
                // Use a stable key that includes the flight ID
                const flightKey = `flight-${flightId}-${flight.departure?.date || ''}-${flight.flightNumber || ''}`;
                
                return (
                  <View key={flightKey} style={styles.flightCard}>
                    <View style={styles.flightCardHeader}>
                      <View style={styles.flightCardHeaderLeft}>
                        <View style={styles.flightHeaderRow}>
                          {airlineLogoUrl && (
                            <Image
                              source={{ uri: airlineLogoUrl }}
                              style={styles.flightAirlineLogo}
                              resizeMode="contain"
                            />
                          )}
                          <View style={styles.flightHeaderText}>
                            <Text style={styles.flightNumber}>{flight.flightNumber}</Text>
                            <Text style={styles.flightAirline}>{airlineName}</Text>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteFlight(flightId)}
                        disabled={deletingFlightId === flightId}
                        style={styles.deleteFlightButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        {deletingFlightId === flightId ? (
                          <ActivityIndicator size="small" color={colors.error} />
                        ) : (
                          <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                        )}
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.flightRoute}>
                      <View style={styles.flightSegment}>
                        <Text style={styles.flightTime}>{departureTime}</Text>
                        <Text style={styles.flightAirport}>{flight.departure?.airport?.code || 'N/A'}</Text>
                        <Text style={styles.flightDate}>{formatDate(departureDate)}</Text>
                      </View>
                      
                      <View style={styles.flightDuration}>
                        <View style={styles.flightDurationLine} />
                        <Text style={styles.flightDurationText}>{formatDuration(duration)}</Text>
                        {stops > 0 && (
                          <Text style={styles.flightStopsText}>
                            {stops} stop{stops > 1 ? 's' : ''}
                          </Text>
                        )}
                      </View>
                      
                      <View style={styles.flightSegment}>
                        <Text style={styles.flightTime}>{arrivalTime}</Text>
                        <Text style={styles.flightAirport}>{flight.arrival?.airport?.code || 'N/A'}</Text>
                        <Text style={styles.flightDate}>{formatDate(arrivalDate)}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyFlightsContainer}>
              <MaterialIcons name="flight" size={48} color={colors.text.light} />
              <Text style={styles.emptyFlightsText}>No flights added yet</Text>
              <Text style={styles.emptyFlightsSubtext}>Add your booked flights to track your trip</Text>
            </View>
          )}
        </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Add Flight Modal */}
      <AddFlightModal
        visible={addFlightModalVisible}
        onClose={() => setAddFlightModalVisible(false)}
        tripId={itinerary?.id || itinerary?._id}
        onFlightAdded={handleFlightAdded}
      />

      {/* Map Button - Floating at bottom */}
      <TouchableOpacity
        style={styles.mapButton}
        onPress={() => navigation.navigate('ItineraryMap', { itineraryId: itinerary.id || itinerary._id })}
        activeOpacity={0.8}
      >
        <Icon name="map" size={20} color={colors.card} style={styles.mapButtonIcon} />
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
                <Icon name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <TouchableOpacity style={styles.modalOption}>
                <View style={styles.modalOptionLeft}>
                  <Icon name="share" size={20} color={colors.text.secondary} />
                  <Text style={styles.modalOptionText}>Share Itinerary</Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.text.light} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalOption}>
                <View style={styles.modalOptionLeft}>
                  <Icon name="edit" size={20} color={colors.text.secondary} />
                  <Text style={styles.modalOptionText}>Rename</Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.text.light} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalOption}>
                <View style={styles.modalOptionLeft}>
                  <Icon name="home" size={20} color={colors.text.secondary} />
                  <Text style={styles.modalOptionText}>Homebase</Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.text.light} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalOption}
                onPress={() => {
                  setModalVisible(false);
                  Alert.alert(
                    'Delete Trip',
                    `Are you sure you want to delete "${itinerary.name}"? This action cannot be undone.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await deleteItinerary(itinerary.id || itinerary._id);
                            // Navigate back to trips list after successful deletion
                            navigation.goBack();
                          } catch (error) {
                            console.error('Error deleting trip:', error);
                            Alert.alert('Error', 'Failed to delete trip. Please try again.');
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <View style={styles.modalOptionLeft}>
                  <Icon name="delete" size={20} color={colors.text.secondary} />
                  <Text style={styles.modalOptionText}>Delete</Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.text.light} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Match Planning Modal (hidden for past trips) */}
      {!isPastTrip && (
        <MatchPlanningModal
          visible={planningModalVisible}
          onClose={handleClosePlanningModal}
          match={selectedMatch}
          tripId={itineraryId}
          homeBases={itinerary?.homeBases || []}
          onPlanningUpdated={handlePlanningUpdated}
        />
      )}

      {/* Edit Dates Modal */}
      <Modal
        visible={editDatesModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditDatesModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.editDatesModalContainer}
        >
          <View style={styles.editDatesModalHeader}>
            <Text style={styles.editDatesModalTitle}>Edit Trip Dates</Text>
            <TouchableOpacity
              onPress={() => setEditDatesModalVisible(false)}
              style={styles.editDatesModalCloseButton}
            >
              <Icon name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.editDatesModalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.editDatesForm}>
              <Text style={styles.editDatesLabel}>Trip Dates</Text>
              <TouchableOpacity
                style={styles.editDateButton}
                onPress={() => setShowEditCalendar(!showEditCalendar)}
              >
                <Text style={styles.editDateButtonText}>
                  {editStartDate && editEndDate
                    ? `${formatDisplayDate(editStartDate)} - ${formatDisplayDate(editEndDate)}`
                    : editStartDate
                    ? `${formatDisplayDate(editStartDate)} - Select end date`
                    : 'Select dates'}
                </Text>
              </TouchableOpacity>
              
              {showEditCalendar && (
                <View style={styles.editCalendarContainer}>
                  <Calendar
                    onDayPress={onEditDayPress}
                    markedDates={editSelectedDates}
                    markingType="period"
                    minDate={new Date().toISOString().split('T')[0]}
                    theme={{
                      selectedDayBackgroundColor: colors.primary,
                      selectedDayTextColor: '#ffffff',
                      todayTextColor: colors.primary,
                      dayTextColor: '#2d4150',
                      textDisabledColor: '#d9e1e8',
                      arrowColor: colors.primary,
                      monthTextColor: '#2d4150',
                      indicatorColor: colors.primary,
                      textDayFontWeight: '300',
                      textMonthFontWeight: 'bold',
                      textDayHeaderFontWeight: '300',
                      textDayFontSize: 16,
                      textMonthFontSize: 16,
                      textDayHeaderFontSize: 13,
                      calendarBackground: colors.card,
                    }}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.editDatesSaveButton,
                  (!editStartDate || !editEndDate || isSavingDates) && styles.editDatesSaveButtonDisabled
                ]}
                onPress={handleSaveDates}
                disabled={!editStartDate || !editEndDate || isSavingDates}
              >
                {isSavingDates ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.editDatesSaveButtonText}>Save Dates</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.lg, // SafeAreaView handles safe area, this is additional spacing
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.small,
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
    color: colors.text.primary,
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  headerTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  listContainer: {
    padding: spacing.md,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  matchCardStyle: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl * 1.25,
  },
  emptyStateTitle: {
    ...typography.h3,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    ...typography.body,
    color: colors.text.light,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  addMatchesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + spacing.xs,
    borderRadius: borderRadius.sm,
  },
  addMatchesButtonText: {
    color: colors.onPrimary,
    ...typography.body,
    fontWeight: '500',
    marginLeft: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    minHeight: 100,
  },
  loadingText: {
    marginTop: spacing.md,
    ...typography.body,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl * 1.25,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  retryButtonText: {
    ...typography.body,
    color: colors.onPrimary,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  errorTitle: {
    ...typography.h3,
    color: colors.error,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  errorSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + spacing.xs,
    borderRadius: borderRadius.sm,
  },
  backButtonText: {
    color: colors.onPrimary,
    ...typography.body,
    fontWeight: '500',
  },
  mapButton: {
    position: 'absolute',
    bottom: 30,
    left: '50%',
    transform: [{ translateX: -50 }],
    backgroundColor: colors.text.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.xs,
    ...shadows.small,
    // Make button even smaller and perfectly centered like Airbnb
    width: 'auto',
    minWidth: 80,
    maxWidth: 140,
  },
  mapButtonIcon: {
    marginRight: spacing.xs,
    fontSize: 14,
  },
  mapButtonText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: '600',
  },
  dateHeader: {
    paddingVertical: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 44, // Ensure minimum touch target size
  },
  dateHeaderText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  moreButton: {
    padding: spacing.sm,
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
    zIndex: zIndex.modal, // High z-index to be above map button
  },
  modalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '70%', // Adjust as needed
    ...shadows.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md + spacing.xs,
  },
  modalTitle: {
    ...typography.h2,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalCloseButton: {
    padding: spacing.xs + spacing.xs / 2,
  },
  modalContent: {
    marginTop: spacing.sm + spacing.xs,
  },
  modalText: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.sm + spacing.xs,
    lineHeight: 22,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.sm + spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOptionText: {
    marginLeft: spacing.sm + spacing.xs,
    ...typography.body,
    color: colors.text.primary,
  },
  // Recommendation styles
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
    flexWrap: 'wrap',
  },
  recommendationsHeaderText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  recommendationsCountChip: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    marginLeft: spacing.sm,
  },
  recommendationsCountText: {
    ...typography.caption,
    color: colors.onSecondary,
    fontWeight: '600',
  },
  recommendationItem: {
    marginBottom: spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  recommendationsContent: {
    paddingTop: spacing.md,
  },
  carouselContainer: {
    marginBottom: spacing.lg,
  },
  carouselCounter: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  carouselCounterText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  carouselScrollView: {
    marginHorizontal: -spacing.lg,
  },
  carouselContent: {
    paddingHorizontal: spacing.lg,
  },
  carouselItem: {
    marginRight: spacing.md,
  },
  carouselPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  carouselDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  carouselDotActive: {
    backgroundColor: colors.secondary,
    width: 24,
  },
  recommendationInfo: {
    backgroundColor: colors.card,
    padding: spacing.sm + spacing.xs,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  recommendationReason: {
    marginBottom: spacing.sm + spacing.xs,
  },
  recommendationReasonText: {
    ...typography.bodySmall,
    color: colors.secondary,
    fontStyle: 'italic',
  },
  recommendationActions: {
    alignItems: 'center',
  },
  dismissRecommendationButton: {
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.xs,
  },
  dismissRecommendationButtonText: {
    color: colors.text.secondary,
    ...typography.bodySmall,
    fontWeight: '500',
  },
  scoreLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + spacing.xs,
    backgroundColor: colors.status.attendancePromptBg,
    borderRadius: borderRadius.xs,
    marginTop: spacing.sm,
  },
  scoreLoadingText: {
    ...typography.caption,
    color: colors.primary,
    marginLeft: spacing.sm,
    fontWeight: '500',
  },
  // New styles for redesigned trip overview
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButtonIcon: {
    padding: spacing.xs,
    width: 25,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingsButton: {
    padding: spacing.xs,
    width: 25,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  tripInfoCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  tripInfoHeader: {
    gap: spacing.sm + spacing.xs,
  },
  tripInfoTitle: {
    ...typography.h1,
    fontWeight: '700',
    fontSize: 24,
    color: colors.text.primary,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 1,
  },
  dateRangeText: {
    ...typography.caption,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  editIcon: {
    marginLeft: spacing.xs,
  },
  userSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0, 0, 0, 0.5)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#d9d9d9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIconText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text.primary,
  },
  userName: {
    ...typography.body,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  followButton: {
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    minWidth: 66,
    alignItems: 'center',
  },
  followButtonText: {
    ...typography.caption,
    color: colors.text.primary,
  },
  tripDescription: {
    ...typography.caption,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  descriptionInput: {
    ...typography.caption,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  descriptionPlaceholder: {
    ...typography.caption,
    color: colors.text.light,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  descriptionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    ...typography.h1,
    fontWeight: '500',
    fontSize: 24,
    color: colors.text.primary,
  },
  sectionContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  notesContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  notesInput: {
    ...typography.caption,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  notesText: {
    ...typography.caption,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
  notesPlaceholder: {
    ...typography.caption,
    color: colors.text.light,
    paddingVertical: spacing.sm,
    fontStyle: 'italic',
  },
  notesActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelButtonText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    ...typography.caption,
    color: colors.onPrimary,
    fontWeight: '500',
  },
  // Flights Section Styles
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flightCount: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },
  flightsList: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  flightCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flightCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  flightCardHeaderLeft: {
    flex: 1,
  },
  flightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flightAirlineLogo: {
    width: 40,
    height: 40,
  },
  flightHeaderText: {
    flex: 1,
  },
  flightNumber: {
    ...typography.h4,
    color: colors.text.primary,
    fontFamily: typography.fontFamily,
    marginBottom: spacing.xs,
  },
  flightAirline: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  deleteFlightButton: {
    padding: spacing.xs,
  },
  flightRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flightSegment: {
    flex: 1,
    alignItems: 'center',
  },
  flightTime: {
    ...typography.h3,
    color: colors.text.primary,
    fontFamily: typography.fontFamily,
    marginBottom: spacing.xs,
  },
  flightAirport: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  flightDate: {
    ...typography.caption,
    color: colors.text.light,
  },
  flightDuration: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  flightDurationLine: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  flightDurationText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  flightStopsText: {
    ...typography.caption,
    color: colors.text.light,
    marginTop: spacing.xs,
  },
  emptyFlightsContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyFlightsText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyFlightsSubtext: {
    ...typography.caption,
    color: colors.text.light,
  },
  emptyRecommendationsContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyRecommendationsText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  // Edit Dates Modal styles
  editDatesModalContainer: {
    flex: 1,
    backgroundColor: colors.card,
  },
  editDatesModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editDatesModalTitle: {
    ...typography.h3,
    fontWeight: '600',
    color: colors.text.primary,
  },
  editDatesModalCloseButton: {
    padding: spacing.xs + 1,
  },
  editDatesModalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  editDatesForm: {
    flex: 1,
  },
  editDatesLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  editDateButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    backgroundColor: colors.cardGrey,
    marginBottom: spacing.md,
  },
  editDateButtonText: {
    ...typography.body,
    color: colors.text.primary,
  },
  editCalendarContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    ...shadows.small,
  },
  editDatesSaveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md + spacing.xs,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  editDatesSaveButtonDisabled: {
    backgroundColor: colors.interactive.disabled,
  },
  editDatesSaveButtonText: {
    color: colors.onPrimary,
    ...typography.body,
    fontWeight: '600',
  },
});

export default TripOverviewScreen;

