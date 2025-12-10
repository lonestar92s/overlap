import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckBox } from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, iconSizes } from '../styles/designTokens';

/**
 * FilterAccordion Component
 * 
 * A reusable accordion component for expandable/collapsible filter items.
 * Displays a checkbox with a count badge and expand/collapse icon.
 */
const FilterAccordion = ({
  id,
  name,
  count = 0,
  checked = false,
  expanded = false,
  onToggle,
  onExpand,
  children,
  hasNestedItems = false,
  accessibilityLabel,
}) => {
  // Only show expand icon if there are nested items to expand
  const shouldShowExpand = onExpand && hasNestedItems;

  return (
    <View style={styles.filterItem}>
      <View style={styles.filterRow}>
        <CheckBox
          title={name}
          checked={checked}
          onPress={onToggle}
          checkedColor={colors.primary}
          uncheckedColor={colors.text.secondary}
          containerStyle={styles.checkboxContainer}
          textStyle={styles.checkboxText}
          accessibilityLabel={accessibilityLabel || `Filter by ${name}`}
        />
        <View style={styles.filterItemRight}>
          <View style={styles.countChip}>
            <Text style={styles.countText}>{count}</Text>
          </View>
          {shouldShowExpand && (
            <TouchableOpacity 
              onPress={onExpand} 
              style={styles.expandIconBtn}
              accessibilityRole="button"
              accessibilityLabel={expanded ? `Collapse ${name} options` : `Expand ${name} options`}
            >
              <Ionicons 
                name={expanded ? 'chevron-up' : 'chevron-down'} 
                size={iconSizes.sm} 
                color={colors.text.secondary} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {expanded && children && (
        <View style={styles.nestedSection}>
          {children}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  filterItem: {
    marginBottom: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  expandIconBtn: {
    padding: spacing.xs,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  checkboxContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    margin: 0,
    marginLeft: 0,
    marginRight: 0,
  },
  checkboxText: {
    ...typography.body,
    color: colors.text.primary,
  },
  countChip: {
    backgroundColor: colors.cardGrey,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  nestedSection: {
    marginLeft: spacing.xl,
    marginTop: spacing.sm,
  },
});

export default FilterAccordion;

