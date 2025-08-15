import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useItineraries } from '../contexts/ItineraryContext';
import ItineraryModal from './ItineraryModal';

const HeartButton = ({ matchId, fixtureId, matchData, size = 24, style }) => {
  const { isMatchInItinerary, removeMatchFromItinerary, getItinerariesForMatch } = useItineraries();
  const [showItineraryModal, setShowItineraryModal] = useState(false);
  
  // Get the most reliable match ID from multiple possible sources
  const reliableMatchId = matchId || fixtureId || matchData?.id || matchData?.fixture?.id;
  
  const isSaved = isMatchInItinerary(reliableMatchId);
  
  // Debug logging for heart state
  console.log('💖 HeartButton render:', { 
    matchId, 
    fixtureId, 
    reliableMatchId,
    isSaved, 
    timestamp: Date.now() 
  });
  
  const handlePress = async () => {
    console.log('💖 Heart button pressed for match:', { matchId, reliableMatchId, isSaved });
    console.log('💖 COMPLETE MATCH DATA in HeartButton:', JSON.stringify(matchData, null, 2));
    
    // Light haptic feedback for button press
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (isSaved) {
      // Match is already saved - remove it from the itinerary
      try {
        // Find which itinerary contains this match
        const itineraries = getItinerariesForMatch(reliableMatchId);
        
        if (itineraries.length > 0) {
          // Remove from the first itinerary that contains it
          const itineraryId = itineraries[0].id || itineraries[0]._id;
          await removeMatchFromItinerary(itineraryId, reliableMatchId);
          
          // Success haptic feedback for removal
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          console.log('🗑️ Match removed from itinerary');
        }
      } catch (error) {
        console.error('Error removing match from itinerary:', error);
        
        // Error haptic feedback
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } else {
      // Match is not saved - open modal to add it
      setShowItineraryModal(true);
    }
  };

  const handleSave = () => {
    // This will be called when a match is successfully saved to an itinerary
    console.log('✅ Match saved to itinerary');
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.heartButton,
          { width: size, height: size },
          style
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Icon
          name={isSaved ? 'favorite' : 'favorite-border'}
          size={size * 0.8}
          color={isSaved ? '#FF385C' : '#999'}
          style={styles.heartIcon}
        />
      </TouchableOpacity>

      <ItineraryModal
        visible={showItineraryModal}
        onClose={() => setShowItineraryModal(false)}
        matchData={matchData}
        onSave={handleSave}
      />
    </>
  );
};

const styles = StyleSheet.create({
  heartButton: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  heartIcon: {
    textAlign: 'center',
  },
});

export default HeartButton;
 