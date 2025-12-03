import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { CheckBox, Button } from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ErrorBoundary from './ErrorBoundary';
import FilterSection from './FilterSection';
import FilterAccordion from './FilterAccordion';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';

const FilterModal = ({ 
  visible, 
  onClose, 
  filterData,
  selectedFilters,
  onFiltersChange 
}) => {
  const insets = useSafeAreaInsets();
  const [expandedCountryId, setExpandedCountryId] = useState(null);
  const [expandedLeagueId, setExpandedLeagueId] = useState(null);

  const [localFilters, setLocalFilters] = useState({
    countries: [],
    leagues: [],
    teams: []
  });

  // Helper function to get total filters count
  const getTotalFilters = useCallback(() => {
    return localFilters.countries.length + localFilters.leagues.length + localFilters.teams.length;
  }, [localFilters]);

  // Calculate fixed modal height to prevent resizing
  const screenHeight = Dimensions.get('window').height;
  const modalMaxHeight = screenHeight * 0.8; // 80% of screen
  const headerHeight = 60; // Approximate header height
  const availableFiltersHeight = 50; // Available filters summary
  const activeFiltersHeight = 50; // Active filters summary (always rendered)
  const footerHeight = 80; // Footer with buttons
  
  // Calculate current filters height based on whether filters are selected
  const currentFiltersHeight = useMemo(() => {
    return getTotalFilters() > 0 ? 80 : 0;
  }, [getTotalFilters]);
  
  // Calculate content wrapper height - fixed to prevent modal resizing
  const contentWrapperHeight = useMemo(() => {
    return modalMaxHeight - headerHeight - availableFiltersHeight - activeFiltersHeight - currentFiltersHeight - footerHeight - (insets?.bottom || 0);
  }, [modalMaxHeight, currentFiltersHeight, insets?.bottom]);

  // Initialize local filters when modal opens
  useEffect(() => {
    if (visible && selectedFilters) {
      setLocalFilters(selectedFilters);
    }
  }, [visible, selectedFilters]);

  const handleCountryChange = (countryId) => {
    setLocalFilters(prev => {
      const newCountries = prev.countries.includes(countryId)
        ? prev.countries.filter(id => id !== countryId)
        : [...prev.countries, countryId];
      
      // When deselecting a country, remove all its leagues and teams
      let newLeagues = [...prev.leagues];
      let newTeams = [...prev.teams];
      
      if (prev.countries.includes(countryId)) {
        // Country was deselected, remove its leagues and teams
        const countryLeagues = filterData.leagues.filter(league => 
          league.countryId === countryId
        ).map(league => league.id);
        
        newLeagues = newLeagues.filter(leagueId => 
          !countryLeagues.includes(leagueId)
        );
        
        // Remove teams from deselected leagues
        newTeams = newTeams.filter(teamId => {
          const team = filterData.teams.find(t => t.id === teamId);
          return team && !countryLeagues.includes(team.leagueId);
        });
      }
      
      return {
        ...prev,
        countries: newCountries,
        leagues: newLeagues,
        teams: newTeams
      };
    });
  };

  const handleLeagueChange = (leagueId) => {
    setLocalFilters(prev => {
      const newLeagues = prev.leagues.includes(leagueId)
        ? prev.leagues.filter(id => id !== leagueId)
        : [...prev.leagues, leagueId];
      
      // When deselecting a league, remove all its teams
      let newTeams = [...prev.teams];
      
      if (prev.leagues.includes(leagueId)) {
        // League was deselected, remove its teams
        newTeams = newTeams.filter(teamId => {
          const team = filterData.teams.find(t => t.id === teamId);
          return team && team.leagueId !== leagueId;
        });
      }
      
      return {
        ...prev,
        leagues: newLeagues,
        teams: newTeams
      };
    });
  };

  const handleTeamChange = (teamId) => {
    setLocalFilters(prev => {
      const newTeams = prev.teams.includes(teamId)
        ? prev.teams.filter(id => id !== teamId)
        : [...prev.teams, teamId];
      
      return {
        ...prev,
        teams: newTeams
      };
    });
  };

  const handleSelectAllCountries = () => {
    const allCountryIds = filterData.countries.map(country => country.id);
    setLocalFilters(prev => ({
      ...prev,
      countries: allCountryIds,
      leagues: filterData.leagues.map(league => league.id),
      teams: filterData.teams.map(team => team.id)
    }));
  };

  const handleSelectAllLeagues = (countryId) => {
    const countryLeagues = filterData.leagues.filter(league => 
      league.countryId === countryId
    ).map(league => league.id);
    
    setLocalFilters(prev => {
      const newLeagues = [...prev.leagues];
      countryLeagues.forEach(leagueId => {
        if (!newLeagues.includes(leagueId)) {
          newLeagues.push(leagueId);
        }
      });
      
      return {
        ...prev,
        leagues: newLeagues
      };
    });
  };

  const handleSelectAllTeams = (leagueId) => {
    const leagueTeams = filterData.teams.filter(team => 
      team.leagueId === leagueId
    ).map(team => team.id);
    
    setLocalFilters(prev => {
      const newTeams = [...prev.teams];
      leagueTeams.forEach(teamId => {
        if (!newTeams.includes(teamId)) {
          newTeams.push(teamId);
        }
      });
      
      return {
        ...prev,
        teams: newTeams
      };
    });
  };

  const getCountrySelectionState = (countryId) => {
    const countryLeagues = filterData.leagues.filter(league => 
      league.countryId === countryId
    );
    const selectedCountryLeagues = localFilters.leagues.filter(leagueId => 
      countryLeagues.some(league => league.id === leagueId)
    );
    
    if (selectedCountryLeagues.length === 0) return 'none';
    if (selectedCountryLeagues.length === countryLeagues.length) return 'all';
    return 'some';
  };

  const getLeagueSelectionState = (leagueId) => {
    const leagueTeams = filterData.teams.filter(team => 
      team.leagueId === leagueId
    );
    const selectedLeagueTeams = localFilters.teams.filter(teamId => 
      leagueTeams.some(team => team.id === teamId)
    );
    

    
    if (selectedLeagueTeams.length === 0) return 'none';
    if (selectedLeagueTeams.length === leagueTeams.length) return 'all';
    return 'some';
  };

  const handleClearAll = () => {
    const cleared = { countries: [], leagues: [], teams: [] };
    setLocalFilters(cleared);
    // Immediately apply cleared filters so results update without pressing Apply
    if (typeof onFiltersChange === 'function') {
      onFiltersChange(cleared);
    }
  };

  const handleReset = () => {
    if (selectedFilters) {
      setLocalFilters(selectedFilters);
    }
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  // Render nested leagues section for a country
  const renderLeaguesSection = useCallback((country) => {
    const countryLeagues = filterData.leagues.filter(league => league.countryId === country.id);
    
    if (countryLeagues.length === 0) return null;
    
    return (
      <View style={styles.nestedSection}>
        <View style={styles.nestedHeader}>
          <Text style={styles.nestedTitle}>Leagues</Text>
          <TouchableOpacity onPress={() => handleSelectAllLeagues(country.id)}>
            <Text style={styles.selectAllText}>Select All</Text>
          </TouchableOpacity>
        </View>
        
        {countryLeagues.map(league => {
          const isLeagueSelected = localFilters.leagues.includes(league.id);
          const isLeagueExpanded = expandedLeagueId === league.id;
          const leagueTeams = filterData.teams.filter(team => team.leagueId === league.id);
          
          return (
            <FilterAccordion
              key={league.id}
              id={league.id}
              name={league.name}
              count={league.count || 0}
              checked={isLeagueSelected}
              expanded={isLeagueExpanded}
              onToggle={() => handleLeagueChange(league.id)}
              onExpand={() => setExpandedLeagueId(prev => prev === league.id ? null : league.id)}
              accessibilityLabel={`Filter by ${league.name} league`}
            >
              {isLeagueExpanded && leagueTeams.length > 0 && (
                <View style={styles.nestedSection}>
                  <View style={styles.nestedHeader}>
                    <Text style={styles.nestedTitle}>Teams</Text>
                    <TouchableOpacity onPress={() => handleSelectAllTeams(league.id)}>
                      <Text style={styles.selectAllText}>Select All</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {leagueTeams.map(team => (
                    <View key={team.id} style={styles.nestedItem}>
                      <View style={styles.filterRow}>
                        <CheckBox
                          title={team.name}
                          checked={localFilters.teams.includes(team.id)}
                          onPress={() => handleTeamChange(team.id)}
                          checkedColor={colors.primary}
                          uncheckedColor={colors.text.secondary}
                          containerStyle={styles.checkboxContainer}
                          textStyle={styles.checkboxText}
                          accessibilityLabel={`Filter by ${team.name} team`}
                        />
                        <View style={styles.filterItemRight}>
                          <View style={styles.countChip}>
                            <Text style={styles.countText}>{team.count || 0}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </FilterAccordion>
          );
        })}
      </View>
    );
  }, [filterData, localFilters, expandedLeagueId, handleLeagueChange, handleTeamChange, handleSelectAllLeagues, handleSelectAllTeams]);

  // Render country section using FilterSection component
  const renderCountrySection = () => {
    return (
      <FilterSection
        title="Countries"
        items={filterData.countries || []}
        selectedIds={localFilters.countries}
        expandedId={expandedCountryId}
        onItemToggle={handleCountryChange}
        onItemExpand={(countryId) => {
          setExpandedCountryId(prev => prev === countryId ? null : countryId);
          setExpandedLeagueId(null);
        }}
        onSelectAll={handleSelectAllCountries}
        getNestedItems={(country) => filterData.leagues.filter(league => league.countryId === country.id)}
        renderNestedContent={(country) => renderLeaguesSection(country)}
        emptyMessage="No countries available from search results"
      />
    );
  };

  return (
    <ErrorBoundary>
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Filter Matches</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Available Filters Summary (always visible) */}
          <View style={styles.availableFiltersContainer}>
            <Text style={styles.availableFiltersText}>
              Available: {(filterData?.countries?.length || 0)} countries · {(filterData?.leagues?.length || 0)} leagues · {(filterData?.teams?.length || 0)} teams
            </Text>
          </View>

          {/* Active Filters Summary */}
          {getTotalFilters() > 0 ? (
            <View style={styles.activeFiltersContainer}>
              <Text style={styles.activeFiltersText}>
                {getTotalFilters()} filter{getTotalFilters() !== 1 ? 's' : ''} selected
              </Text>
              <TouchableOpacity onPress={handleClearAll}>
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.activeFiltersContainer}>
              <Text style={styles.activeFiltersText}>No filters selected yet</Text>
            </View>
          )}

          {/* Current Filters Summary - Always rendered to maintain fixed size */}
          <View style={[
            styles.currentFiltersSummary,
            getTotalFilters() === 0 && styles.currentFiltersSummaryHidden
          ]}>
            <Text style={styles.currentFiltersTitle}>Currently Applied:</Text>
            {localFilters.countries.length > 0 && (
              <Text style={styles.currentFilterItem}>
                Countries: {localFilters.countries.length} selected
              </Text>
            )}
            {localFilters.leagues.length > 0 && (
              <Text style={styles.currentFilterItem}>
                Leagues: {localFilters.leagues.length} selected
              </Text>
            )}
            {localFilters.teams.length > 0 && (
              <Text style={styles.currentFilterItem}>
                Teams: {localFilters.teams.length} selected
              </Text>
            )}
          </View>

          {/* Filter Content - Fixed height to prevent modal resizing */}
          <View style={[
            styles.contentWrapper,
            { height: contentWrapperHeight }
          ]}>
            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: spacing.md + spacing.lg + (insets?.bottom || 0) }
              ]}
            >

              
              {renderCountrySection()}
            </ScrollView>
          </View>

          {/* Footer Actions */}
          <View style={[styles.footer, { paddingBottom: 16 + (insets?.bottom || 0) }]}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApply}
              disabled={false}
            >
              <Text style={styles.applyButtonText}>
                Apply Filters ({getTotalFilters()})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </Modal>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    width: '90%',
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    ...typography.h2, // Uses design token fontFamily
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.cardGrey,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  availableFiltersContainer: {
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  availableFiltersText: {
    ...typography.bodySmall, // Uses design token fontFamily
    color: colors.text.secondary,
  },
  activeFiltersText: {
    ...typography.bodySmall, // Uses design token fontFamily
    color: colors.text.secondary,
  },
  clearAllText: {
    ...typography.bodySmall, // Uses design token fontFamily
    color: colors.primary,
    fontWeight: '500',
  },
  currentFiltersSummary: {
    backgroundColor: colors.cardGrey,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  currentFiltersTitle: {
    ...typography.bodySmall, // Uses design token fontFamily
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  currentFilterItem: {
    ...typography.caption, // Uses design token fontFamily
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  contentWrapper: {
    backgroundColor: colors.card,
    // height is set dynamically via inline style to maintain fixed modal size
  },
  currentFiltersSummaryHidden: {
    height: 0,
    padding: 0,
    margin: 0,
    overflow: 'hidden',
    opacity: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  // Styles still used in renderLeaguesSection for nested teams
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
  nestedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  nestedTitle: {
    ...typography.body,
    fontWeight: '500',
    color: colors.text.primary,
  },
  nestedItem: {
    marginBottom: spacing.xs,
  },
  selectAllText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.cardGrey,
  },
  resetButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  resetButtonText: {
    ...typography.button, // Uses design token fontFamily
    color: colors.text.secondary,
    fontWeight: '500',
  },
  applyButton: {
    flex: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  applyButtonDisabled: {
    backgroundColor: colors.interactive.disabled,
  },
  applyButtonText: {
    ...typography.button, // Uses design token fontFamily
    color: colors.onPrimary,
    fontWeight: '600',
  },
});

export default FilterModal;