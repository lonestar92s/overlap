# FilterModal Refactoring Guide - Using react-native-elements + Design Tokens + Filter Chips

## Overview

This guide shows how to refactor the filtering system to:
1. Use `react-native-elements` `CheckBox` component instead of custom checkbox
2. Follow design tokens for typography, colors, spacing, and borderRadius
3. Add removable filter chips to show applied filters in the UI
4. Maintain the same hierarchical structure (Country → League → Team)

## Current Implementation

**Location**: `components/FilterModal.js`

**Current Custom Checkbox:**
```javascript
const renderCheckbox = (checked, onPress, disabled = false, label = '') => (
  <TouchableOpacity
    style={[
      styles.checkbox,
      checked && styles.checkboxChecked,
      disabled && styles.checkboxDisabled
    ]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="checkbox"
    accessibilityState={{ checked, disabled }}
    accessibilityLabel={label || (checked ? 'Selected' : 'Unselected')}
  >
    {checked && (
      <Ionicons 
        name="checkmark" 
        size={16} 
        color={disabled ? '#ccc' : '#fff'} 
      />
    )}
  </TouchableOpacity>
);
```

## Refactored Implementation

### Step 1: Add Imports

```javascript
import { CheckBox, Button } from 'react-native-elements';
import { 
  colors, 
  spacing, 
  typography, 
  borderRadius 
} from '../styles/designTokens';
```

### Step 2: Remove Custom Checkbox Function

Delete the `renderCheckbox` function entirely.

### Step 3: Replace Checkbox Usage

**Before:**
```javascript
<TouchableOpacity
  style={styles.filterItemContentLeft}
  onPress={() => handleCountryChange(country.id)}
>
  {renderCheckbox(
    isSelected,
    () => handleCountryChange(country.id),
    false,
    `Select ${country.name}`
  )}
  <Text style={styles.filterItemText}>{country.name}</Text>
</TouchableOpacity>
```

**After:**
```javascript
<CheckBox
  title={country.name}
  checked={isSelected}
  onPress={() => handleCountryChange(country.id)}
  checkedColor={colors.primary}
  uncheckedColor={colors.text.secondary}
  containerStyle={styles.checkboxContainer}
  textStyle={styles.checkboxText}
  accessibilityLabel={`Filter by ${country.name}`}
/>
```

### Step 4: Update Styles

**Remove:**
```javascript
checkbox: {
  width: 20,
  height: 20,
  borderRadius: 4,
  borderWidth: 2,
  borderColor: '#ddd',
  marginRight: 12,
  justifyContent: 'center',
  alignItems: 'center',
},
checkboxChecked: {
  backgroundColor: '#007AFF',
  borderColor: '#007AFF',
},
checkboxDisabled: {
  backgroundColor: '#f0f0f0',
  borderColor: '#ccc',
},
```

**Add (using design tokens):**
```javascript
checkboxContainer: {
  backgroundColor: 'transparent',
  borderWidth: 0,
  padding: 0,
  margin: 0,
  marginLeft: 0,
  marginRight: 0,
},
checkboxText: {
  ...typography.body, // Uses design token fontFamily (Helvetica Neue on iOS)
  color: colors.text.primary,
},
```

### Step 5: Apply to All Checkbox Instances

Apply the same pattern to:
- Country checkboxes
- League checkboxes  
- Team checkboxes

## Complete Example: Country Section

```javascript
const renderCountrySection = () => {
  if (!filterData.countries || filterData.countries.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Countries</Text>
        <Text style={styles.noDataText}>No countries available from search results</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Countries</Text>
        <TouchableOpacity onPress={handleSelectAllCountries}>
          <Text style={styles.selectAllText}>Select All</Text>
        </TouchableOpacity>
      </View>
      
      {filterData.countries.map(country => {
        const isSelected = localFilters.countries.includes(country.id);
        const isExpanded = expandedCountryId === country.id;
        
        return (
          <View key={country.id} style={styles.filterItem}>
            <View style={styles.filterRow}>
              <CheckBox
                title={country.name}
                checked={isSelected}
                onPress={() => handleCountryChange(country.id)}
                checkedColor={colors.primary}
                uncheckedColor={colors.text.secondary}
                containerStyle={styles.checkboxContainer}
                textStyle={styles.checkboxText}
                accessibilityLabel={`Filter by ${country.name}`}
              />
              
              <View style={styles.filterItemRight}>
                <View style={styles.countChip}>
                  <Text style={styles.countText}>{country.count || 0}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    setExpandedCountryId(prev => prev === country.id ? null : country.id);
                    setExpandedLeagueId(null);
                  }}
                  style={styles.expandIconBtn}
                >
                  <Ionicons 
                    name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                    size={18} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Leagues accordion - keep custom structure */}
            {isExpanded && (
              <View style={styles.nestedSection}>
                {/* ... leagues nested here ... */}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};
```

## Benefits

1. **Less Code**: Removes ~50 lines of custom checkbox code
2. **Better Accessibility**: react-native-elements CheckBox handles a11y automatically
3. **Consistency**: Matches usage in LoginScreen and other screens
4. **Design Token Compliance**: All styling uses design tokens (typography, colors, spacing, borderRadius)
5. **Better UX**: Filter chips provide visual context of applied filters
6. **Maintainability**: One less custom component to maintain
7. **Font Consistency**: Uses Helvetica Neue (iOS) / sans-serif (Android) via typography tokens

## What to Keep Custom

- **Accordion Structure**: react-native-elements doesn't have Accordion, keep custom expand/collapse
- **Count Chips**: Keep custom count display (react-native-elements doesn't have Badge) - use design tokens
- **Filter Chips**: Custom removable chips showing applied filters - use design tokens
- **Hierarchical Logic**: Keep all cascading selection logic
- **Filter State Management**: Keep all state management as-is

## Part 2: Add Filter Chips

### Overview

Filter chips should appear in the `MapResultsScreen` header area to show users what filters are currently applied. Each chip should be removable.

### Step 1: Create FilterChip Component

Create `components/FilterChip.js`:

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
    ...typography.bodySmall, // Uses design token fontFamily
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

### Step 2: Add Filter Chips to MapResultsScreen

In `MapResultsScreen.js`, add filter chips display in the header:

```javascript
import FilterChip from '../components/FilterChip';

// Add helper function to get filter labels
const getFilterLabels = () => {
  const labels = [];
  
  // Country filters
  selectedFilters.countries?.forEach(countryId => {
    const country = filterData.countries?.find(c => c.id === countryId);
    if (country) {
      labels.push({ id: `country-${countryId}`, label: country.name, type: 'country', value: countryId });
    }
  });
  
  // League filters
  selectedFilters.leagues?.forEach(leagueId => {
    const league = filterData.leagues?.find(l => l.id === leagueId);
    if (league) {
      labels.push({ id: `league-${leagueId}`, label: league.name, type: 'league', value: leagueId });
    }
  });
  
  // Team filters
  selectedFilters.teams?.forEach(teamId => {
    const team = filterData.teams?.find(t => t.id === teamId);
    if (team) {
      labels.push({ id: `team-${teamId}`, label: team.name, type: 'team', value: teamId });
    }
  });
  
  return labels;
};

// Handler to remove a filter
const handleRemoveFilter = (type, value) => {
  const newFilters = { ...selectedFilters };
  
  if (type === 'country') {
    newFilters.countries = newFilters.countries.filter(id => id !== value);
    // Also remove related leagues and teams
    const countryLeagues = filterData.leagues
      .filter(l => l.countryId === value)
      .map(l => l.id);
    newFilters.leagues = newFilters.leagues.filter(id => !countryLeagues.includes(id));
    
    const countryTeams = filterData.teams
      .filter(t => {
        const teamLeague = filterData.leagues.find(l => l.id === t.leagueId);
        return teamLeague?.countryId === value;
      })
      .map(t => t.id);
    newFilters.teams = newFilters.teams.filter(id => !countryTeams.includes(id));
  } else if (type === 'league') {
    newFilters.leagues = newFilters.leagues.filter(id => id !== value);
    // Also remove related teams
    const leagueTeams = filterData.teams
      .filter(t => t.leagueId === value)
      .map(t => t.id);
    newFilters.teams = newFilters.teams.filter(id => !leagueTeams.includes(id));
  } else if (type === 'team') {
    newFilters.teams = newFilters.teams.filter(id => id !== value);
  }
  
  updateSelectedFilters(newFilters);
};

// In the render method, add chips below header or in header area:
{getFilterLabels().length > 0 && (
  <View style={styles.filterChipsContainer}>
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterChipsContent}
    >
      {getFilterLabels().map(filter => (
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

### Step 3: Add Styles for Filter Chips Container

In `MapResultsScreen.js` styles:

```javascript
filterChipsContainer: {
  backgroundColor: colors.card,
  borderBottomWidth: 1,
  borderBottomColor: colors.borderLight,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
},
filterChipsContent: {
  paddingRight: spacing.md,
},
```

### Step 4: Update All Text to Use Design Tokens

Ensure all text in FilterModal uses design tokens:

```javascript
// Before
sectionTitle: {
  fontSize: 18,
  fontWeight: '600',
  color: '#333',
},

// After
sectionTitle: {
  ...typography.h3, // Uses design token fontFamily
  color: colors.text.primary,
},

// Before
filterItemText: {
  flex: 1,
  fontSize: 16,
  color: '#333',
},

// After
filterItemText: {
  flex: 1,
  ...typography.body, // Uses design token fontFamily
  color: colors.text.primary,
},

// Before
countText: {
  fontSize: 12,
  color: '#666',
  fontWeight: '500',
},

// After
countText: {
  ...typography.caption, // Uses design token fontFamily
  color: colors.text.secondary,
  fontWeight: '500',
},
```

## Design Token Compliance Checklist

- [ ] All text uses `typography.*` (h1, h2, h3, body, bodySmall, caption, button)
- [ ] All colors use `colors.*` (primary, text.primary, text.secondary, border, etc.)
- [ ] All spacing uses `spacing.*` (xs, sm, md, lg, xl, xxl)
- [ ] All border radius uses `borderRadius.*` (xs, sm, md, lg, xl, pill)
- [ ] Font family automatically applied via typography tokens (Helvetica Neue on iOS, sans-serif on Android)
- [ ] No hardcoded colors, spacing, or font sizes

## Testing Checklist

After refactoring, test:
- [ ] Checkboxes toggle correctly
- [ ] Accessibility works (screen reader)
- [ ] Visual styling matches design tokens
- [ ] Font family is Helvetica Neue (iOS) / sans-serif (Android)
- [ ] Filter chips display correctly
- [ ] Filter chips are removable
- [ ] Removing filter chip updates filter state correctly
- [ ] Cascading deselection still works (removing country removes leagues/teams)
- [ ] "Select All" functionality works
- [ ] Count chips display correctly
- [ ] Accordion expand/collapse works
- [ ] All colors use design tokens
- [ ] All spacing uses design tokens
- [ ] All typography uses design tokens

## Estimated Time

- **Refactoring Checkboxes**: 1-2 hours
- **Adding Filter Chips**: 1-2 hours
- **Design Token Updates**: 1 hour
- **Testing**: 1 hour
- **Total**: ~4-5 hours

