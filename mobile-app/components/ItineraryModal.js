import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useItineraries } from '../contexts/ItineraryContext';

const ItineraryModal = ({ visible, onClose, matchData, onSave }) => {
  const { itineraries, createItinerary, addMatchToItinerary } = useItineraries();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newItineraryName, setNewItineraryName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSaveToExisting = async (itineraryId) => {
    try {
      const matchInfo = formatMatchInfo();
      console.log('💾 Saving match to itinerary:', {
        itineraryId,
        matchInfo: JSON.stringify(matchInfo, null, 2)
      });
      await addMatchToItinerary(itineraryId, matchInfo);
      
      // Trigger success haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert('Success', 'Match added to itinerary!');
      onSave();
      onClose();
    } catch (error) {
      console.error('Error adding match to itinerary:', error);
      
      // Trigger error haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      Alert.alert('Error', 'Failed to add match to itinerary');
    }
  };

  const handleCreateNewItinerary = async () => {
    setIsCreating(true);
    try {
      const newItinerary = await createItinerary(
        newItineraryName.trim(),
        null, // destination
        null, // startDate
        null  // endDate
      );

      // Add the match to the new itinerary
      const matchInfo = formatMatchInfo();
      await addMatchToItinerary(newItinerary.id || newItinerary._id, matchInfo);
      
      // Trigger success haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert('Success', 'New itinerary created and match added!');
      onSave();
      onClose();
      
      // Reset form
      setNewItineraryName('');
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating itinerary:', error);
      
      // Trigger error haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      Alert.alert('Error', 'Failed to create itinerary');
    } finally {
      setIsCreating(false);
    }
  };

  const formatMatchInfo = () => {

    
    // Extract the fields that the backend API expects
    const matchId = matchData.id || matchData.fixture?.id;
    const homeTeamName = matchData.teams?.home?.name || matchData.homeTeam || 'Unknown';
    const awayTeamName = matchData.teams?.away?.name || matchData.awayTeam || 'Unknown';
    const homeTeamLogo = matchData.teams?.home?.logo || '';
    const awayTeamLogo = matchData.teams?.away?.logo || '';
    const league = matchData.league?.name || matchData.competition?.name || 'Unknown League';
    const venue = matchData.fixture?.venue?.name || matchData.venue?.name || 'Unknown Venue';
    const date = matchData.fixture?.date || matchData.date;
    
    // IMPORTANT: Save the complete venue object for map functionality
    const venueData = matchData.fixture?.venue || matchData.venue || {};
    

    
    // Return the format expected by the backend API
    // IMPORTANT: Match the exact Mongoose schema structure but enhance with venue data
    return {
      matchId,
      homeTeam: {
        name: homeTeamName,
        logo: homeTeamLogo
      },
      awayTeam: {
        name: awayTeamName,
        logo: awayTeamLogo
      },
      league,
      venue,  // Keep string for backend compatibility
      venueData: venueData,  // Add complete venue object for map functionality
      date: date ? new Date(date).toISOString() : new Date().toISOString()
    };
  };

  // Get match info for display
  const matchInfo = formatMatchInfo();
  
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Save to Itinerary</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Match Info */}
        <View style={styles.matchInfo}>
          <Text style={styles.matchTitle}>
            {matchInfo.homeTeam?.name || matchInfo.teams?.home?.name || 'Unknown'} vs {matchInfo.awayTeam?.name || matchInfo.teams?.away?.name || 'Unknown'}
          </Text>
          <Text style={styles.matchDetails}>
            {matchInfo.league || 'Unknown League'} • {matchInfo.venue || 'Unknown Venue'}
          </Text>
          <Text style={styles.matchDate}>
            {matchInfo.date ? new Date(matchInfo.date).toLocaleDateString() : 'TBD'}
          </Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Existing Itineraries */}
          {itineraries.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Save to existing itinerary</Text>
              {itineraries.map((itinerary) => (
                <TouchableOpacity
                  key={itinerary.id || itinerary._id}
                  style={styles.itineraryItem}
                  onPress={() => handleSaveToExisting(itinerary.id || itinerary._id)}
                >
                  <View style={styles.itineraryInfo}>
                    <Text style={styles.itineraryName}>{itinerary.name}</Text>
                    <Text style={styles.itineraryDestination}>{itinerary.destination}</Text>
                    <Text style={styles.itineraryDates}>
                      {itinerary.startDate && itinerary.endDate 
                        ? `${new Date(itinerary.startDate).toLocaleDateString()} - ${new Date(itinerary.endDate).toLocaleDateString()}`
                        : 'Dates TBD'
                      }
                    </Text>
                    <Text style={styles.matchCount}>
                      {itinerary.matches.length} match{itinerary.matches.length !== 1 ? 'es' : ''}
                    </Text>
                  </View>
                  <Icon name="add" size={24} color="#1976d2" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Create New Itinerary */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setShowCreateForm(!showCreateForm)}
            >
              <Icon 
                name={showCreateForm ? "expand-less" : "expand-more"} 
                size={24} 
                color="#1976d2" 
              />
              <Text style={styles.createButtonText}>Create new itinerary</Text>
            </TouchableOpacity>

            {showCreateForm && (
              <View style={styles.createForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Itinerary name (e.g., London Football Trip)"
                  placeholderTextColor="#666"
                  value={newItineraryName}
                  onChangeText={setNewItineraryName}
                />
                
                <TouchableOpacity
                  style={[
                    styles.saveButton, 
                    (!newItineraryName.trim() || isCreating) && styles.saveButtonDisabled
                  ]}
                  onPress={handleCreateNewItinerary}
                  disabled={!newItineraryName.trim() || isCreating}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Create & Save Match</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  matchInfo: {
    padding: 20,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  matchTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  matchDetails: {
    fontSize: 16,
    color: '#666',
    marginBottom: 3,
  },
  matchDate: {
    fontSize: 14,
    color: '#999',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  itineraryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    marginBottom: 10,
  },
  itineraryInfo: {
    flex: 1,
  },
  itineraryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  itineraryDestination: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  itineraryDates: {
    fontSize: 12,
    color: '#999',
    marginBottom: 3,
  },
  matchCount: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1976d2',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginLeft: 10,
  },
  createForm: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  saveButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ItineraryModal;
