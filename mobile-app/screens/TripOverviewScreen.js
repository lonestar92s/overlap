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
import { Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import MatchCard from '../components/MatchCard';
import HeartButton from '../components/HeartButton';
import MatchPlanningModal from '../components/MatchPlanningModal';

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
  const { getItineraryById, updateMatchPlanning, updateItinerary } = useItineraries();
  const { itineraryId } = route.params;
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [planningModalVisible, setPlanningModalVisible] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (itineraryId) {
      const foundItinerary = getItineraryById(itineraryId);
      if (foundItinerary) {

        setItinerary(foundItinerary);
      }
      setLoading(false);
    }
  }, [itineraryId, getItineraryById]);

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
    
    return data;
  }, [groupedMatches]);

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
      venue: venueInfo
    };

    return (
      <View style={styles.matchCard}>
        <MatchCard
          match={transformedMatch}
          onPress={() => handleMatchPress(item)}
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
            } else {
              return renderMatchItem({ item });
            }
          }}
          keyExtractor={(item, index) => (item.type === 'header' ? `header-${index}` : item.matchId || `match-${index}`).toString()}
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

              <TouchableOpacity style={styles.modalOption} onPress={() => { setRenameModalVisible(true); setModalVisible(false); setNewName(itinerary.name); }}>
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

      {/* Rename Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRenameModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Rename Trip</Text>
                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setRenameModalVisible(false)}>
                  <Icon name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 8 }}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Enter new trip name"
                  style={styles.renameInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={async () => {
                    try {
                      if (!newName.trim()) return;
                      const updated = await updateItinerary(itineraryId, { name: newName.trim() });
                      setItinerary(updated);
                      setRenameModalVisible(false);
                    } catch (e) {
                      Alert.alert('Rename failed', e.message || 'Please try again');
                    }
                  }}
                />
                <TouchableOpacity
                  style={[styles.addMatchesButton, { backgroundColor: '#1976d2', marginTop: 12 }]}
                  onPress={async () => {
                    try {
                      if (!newName.trim()) return;
                      const updated = await updateItinerary(itineraryId, { name: newName.trim() });
                      setItinerary(updated);
                      setRenameModalVisible(false);
                    } catch (e) {
                      Alert.alert('Rename failed', e.message || 'Please try again');
                    }
                  }}
                >
                  <Icon name="check" size={20} color="#fff" style={styles.mapButtonIcon} />
                  <Text style={styles.mapButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
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
  renameInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
  },
});

export default TripOverviewScreen;

