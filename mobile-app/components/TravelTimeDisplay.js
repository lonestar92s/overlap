import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing, typography } from '../styles/designTokens';

const TravelTimeDisplay = ({ travelTime, loading = false, style, from, to }) => {
  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Calculating...</Text>
      </View>
    );
  }

  if (!travelTime) {
    return null;
  }

  const { duration, distance } = travelTime;

  return (
    <View style={[styles.container, style]}>
      <Icon name="directions-car" size={16} color={colors.text.secondary} />
      <View style={styles.contentContainer}>
        <View style={styles.timeDistanceRow}>
          <Text style={styles.text}>
            {duration} min
          </Text>
          {distance && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.text}>
                {distance} mi
              </Text>
            </>
          )}
        </View>
        {(from || to) && (
          <Text style={styles.contextText}>
            {from && to ? `From ${from} to ${to}` : from ? `From ${from}` : to ? `To ${to}` : ''}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contentContainer: {
    flex: 1,
  },
  timeDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  text: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  separator: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginHorizontal: spacing.xs / 2,
  },
  contextText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
    fontSize: 11,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
});

export default TravelTimeDisplay;

