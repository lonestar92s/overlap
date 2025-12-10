import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../styles/designTokens';
import FilterAccordion from './FilterAccordion';

/**
 * FilterSection Component
 * 
 * A reusable component for rendering a filter section (countries, leagues, or teams)
 * with nested accordion support.
 */
const FilterSection = ({
  title,
  items = [],
  selectedIds = [],
  expandedId = null,
  onItemToggle,
  onItemExpand,
  onSelectAll,
  getNestedItems,
  renderNestedContent,
  showSelectAll = true,
  emptyMessage = 'No items available',
}) => {
  if (!items || items.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.noDataText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {showSelectAll && onSelectAll && (
          <TouchableOpacity onPress={onSelectAll}>
            <Text style={styles.selectAllText}>Select All</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {items.map(item => {
        const isSelected = selectedIds.includes(item.id);
        const isExpanded = expandedId === item.id;
        const nestedItems = getNestedItems ? getNestedItems(item) : null;
        // Only show expand icon if there are 2+ nested items (more useful UX)
        // Single nested item doesn't need expansion
        const hasNestedItems = nestedItems && nestedItems.length > 1;
        
        return (
          <FilterAccordion
            key={item.id}
            id={item.id}
            name={item.name}
            count={item.count || 0}
            checked={isSelected}
            expanded={isExpanded}
            onToggle={() => onItemToggle(item.id)}
            onExpand={onItemExpand ? () => onItemExpand(item.id) : null}
            hasNestedItems={hasNestedItems}
            accessibilityLabel={`Filter by ${item.name} ${title.toLowerCase()}`}
          >
            {isExpanded && nestedItems && nestedItems.length > 0 && renderNestedContent && (
              <View style={styles.nestedSection}>
                {renderNestedContent(item, nestedItems)}
              </View>
            )}
          </FilterAccordion>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    padding: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  selectAllText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },
  noDataText: {
    ...typography.bodySmall,
    color: colors.text.light,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  nestedSection: {
    marginLeft: spacing.xl,
    marginTop: spacing.sm,
  },
});

export default FilterSection;

