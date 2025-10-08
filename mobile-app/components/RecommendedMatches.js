import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';
import apiService from '../services/api';

const RecommendedMatches = ({ tripId, onMatchAdded }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [alternativeDatesVisible, setAlternativeDatesVisible] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);

  useEffect(() => {
    if (tripId) {
      fetchRecommendations();
    }
  }, [tripId]);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError('');
    
    try {
      const data = await apiService.getRecommendations(tripId);
      if (data.success) {
        setRecommendations(data.recommendations || []);
        
        // Track that user viewed recommendations
        data.recommendations?.forEach(rec => {
          trackRecommendation(rec.matchId, 'viewed', tripId, rec.recommendedForDate, rec.score, rec.reason);
        });
      } else {
        setError('Failed to load recommendations');
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const trackRecommendation = async (matchId, action, tripId, recommendedDate, score, reason) => {
    try {
      await apiService.trackRecommendation(matchId, action, tripId, recommendedDate, score, reason);
    } catch (err) {
      console.error('Error tracking recommendation:', err);
    }
  };

  const handleAddToTrip = async (recommendation) => {
    try {
      // Track that user saved the recommendation
      await trackRecommendation(
        recommendation.matchId, 
        'saved', 
        tripId, 
        recommendation.recommendedForDate, 
        recommendation.score, 
        recommendation.reason
      );

      // Call the parent callback to add match to trip
      if (onMatchAdded) {
        await onMatchAdded(recommendation.match);
      }

      // Remove the recommendation from the list
      setRecommendations(prev => prev.filter(rec => rec.matchId !== recommendation.matchId));
      
    } catch (err) {
      console.error('Error adding match to trip:', err);
      setError('Failed to add match to trip');
    }
  };

  const handleDismiss = async (recommendation) => {
    try {
      // Track that user dismissed the recommendation
      await trackRecommendation(
        recommendation.matchId, 
        'dismissed', 
        tripId, 
        recommendation.recommendedForDate, 
        recommendation.score, 
        recommendation.reason
      );

      // Remove the recommendation from the list
      setRecommendations(prev => prev.filter(rec => rec.matchId !== recommendation.matchId));
      
    } catch (err) {
      console.error('Error dismissing recommendation:', err);
    }
  };

  const handleShowAlternativeDates = (recommendation) => {
    setSelectedRecommendation(recommendation);
    setAlternativeDatesVisible(true);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return colors.success;
    if (score >= 60) return colors.warning;
    return colors.textSecondary;
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Fair';
  };

  const formatMatchDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const renderRecommendationItem = ({ item: recommendation }) => {
    const { date, time } = formatMatchDateTime(recommendation.match.fixture.date);
    
    return (
      <View style={styles.recommendationCard}>
        <View style={styles.matchHeader}>
          <View style={styles.teamsContainer}>
            <Text style={styles.teamName}>{recommendation.match.teams.home.name}</Text>
            <Text style={styles.vsText}>vs</Text>
            <Text style={styles.teamName}>{recommendation.match.teams.away.name}</Text>
          </View>
          
          <View style={styles.scoreContainer}>
            <View style={[styles.scoreChip, { backgroundColor: getScoreColor(recommendation.score) }]}>
              <Text style={styles.scoreText}>{getScoreLabel(recommendation.score)}</Text>
            </View>
            <Text style={styles.scoreNumber}>{recommendation.score}</Text>
          </View>
        </View>

        <View style={styles.matchDetails}>
          <View style={styles.detailRow}>
            <Icon name="stadium" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>
              {recommendation.match.fixture.venue.name}, {recommendation.match.fixture.venue.city}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Icon name="access-time" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>{date} at {time}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Icon name="location-on" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>{recommendation.proximity}</Text>
          </View>
        </View>

        <View style={styles.reasonContainer}>
          <Text style={styles.reasonText}>💡 {recommendation.reason}</Text>
        </View>

        {recommendation.alternativeDates && recommendation.alternativeDates.length > 0 && (
          <TouchableOpacity
            style={styles.alternativeDatesButton}
            onPress={() => handleShowAlternativeDates(recommendation)}
          >
            <Icon name="calendar-today" size={16} color={colors.primary} />
            <Text style={styles.alternativeDatesText}>
              View Alternative Dates ({recommendation.alternativeDates.length})
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddToTrip(recommendation)}
          >
            <Icon name="add" size={20} color="white" />
            <Text style={styles.addButtonText}>Add to Trip</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => handleDismiss(recommendation)}
          >
            <Text style={styles.dismissButtonText}>Not Interested</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAlternativeDatesModal = () => (
    <Modal
      visible={alternativeDatesVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setAlternativeDatesVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Alternative Dates for {selectedRecommendation?.match.teams.home.name} vs {selectedRecommendation?.match.teams.away.name}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setAlternativeDatesVisible(false)}
            >
              <Icon name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.modalSubtitle}>
            Here are alternative dates when this match might be available:
          </Text>
          
          <FlatList
            data={selectedRecommendation?.alternativeDates || []}
            keyExtractor={(item, index) => `alt-date-${index}`}
            renderItem={({ item: date }) => (
              <TouchableOpacity style={styles.alternativeDateItem}>
                <Text style={styles.alternativeDateText}>
                  {new Date(date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </Text>
                <Text style={styles.alternativeDateSubtext}>
                  Check availability for this date
                </Text>
              </TouchableOpacity>
            )}
          />
          
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setAlternativeDatesVisible(false)}
          >
            <Text style={styles.modalCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading recommendations...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={24} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (recommendations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="recommend" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyTitle}>No recommendations available</Text>
        <Text style={styles.emptySubtitle}>
          We'll suggest matches based on your saved matches when they're available.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="recommend" size={24} color={colors.primary} />
        <Text style={styles.headerTitle}>Recommended Matches to Check Out on Your Trip</Text>
        <View style={styles.countChip}>
          <Text style={styles.countText}>
            {recommendations.length} recommendation{recommendations.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <FlatList
        data={recommendations}
        renderItem={renderRecommendationItem}
        keyExtractor={(item, index) => `${item.matchId}-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />

      {renderAlternativeDatesModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  headerTitle: {
    ...typography.h6,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  countChip: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  countText: {
    ...typography.caption,
    color: 'white',
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: spacing.lg,
  },
  recommendationCard: {
    backgroundColor: 'white',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
    borderWidth: 1,
    borderColor: colors.border,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  teamsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  teamName: {
    ...typography.body1,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  vsText: {
    ...typography.body2,
    color: colors.textSecondary,
    marginHorizontal: spacing.xs,
  },
  scoreContainer: {
    alignItems: 'flex-end',
  },
  scoreChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  scoreText: {
    ...typography.caption,
    color: 'white',
    fontWeight: '600',
  },
  scoreNumber: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  matchDetails: {
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  detailText: {
    ...typography.body2,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  reasonContainer: {
    backgroundColor: colors.background,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  reasonText: {
    ...typography.body2,
    color: colors.primary,
    fontStyle: 'italic',
  },
  alternativeDatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  alternativeDatesText: {
    ...typography.body2,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addButton: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  addButtonText: {
    ...typography.button,
    color: 'white',
    marginLeft: spacing.xs,
  },
  dismissButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  dismissButtonText: {
    ...typography.button,
    color: colors.textSecondary,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorBackground,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body2,
    color: colors.error,
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    ...typography.h6,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    margin: spacing.lg,
    maxHeight: '80%',
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h6,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  closeButton: {
    padding: spacing.xs,
  },
  modalSubtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  alternativeDateItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  alternativeDateText: {
    ...typography.body1,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  alternativeDateSubtext: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  modalCloseButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalCloseButtonText: {
    ...typography.button,
    color: 'white',
  },
});

export default RecommendedMatches;
