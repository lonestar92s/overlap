import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSavedMatches } from '../contexts/SavedMatchesContext';

const HeartButton = ({ matchId, fixtureId, matchData, size = 24, style }) => {
  const { isMatchSaved, toggleSaveMatch, loading } = useSavedMatches();
  
  const isSaved = isMatchSaved(matchId);
  
  const handlePress = async () => {
    if (loading) return; // Prevent multiple taps while loading
    
    try {
      await toggleSaveMatch(matchId, fixtureId, matchData);
    } catch (error) {
      console.error('Error toggling save match:', error);
      // You could show a toast/alert here
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.heartButton,
        { width: size, height: size },
        style
      ]}
      onPress={handlePress}
      disabled={loading}
      activeOpacity={0.7}
    >
      <Icon
        name={isSaved ? 'favorite' : 'favorite-border'}
        size={size * 0.8}
        color={isSaved ? '#FF385C' : '#999'}
        style={styles.heartIcon}
      />
    </TouchableOpacity>
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