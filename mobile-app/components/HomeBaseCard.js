import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const HomeBaseCard = ({ 
  homeBase, 
  onPress, 
  variant = 'default',
  style = {},
}) => {
  if (!homeBase) return null;

  const isOverlay = variant === 'overlay' || variant === 'compact';

  // Format date range
  const formatDateRange = (from, to) => {
    if (!from || !to) return '';
    try {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const fromStr = fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const toStr = toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${fromStr} - ${toStr}`;
    } catch (error) {
      return '';
    }
  };

  // Format location/address
  const formatLocation = () => {
    if (homeBase.address?.city && homeBase.address?.country) {
      return `${homeBase.address.city}, ${homeBase.address.country}`;
    } else if (homeBase.address?.city) {
      return homeBase.address.city;
    } else if (homeBase.address?.country) {
      return homeBase.address.country;
    }
    return 'Location not specified';
  };

  const dateRange = homeBase.dateRange 
    ? formatDateRange(homeBase.dateRange.from, homeBase.dateRange.to)
    : '';

  const location = formatLocation();

  const handlePress = () => {
    if (onPress && homeBase) {
      onPress(homeBase);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.card, isOverlay && styles.overlayCard, style]} 
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityLabel={`Home base: ${homeBase.name}`}
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Icon 
            name={homeBase.type === 'hotel' ? 'hotel' : homeBase.type === 'airbnb' ? 'home' : 'location-on'} 
            size={20} 
            color={colors.primary} 
          />
        </View>
        <View style={styles.contentContainer}>
          <Text style={[styles.name, isOverlay && styles.overlayName]} numberOfLines={2}>
            {homeBase.name}
          </Text>
          
          {location && (
            <View style={styles.locationContainer}>
              <Icon name="place" size={14} color={colors.text.secondary} />
              <Text style={[styles.location, isOverlay && styles.overlayLocation]} numberOfLines={1}>
                {location}
              </Text>
            </View>
          )}
          
          {dateRange && (
            <View style={styles.dateContainer}>
              <Icon name="calendar-today" size={14} color={colors.text.secondary} />
              <Text style={[styles.dateRange, isOverlay && styles.overlayDateRange]}>
                {dateRange}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.small,
  },
  overlayCard: {
    padding: spacing.sm,
    marginBottom: 0,
    shadowOpacity: 0.15,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  contentContainer: {
    flex: 1,
  },
  name: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  overlayName: {
    fontSize: 15,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  location: {
    ...typography.caption,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
    flex: 1,
  },
  overlayLocation: {
    fontSize: 11,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateRange: {
    ...typography.caption,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  overlayDateRange: {
    fontSize: 11,
  },
});

export default HomeBaseCard;


