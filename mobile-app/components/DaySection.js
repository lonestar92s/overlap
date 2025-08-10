import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';
import MatchCard from './MatchCard';

const DaySection = ({ 
  day, 
  date, 
  matches = [], 
  hasOverlap = false,
  onMatchPress,
  variant = 'default',
  style,
  ...props 
}) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const renderDayHeader = () => (
    <View style={styles.dayHeader}>
      <View style={styles.dayInfo}>
        <Text style={styles.dayText}>Day {day}</Text>
        <Text style={styles.dateText}>{formatDate(date)}</Text>
      </View>
      
      {hasOverlap && (
        <View style={styles.overlapIndicator}>
          <Text style={styles.overlapText}>Overlapping matches</Text>
        </View>
      )}
    </View>
  );

  const renderMatches = () => (
    <View style={styles.matchesContainer}>
      {matches.map((match, index) => (
        <MatchCard
          key={match.id || index}
          match={match}
          onPress={() => onMatchPress?.(match)}
          variant={variant}
          style={styles.matchCard}
        />
      ))}
    </View>
  );

  return (
    <View style={[styles.container, style]} {...props}>
      {renderDayHeader()}
      {renderMatches()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  dayInfo: {
    flex: 1,
  },
  dayText: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  dateText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  overlapIndicator: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  overlapText: {
    ...typography.caption,
    color: colors.card,
    fontWeight: '600',
  },
  matchesContainer: {
    paddingHorizontal: spacing.md,
  },
  matchCard: {
    marginBottom: spacing.sm,
  },
});

export default DaySection;

