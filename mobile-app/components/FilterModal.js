import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from 'react-native';
import { Overlay } from 'react-native-elements';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const FilterModal = ({ visible, onClose, onApplyFilters, currentFilters = {} }) => {
  const [selectedFilters, setSelectedFilters] = useState(currentFilters);
  const [expandedSections, setExpandedSections] = useState({});

  // Mock hierarchical data - this would come from your backend
  const filterData = [
    {
      id: 'england',
      name: 'England',
      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      leagues: [
        {
          id: '39',
          name: 'Premier League',
          teams: [
            { id: '33', name: 'Manchester United' },
            { id: '40', name: 'Liverpool' },
            { id: '42', name: 'Arsenal' },
            { id: '47', name: 'Tottenham Hotspur' },
            { id: '50', name: 'Manchester City' },
            { id: '49', name: 'Chelsea' },
          ]
        },
        {
          id: '40',
          name: 'Championship',
          teams: [
            { id: '63', name: 'Leeds United' },
            { id: '46', name: 'Leicester City' },
            { id: '41', name: 'West Bromwich Albion' },
          ]
        },
        {
          id: '41',
          name: 'League One',
          teams: [
            { id: '51', name: 'Portsmouth' },
            { id: '52', name: 'Bolton Wanderers' },
          ]
        }
      ]
    },
    {
      id: 'germany',
      name: 'Germany',
      flag: '🇩🇪',
      leagues: [
        {
          id: '78',
          name: 'Bundesliga',
          teams: [
            { id: '157', name: 'Bayern Munich' },
            { id: '165', name: 'Borussia Dortmund' },
            { id: '161', name: 'Bayer Leverkusen' },
            { id: '173', name: 'RB Leipzig' },
          ]
        }
      ]
    },
    {
      id: 'spain',
      name: 'Spain',
      flag: '🇪🇸',
      leagues: [
        {
          id: '140',
          name: 'La Liga',
          teams: [
            { id: '85', name: 'Real Madrid' },
            { id: '87', name: 'Barcelona' },
            { id: '81', name: 'Atlético Madrid' },
          ]
        }
      ]
    },
    {
      id: 'italy',
      name: 'Italy',
      flag: '🇮🇹',
      leagues: [
        {
          id: '135',
          name: 'Serie A',
          teams: [
            { id: '489', name: 'Juventus' },
            { id: '505', name: 'Inter Milan' },
            { id: '492', name: 'AC Milan' },
          ]
        }
      ]
    }
  ];

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const toggleFilter = (type, id) => {
    setSelectedFilters(prev => {
      const newFilters = { ...prev };
      
      if (type === 'country') {
        // Toggle country and all its leagues/teams
        const country = filterData.find(c => c.id === id);
        const isSelected = newFilters.countries?.includes(id);
        
        if (isSelected) {
          // Remove country and all its contents
          newFilters.countries = newFilters.countries?.filter(c => c !== id) || [];
          newFilters.leagues = newFilters.leagues?.filter(l => 
            !country.leagues.some(cl => cl.id === l)
          ) || [];
          newFilters.teams = newFilters.teams?.filter(t => 
            !country.leagues.some(cl => cl.teams.some(ct => ct.id === t))
          ) || [];
        } else {
          // Add country and all its contents
          newFilters.countries = [...(newFilters.countries || []), id];
          newFilters.leagues = [...(newFilters.leagues || []), ...country.leagues.map(l => l.id)];
          newFilters.teams = [...(newFilters.teams || []), ...country.leagues.flatMap(l => l.teams.map(t => t.id))];
        }
      } else if (type === 'league') {
        // Toggle league and all its teams
        const league = filterData.flatMap(c => c.leagues).find(l => l.id === id);
        const isSelected = newFilters.leagues?.includes(id);
        
        if (isSelected) {
          // Remove league and all its teams
          newFilters.leagues = newFilters.leagues?.filter(l => l !== id) || [];
          newFilters.teams = newFilters.teams?.filter(t => 
            !league.teams.some(lt => lt.id === t)
          ) || [];
        } else {
          // Add league and all its teams
          newFilters.leagues = [...(newFilters.leagues || []), id];
          newFilters.teams = [...(newFilters.teams || []), ...league.teams.map(t => t.id)];
        }
      } else if (type === 'team') {
        // Toggle individual team
        newFilters.teams = newFilters.teams || [];
        const isSelected = newFilters.teams.includes(id);
        
        if (isSelected) {
          newFilters.teams = newFilters.teams.filter(t => t !== id);
        } else {
          newFilters.teams = [...newFilters.teams, id];
        }
      }
      
      return newFilters;
    });
  };

  const isSelected = (type, id) => {
    if (type === 'country') {
      return selectedFilters.countries?.includes(id) || false;
    } else if (type === 'league') {
      return selectedFilters.leagues?.includes(id) || false;
    } else if (type === 'team') {
      return selectedFilters.teams?.includes(id) || false;
    }
    return false;
  };

  const getActiveFilterCount = () => {
    return (selectedFilters.countries?.length || 0) + 
           (selectedFilters.leagues?.length || 0) + 
           (selectedFilters.teams?.length || 0);
  };

  const clearAllFilters = () => {
    setSelectedFilters({});
  };

  const handleApply = () => {
    onApplyFilters(selectedFilters);
    onClose();
  };

  const renderTeam = ({ item: team }) => (
    <TouchableOpacity
      style={[
        styles.teamItem,
        isSelected('team', team.id) && styles.selectedItem
      ]}
      onPress={() => toggleFilter('team', team.id)}
    >
      <Text style={[
        styles.teamText,
        isSelected('team', team.id) && styles.selectedText
      ]}>
        {team.name}
      </Text>
    </TouchableOpacity>
  );

  const renderLeague = (league, countryId) => (
    <View key={league.id} style={styles.leagueContainer}>
      <TouchableOpacity
        style={[
          styles.leagueHeader,
          isSelected('league', league.id) && styles.selectedItem
        ]}
        onPress={() => toggleFilter('league', league.id)}
      >
        <Text style={[
          styles.leagueText,
          isSelected('league', league.id) && styles.selectedText
        ]}>
          {league.name}
        </Text>
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => toggleSection(`league-${league.id}`)}
        >
          <Text style={styles.expandButtonText}>
            {expandedSections[`league-${league.id}`] ? '−' : '+'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
      
      {expandedSections[`league-${league.id}`] && (
        <View style={styles.teamsContainer}>
          <FlatList
            data={league.teams}
            renderItem={renderTeam}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      )}
    </View>
  );

  const renderCountry = ({ item: country }) => (
    <View key={country.id} style={styles.countryContainer}>
      <TouchableOpacity
        style={[
          styles.countryHeader,
          isSelected('country', country.id) && styles.selectedItem
        ]}
        onPress={() => toggleFilter('country', country.id)}
      >
        <Text style={styles.countryFlag}>{country.flag}</Text>
        <Text style={[
          styles.countryText,
          isSelected('country', country.id) && styles.selectedText
        ]}>
          {country.name}
        </Text>
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => toggleSection(`country-${country.id}`)}
        >
          <Text style={styles.expandButtonText}>
            {expandedSections[`country-${country.id}`] ? '−' : '+'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
      
      {expandedSections[`country-${country.id}`] && (
        <View style={styles.leaguesContainer}>
          {country.leagues.map(league => renderLeague(league, country.id))}
        </View>
      )}
    </View>
  );

  return (
    <Overlay
      isVisible={visible}
      onBackdropPress={onClose}
      overlayStyle={styles.overlayStyle}
      backdropStyle={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
      animationType="slide"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Filter Matches</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Active filters count */}
        {getActiveFilterCount() > 0 && (
          <View style={styles.activeFiltersContainer}>
            <Text style={styles.activeFiltersText}>
              {getActiveFilterCount()} filter{getActiveFilterCount() !== 1 ? 's' : ''} active
            </Text>
            <TouchableOpacity onPress={clearAllFilters}>
              <Text style={styles.clearAllText}>Clear all</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Filter content */}
        <ScrollView style={styles.content} contentContainerStyle={{ flexGrow: 1, paddingBottom: spacing.lg }} showsVerticalScrollIndicator={false}>
          <FlatList
            data={filterData}
            renderItem={renderCountry}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </ScrollView>

        {/* Apply button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.applyButton,
              getActiveFilterCount() === 0 && styles.applyButtonDisabled
            ]}
            onPress={handleApply}
            disabled={getActiveFilterCount() === 0}
          >
            <Text style={[
              styles.applyButtonText,
              getActiveFilterCount() === 0 && styles.applyButtonTextDisabled
            ]}>
              Apply Filters ({getActiveFilterCount()})
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Overlay>
  );
};

const styles = StyleSheet.create({
  overlayStyle: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 0,
    margin: 20,
    width: '90%',
    height: '80%',
    alignSelf: 'center',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeButtonText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: 'bold',
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardGrey,
  },
  activeFiltersText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  clearAllText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  countryContainer: {
    marginBottom: spacing.md,
  },
  countryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.cardGrey,
  },
  countryFlag: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  countryText: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  selectedItem: {
    backgroundColor: colors.primary,
  },
  selectedText: {
    color: colors.card,
  },
  expandButton: {
    padding: spacing.xs,
  },
  expandButtonText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: 'bold',
  },
  leaguesContainer: {
    marginLeft: spacing.lg,
    marginTop: spacing.sm,
  },
  leagueContainer: {
    marginBottom: spacing.sm,
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.xs,
    backgroundColor: colors.cardGrey,
  },
  leagueText: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: '500',
    flex: 1,
  },
  teamsContainer: {
    marginLeft: spacing.lg,
    marginTop: spacing.xs,
  },
  teamItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.xs,
    marginBottom: spacing.xs,
  },
  teamText: {
    ...typography.bodySmall,
    color: colors.text.primary,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  applyButtonDisabled: {
    backgroundColor: colors.border,
  },
  applyButtonText: {
    ...typography.button,
    color: colors.card,
  },
  applyButtonTextDisabled: {
    color: colors.text.secondary,
  },
});

export default FilterModal;