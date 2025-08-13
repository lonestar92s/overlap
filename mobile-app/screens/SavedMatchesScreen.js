import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SavedMatchesContext } from '../contexts/SavedMatchesContext';
import MatchCard from '../components/MatchCard';
import { getMatchStatus } from '../utils/matchStatus';

const SavedMatchesScreen = ({ navigation }) => {
  const { savedMatches, removeSavedMatch } = useContext(SavedMatchesContext);
  const [filterType, setFilterType] = useState('all'); // 'all', 'upcoming', 'completed'

  // Filter matches based on selected type
  const getFilteredMatches = () => {
    if (filterType === 'all') return savedMatches;
    
    return savedMatches.filter(match => {
      const status = getMatchStatus(match);
      if (filterType === 'upcoming') return !status.isPast;
      if (filterType === 'completed') return status.isPast;
      return true;
    });
  };

  const filteredMatches = getFilteredMatches();

  const handleRemoveMatch = (matchId) => {
    Alert.alert(
      'Remove Match',
      'Are you sure you want to remove this match from your saved matches?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeSavedMatch(matchId) }
      ]
    );
  };

  const renderFilterButton = (type, label, icon) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filterType === type && styles.filterButtonActive
      ]}
      onPress={() => setFilterType(type)}
    >
      <Icon 
        name={icon} 
        size={16} 
        color={filterType === type ? '#fff' : '#666'} 
      />
      <Text style={[
        styles.filterButtonText,
        filterType === type && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderMatch = ({ item: match }) => (
    <View style={styles.matchContainer}>
      <MatchCard
        match={match}
        showHeart={false}
        showResults={true} // Show results for saved matches
        onPress={() => {
          // Navigate to match details or open modal
          console.log('Match pressed:', match.id);
        }}
      />
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveMatch(match.id)}
      >
        <Icon name="delete" size={20} color="#ff4444" />
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="favorite-border" size={64} color="#ccc" />
      <Text style={styles.emptyStateTitle}>No Saved Matches</Text>
      <Text style={styles.emptyStateSubtitle}>
        Save matches you're interested in to see them here
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Saved Matches</Text>
        <Text style={styles.subtitle}>
          {filteredMatches.length} match{filteredMatches.length !== 1 ? 'es' : ''}
        </Text>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {renderFilterButton('all', 'All', 'list')}
        {renderFilterButton('upcoming', 'Upcoming', 'schedule')}
        {renderFilterButton('completed', 'Completed', 'check-circle')}
      </View>

      {/* Matches List */}
      {filteredMatches.length > 0 ? (
        <FlatList
          data={filteredMatches}
          renderItem={renderMatch}
          keyExtractor={(item) => item.id?.toString() || item.fixture?.id?.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        renderEmptyState()
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
  },
  matchContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default SavedMatchesScreen;

