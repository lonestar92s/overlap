import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ApiService from '../services/api';

const AttendedMatchesScreen = ({ navigation }) => {
  const [attendedMatches, setAttendedMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAttendedMatches();
  }, []);

  const loadAttendedMatches = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getUserAttendedMatches();
      if (response.success) {
        setAttendedMatches(response.matches || []);
      } else {
        Alert.alert('Error', response.message || 'Failed to load attended matches');
      }
    } catch (error) {
      console.error('Error loading attended matches:', error);
      Alert.alert('Error', 'Failed to load attended matches');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAttendedMatches();
    setRefreshing(false);
  };

  const handleRemoveMatch = async (matchId) => {
    Alert.alert(
      'Remove Match',
      'Are you sure you want to remove this match from your attended matches?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ApiService.removeAttendedMatch(matchId);
              if (response.success) {
                setAttendedMatches(prev => 
                  prev.filter(match => match.matchId !== matchId)
                );
              } else {
                Alert.alert('Error', response.message || 'Failed to remove match');
              }
            } catch (error) {
              console.error('Error removing match:', error);
              Alert.alert('Error', 'Failed to remove match');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderMatch = ({ item }) => (
    <View style={styles.matchCard}>
      <View style={styles.matchHeader}>
        <View style={styles.dateContainer}>
          <Icon name="event" size={16} color="#666" />
          <Text style={styles.dateText}>{formatDate(item.date)}</Text>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveMatch(item.matchId)}
        >
          <Icon name="close" size={20} color="#f44336" />
        </TouchableOpacity>
      </View>

      <View style={styles.teamsContainer}>
        <View style={styles.teamContainer}>
          {item.homeTeam?.logo && (
            <Image 
              source={{ uri: item.homeTeam.logo }} 
              style={styles.teamLogo}
              resizeMode="contain"
            />
          )}
          <Text style={styles.teamName}>{item.homeTeam?.name || 'Unknown'}</Text>
        </View>

        <View style={styles.vsContainer}>
          <Text style={styles.vsText}>VS</Text>
          {item.userScore && (
            <Text style={styles.userScore}>{item.userScore}</Text>
          )}
          {item.apiMatchData?.officialScore && (
            <Text style={styles.officialScore}>
              Official: {item.apiMatchData.officialScore}
            </Text>
          )}
        </View>

        <View style={styles.teamContainer}>
          <Text style={styles.teamName}>{item.awayTeam?.name || 'Unknown'}</Text>
          {item.awayTeam?.logo && (
            <Image 
              source={{ uri: item.awayTeam.logo }} 
              style={styles.teamLogo}
              resizeMode="contain"
            />
          )}
        </View>
      </View>

      <View style={styles.matchDetails}>
        <View style={styles.venueContainer}>
          <Icon name="location-on" size={14} color="#666" />
          <Text style={styles.venueText}>
            {item.venue?.name || 'Unknown Venue'}
            {item.venue?.city && ` • ${item.venue.city}`}
          </Text>
        </View>

        {item.competition && (
          <View style={styles.competitionContainer}>
            <Icon name="emoji-events" size={14} color="#666" />
            <Text style={styles.competitionText}>{item.competition}</Text>
          </View>
        )}

        {item.userNotes && (
          <View style={styles.notesContainer}>
            <Icon name="note" size={14} color="#666" />
            <Text style={styles.notesText}>{item.userNotes}</Text>
          </View>
        )}
      </View>

      <View style={styles.attendedDateContainer}>
        <Icon name="check-circle" size={14} color="#4caf50" />
        <Text style={styles.attendedDateText}>
          Attended on {formatDate(item.attendedDate)}
        </Text>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="sports-soccer" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Attended Matches</Text>
      <Text style={styles.emptyMessage}>
        Matches you attend will appear here. Start by saving matches to your trips!
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>Loading attended matches...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attended Matches</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={attendedMatches}
        renderItem={renderMatch}
        keyExtractor={(item) => item.matchId}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#1976d2']}
            tintColor="#1976d2"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    width: 40,
  },
  listContainer: {
    padding: 16,
  },
  matchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogo: {
    width: 32,
    height: 32,
    marginBottom: 8,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  vsContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  userScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginTop: 4,
  },
  officialScore: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  matchDetails: {
    marginBottom: 12,
  },
  venueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  venueText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    flex: 1,
  },
  competitionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  competitionText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notesText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    flex: 1,
    fontStyle: 'italic',
  },
  attendedDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  attendedDateText: {
    fontSize: 12,
    color: '#4caf50',
    marginLeft: 6,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 24,
  },
});

export default AttendedMatchesScreen;
