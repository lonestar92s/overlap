import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckBox } from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';

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
  accessibilityLabel,
}) => {
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
          {onExpand && (
            <TouchableOpacity onPress={onExpand} style={styles.expandIconBtn}>
              <Ionicons 
                name={expanded ? 'chevron-up' : 'chevron-down'} 
                size={18} 
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
    marginLeft: spacing.sm,
  },
  expandIconBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
    borderRadius: borderRadius.sm,
    minWidth: 40,
    alignItems: 'center',
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

