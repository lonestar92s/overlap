import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';

const FilterIcon = ({ onPress, filterCount = 0 }) => {
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      accessibilityLabel={`Filter matches${filterCount > 0 ? `, ${filterCount} active` : ''}`}
      accessibilityRole="button"
    >
      <View style={styles.iconContainer}>
        <Ionicons name="filter" size={24} color={colors.primary} />
        {filterCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {filterCount > 9 ? '9+' : filterCount}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.sm,
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -spacing.sm,
    right: -spacing.sm,
    backgroundColor: colors.error,
    borderRadius: borderRadius.sm,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  badgeText: {
    color: colors.card,
    ...typography.caption,
    fontWeight: 'bold',
  },
});

export default FilterIcon;


