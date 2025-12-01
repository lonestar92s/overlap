# Filter Chips Implementation Guide

## Overview

This guide details the implementation of removable filter chips that display applied filters in the UI, following design tokens and maintaining the hierarchical filter structure.

## Requirements

1. **Display Applied Filters**: Show all active filters as chips
2. **Removable**: Each chip has a remove button
3. **Cascading Removal**: Removing a country removes its leagues/teams
4. **Design Token Compliance**: Use typography, colors, spacing, borderRadius tokens
5. **Font Family**: Use Helvetica Neue (iOS) / sans-serif (Android) via typography tokens

## Component Structure

### FilterChip Component

**Location**: `components/FilterChip.js`

```javascript
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
```

## Integration in MapResultsScreen

### Step 1: Add Helper Functions

```javascript
// Get filter labels with metadata
const getFilterLabels = useMemo(() => {
  const labels = [];
  
  if (!filterData || !selectedFilters) return labels;
  
  // Country filters
  selectedFilters.countries?.forEach(countryId => {
    const country = filterData.countries?.find(c => c.id === countryId);
    if (country) {
      labels.push({ 
        id: `country-${countryId}`, 
        label: country.name, 
        type: 'country', 
        value: countryId 
      });
    }
  });
  
  // League filters
  selectedFilters.leagues?.forEach(leagueId => {
    const league = filterData.leagues?.find(l => l.id === leagueId);
    if (league) {
      labels.push({ 
        id: `league-${leagueId}`, 
        label: league.name, 
        type: 'league', 
        value: leagueId 
      });
    }
  });
  
  // Team filters
  selectedFilters.teams?.forEach(teamId => {
    const team = filterData.teams?.find(t => t.id === teamId);
    if (team) {
      labels.push({ 
        id: `team-${teamId}`, 
        label: team.name, 
        type: 'team', 
        value: teamId 
      });
    }
  });
  
  return labels;
}, [filterData, selectedFilters]);

// Handler to remove a filter (with cascading logic)
const handleRemoveFilter = useCallback((type, value) => {
  const newFilters = { ...selectedFilters };
  
  if (type === 'country') {
    // Remove country
    newFilters.countries = newFilters.countries.filter(id => id !== value);
    
    // Also remove related leagues
    const countryLeagues = filterData.leagues
      .filter(l => l.countryId === value)
      .map(l => l.id);
    newFilters.leagues = newFilters.leagues.filter(id => !countryLeagues.includes(id));
    
    // Also remove related teams
    const countryTeams = filterData.teams
      .filter(t => {
        const teamLeague = filterData.leagues.find(l => l.id === t.leagueId);
        return teamLeague?.countryId === value;
      })
      .map(t => t.id);
    newFilters.teams = newFilters.teams.filter(id => !countryTeams.includes(id));
  } else if (type === 'league') {
    // Remove league
    newFilters.leagues = newFilters.leagues.filter(id => id !== value);
    
    // Also remove related teams
    const leagueTeams = filterData.teams
      .filter(t => t.leagueId === value)
      .map(t => t.id);
    newFilters.teams = newFilters.teams.filter(id => !leagueTeams.includes(id));
  } else if (type === 'team') {
    // Remove team only
    newFilters.teams = newFilters.teams.filter(id => id !== value);
  }
  
  updateSelectedFilters(newFilters);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}, [selectedFilters, filterData, updateSelectedFilters]);
```

### Step 2: Add Filter Chips to Header

```javascript
// In the render method, add chips below the header
<View style={styles.headerNav}>
  {/* ... existing header content ... */}
</View>

{/* Filter Chips Section */}
{getFilterLabels.length > 0 && (
  <View style={styles.filterChipsContainer}>
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterChipsContent}
    >
      {getFilterLabels.map(filter => (
        <FilterChip
          key={filter.id}
          label={filter.label}
          onRemove={() => handleRemoveFilter(filter.type, filter.value)}
          type={filter.type}
        />
      ))}
    </ScrollView>
  </View>
)}
```

### Step 3: Add Styles

```javascript
filterChipsContainer: {
  backgroundColor: colors.card,
  borderBottomWidth: 1,
  borderBottomColor: colors.borderLight,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 2,
},
filterChipsContent: {
  paddingRight: spacing.md,
},
```

## Design Token Usage

### Typography
- **Chip Text**: `typography.bodySmall` (14px, Helvetica Neue)
- **Section Titles**: `typography.h3` (18px, Helvetica Neue)
- **Filter Item Text**: `typography.body` (16px, Helvetica Neue)
- **Count Text**: `typography.caption` (12px, Helvetica Neue)

### Colors
- **Chip Background**: `colors.card` (#FFFFFF)
- **Chip Border**: `colors.border` (#E0E0E0)
- **Chip Text**: `colors.text.primary` (#333333)
- **Remove Icon**: `colors.text.secondary` (#666666)

### Spacing
- **Chip Padding**: `spacing.md` (16px horizontal), `spacing.sm` (8px vertical)
- **Chip Margin**: `spacing.sm` (8px right, bottom)
- **Container Padding**: `spacing.md` (16px)

### Border Radius
- **Chip**: `borderRadius.pill` (20px) for pill-shaped chips

## User Experience Flow

1. **User applies filters** in FilterModal
2. **Filter chips appear** in MapResultsScreen header
3. **User sees context** of what filters are active
4. **User can remove** individual filters by tapping X on chip
5. **Cascading removal** happens automatically (removing country removes leagues/teams)
6. **Results update** immediately when filter is removed

## Accessibility

- Each chip has `accessibilityLabel` for screen readers
- Remove button has proper `accessibilityRole="button"`
- Hit slop area for easier tapping
- Clear visual feedback on interaction

## Testing Checklist

- [ ] Filter chips appear when filters are applied
- [ ] Chips show correct filter names
- [ ] Removing chip updates filter state
- [ ] Cascading removal works (country → leagues → teams)
- [ ] Chips scroll horizontally if many filters
- [ ] Design tokens are used throughout
- [ ] Font family is correct (Helvetica Neue on iOS)
- [ ] Accessibility works with screen reader
- [ ] Visual styling matches design tokens
- [ ] Chips disappear when all filters cleared

## Estimated Implementation Time

- **FilterChip Component**: 30 minutes
- **Integration in MapResultsScreen**: 1-2 hours
- **Cascading Logic**: 30 minutes
- **Design Token Updates**: 30 minutes
- **Testing**: 1 hour
- **Total**: ~3-4 hours

