import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing, typography } from '../styles/designTokens';

// Helper function to get icon name for transit type
const getTransitIcon = (type) => {
  switch (type) {
    case 'train':
      return 'train';
    case 'subway':
      return 'subway';
    case 'bus':
      return 'directions-bus';
    case 'tram':
      return 'tram';
    default:
      return 'directions-transit';
  }
};

// Helper function to get display name for transit type
const getTransitLabel = (type) => {
  switch (type) {
    case 'train':
      return 'Train';
    case 'subway':
      return 'Subway';
    case 'bus':
      return 'Bus';
    case 'tram':
      return 'Tram';
    default:
      return 'Transit';
  }
};

// Component for a single travel mode row
const TravelModeRow = ({ icon, duration, distance, durationText, distanceText, label }) => {
  // Use durationText if available (e.g., "45 mins"), otherwise use duration in minutes
  const displayDuration = durationText || `${duration} min`;
  const displayDistance = distanceText || (distance ? `${distance} mi` : null);

  return (
    <View style={styles.modeRow}>
      <Icon name={icon} size={16} color={colors.text.secondary} />
      <View style={styles.contentContainer}>
        <View style={styles.timeDistanceRow}>
          {label && (
            <>
              <Text style={styles.modeLabel}>{label}</Text>
              <Text style={styles.separator}>•</Text>
            </>
          )}
          <Text style={styles.text}>{displayDuration}</Text>
          {displayDistance && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.text}>{displayDistance}</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

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

  // Handle new format with driving and transit
  if (travelTime.driving || travelTime.transit) {
    const modes = [];
    
    // Add driving if available
    if (travelTime.driving) {
      modes.push({
        icon: 'directions-car',
        label: null, // No label for driving (default)
        ...travelTime.driving
      });
    }
    
    // Add transit options if available
    if (travelTime.transit && Array.isArray(travelTime.transit)) {
      travelTime.transit.forEach(transitOption => {
        if (transitOption.available) {
          modes.push({
            icon: getTransitIcon(transitOption.type),
            label: getTransitLabel(transitOption.type),
            ...transitOption
          });
        }
      });
    }

    if (modes.length === 0) {
      return null;
    }

    return (
      <View style={[styles.container, style]}>
        {modes.map((mode, index) => (
          <TravelModeRow
            key={index}
            icon={mode.icon}
            duration={mode.duration}
            distance={mode.distance}
            durationText={mode.durationText}
            distanceText={mode.distanceText}
            label={mode.label}
          />
        ))}
        {(from || to) && (
          <Text style={styles.contextText}>
            {from && to ? `From ${from} to ${to}` : from ? `From ${from}` : to ? `To ${to}` : ''}
          </Text>
        )}
      </View>
    );
  }

  // Handle legacy format (backward compatibility)
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
    gap: spacing.xs,
  },
  modeRow: {
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
  modeLabel: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    fontWeight: '500',
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

