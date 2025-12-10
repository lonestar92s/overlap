import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';

const FilterChip = ({ label, onRemove, type = 'default' }) => {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
      <TouchableOpacity
        onPress={onRemove}
        style={styles.removeButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={`Remove ${label} filter`}
        accessibilityRole="button"
      >
        <Ionicons 
          name="close-circle" 
          size={16} 
          color={colors.text.secondary} 
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipText: {
    ...typography.bodySmall, // Uses design token fontFamily (Helvetica Neue on iOS)
    color: colors.text.primary,
    marginRight: spacing.xs,
  },
  removeButton: {
    marginLeft: spacing.xs,
    padding: spacing.xs,
  },
});

export default FilterChip;


