import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const TripHeader = ({ 
  location, 
  duration, 
  activeTab = 'list', 
  onTabChange,
  onLocationPress,
  style,
  ...props 
}) => {
  const renderLocationPill = () => (
    <TouchableOpacity 
      style={styles.locationPill}
      onPress={onLocationPress}
      activeOpacity={0.7}
    >
      <Text style={styles.locationText}>
        {location || 'Germany - France'}
      </Text>
      <Text style={styles.durationText}>
        {duration || '5 Day Travel'}
      </Text>
    </TouchableOpacity>
  );

  const renderTabNavigation = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'list' && styles.activeTab]}
        onPress={() => onTabChange('list')}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.tabText,
          activeTab === 'list' && styles.activeTabText
        ]}>
          List View
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tab, activeTab === 'map' && styles.activeTab]}
        onPress={() => onTabChange('map')}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.tabText,
          activeTab === 'map' && styles.activeTabText
        ]}>
          Map View
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, style]} {...props}>
      {renderLocationPill()}
      {renderTabNavigation()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  locationPill: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.small,
  },
  locationText: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  durationText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    ...shadows.small,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: colors.card,
    fontWeight: '600',
  },
});

export default TripHeader;

