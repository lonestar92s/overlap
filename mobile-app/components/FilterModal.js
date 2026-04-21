import React, { useState, useEffect, useMemo, useCallback, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { CheckBox } from 'react-native-elements';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import ErrorBoundary from './ErrorBoundary';
import FilterSection from './FilterSection';
import FilterAccordion from './FilterAccordion';
import FilterChip from './FilterChip';
import { colors, spacing, typography, borderRadius, iconSizes } from '../styles/designTokens';

const FilterModal = forwardRef(({
  visible,
  onClose,
  filterData,
  selectedFilters,
  onFiltersChange,
  previewMatchCount,
}, ref) => {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = React.useRef(null);
  const [expandedCountryId, setExpandedCountryId] = useState(null);
  const [expandedLeagueId, setExpandedLeagueId] = useState(null);

  const [localFilters, setLocalFilters] = useState({
    countries: [],
    leagues: [],
    teams: []
  });

  // Snap points for bottom sheet - single fixed height at 75%
  const snapPoints = useMemo(() => ['75%'], []);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    present: () => {
      bottomSheetRef.current?.present();
    },
    dismiss: () => {
      bottomSheetRef.current?.dismiss();
    },
    // Keep expand/close for backwards compatibility
    expand: () => {
      bottomSheetRef.current?.present();
    },
    close: () => {
      bottomSheetRef.current?.dismiss();
    },
  }));

  // Helper function to get total filters count
  const getTotalFilters = useCallback(() => {
    return localFilters.countries.length + localFilters.leagues.length + localFilters.teams.length;
  }, [localFilters]);

  // Initialize local filters when drawer opens
  useEffect(() => {
    if (visible && selectedFilters) {
      setLocalFilters(selectedFilters);
    }
  }, [visible, selectedFilters]);

  // BottomSheetModal doesn't need index prop - controlled via present()/dismiss()

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

  const handleClearAll = useCallback(() => {
    const cleared = { countries: [], leagues: [], teams: [] };
    setLocalFilters(cleared);
    if (typeof onFiltersChange === 'function') {
      onFiltersChange(cleared);
    }
  }, [onFiltersChange]);

  const handleApply = useCallback(() => {
    onFiltersChange(localFilters);
    if (onClose) {
      onClose();
    }
  }, [localFilters, onFiltersChange, onClose]);

  // Render nested leagues section for a country
  const renderLeaguesSection = useCallback((country) => {
    const countryLeagues = filterData.leagues.filter(league => league.countryId === country.id);
    
    if (countryLeagues.length === 0) return null;
    
    return (
      <View style={styles.leaguesBlock}>
        <View style={styles.nestedHeader}>
          <Text style={styles.nestedTitle}>Leagues</Text>
          <TouchableOpacity 
            onPress={() => handleSelectAllLeagues(country.id)}
            accessibilityRole="button"
            accessibilityLabel="Select all leagues"
          >
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
              hasNestedItems={leagueTeams.length > 0}
              accessibilityLabel={`Filter by ${league.name} league`}
            >
              {isLeagueExpanded && leagueTeams.length > 0 && (
                <View style={styles.teamsBlock}>
                  <View style={styles.nestedHeader}>
                    <Text style={styles.nestedTitle}>Teams</Text>
                    <TouchableOpacity 
                      onPress={() => handleSelectAllTeams(league.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Select all teams"
                    >
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

  // Handle modal dismissal (when user closes it)
  const handleDismiss = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  // Handle visibility changes - use present()/dismiss() for BottomSheetModal
  useEffect(() => {
    if (!bottomSheetRef.current) {
      return;
    }

    if (visible) {
      try {
        bottomSheetRef.current.present();
      } catch (error) {
        if (__DEV__) {
          console.error('Error opening filter drawer:', error);
        }
      }
    } else {
      try {
        bottomSheetRef.current.dismiss();
      } catch (error) {
        if (__DEV__) {
          console.error('Error closing filter drawer:', error);
        }
      }
    }
  }, [visible]);

  // Custom handle component for bottom sheet
  const renderHandle = () => (
    <View style={styles.handleContainer}>
      <View style={styles.handleBar} />
      <View style={styles.handleContent}>
        <Text style={styles.handleTitle}>Filters</Text>
        <TouchableOpacity 
          onPress={onClose} 
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close filter drawer"
        >
          <Ionicons name="close" size={iconSizes.md} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const previewCount = useMemo(() => {
    if (typeof previewMatchCount !== 'function') return null;
    return previewMatchCount(localFilters);
  }, [previewMatchCount, localFilters]);

  const applyCtaLabel = useMemo(() => {
    if (previewCount !== null) {
      return `Show ${previewCount} match${previewCount === 1 ? '' : 'es'}`;
    }
    return `Apply (${getTotalFilters()})`;
  }, [previewCount, getTotalFilters]);

  const selectedChipItems = useMemo(() => {
    if (!filterData) return [];
    const countries = filterData.countries || [];
    const leagues = filterData.leagues || [];
    const teams = filterData.teams || [];
    const chips = [];
    const matchId = (a, b) => String(a) === String(b);

    localFilters.countries.forEach((id) => {
      const c = countries.find((x) => matchId(x.id, id));
      chips.push({
        type: 'country',
        id,
        label: c?.name || 'Country',
        key: `c-${id}`,
      });
    });
    localFilters.leagues.forEach((id) => {
      const l = leagues.find((x) => matchId(x.id, id));
      chips.push({
        type: 'league',
        id,
        label: l?.name || 'League',
        key: `l-${id}`,
      });
    });
    localFilters.teams.forEach((id) => {
      const t = teams.find((x) => matchId(x.id, id));
      chips.push({
        type: 'team',
        id,
        label: t?.name || 'Team',
        key: `t-${id}`,
      });
    });
    return chips;
  }, [localFilters, filterData]);

  const recommendedLeagues = useMemo(() => {
    const leagues = filterData?.leagues || [];
    const selected = new Set(localFilters.leagues.map((id) => String(id)));
    return [...leagues]
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .filter((l) => !selected.has(String(l.id)))
      .slice(0, 8);
  }, [filterData, localFilters.leagues]);

  // Log when component renders
  if (__DEV__) {
  }

  return (
    <ErrorBoundary>
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose={true}
        enableContentPanningGesture={true}
        enableHandlePanningGesture={true}
        keyboardBehavior="interactive"
        onDismiss={handleDismiss}
        backgroundStyle={styles.bottomSheetBackground}
        handleComponent={renderHandle}
        bottomInset={insets.bottom}
      >
        <BottomSheetView style={styles.content}>
          <View style={styles.sheetColumn}>
            {getTotalFilters() > 0 ? (
              <View style={styles.selectedSection}>
                <Text style={styles.selectedSectionTitle}>Selected</Text>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.selectedChipsRow}
                >
                  {selectedChipItems.map((chip) => (
                    <FilterChip
                      key={chip.key}
                      label={chip.label}
                      onRemove={() => {
                        if (chip.type === 'country') handleCountryChange(chip.id);
                        else if (chip.type === 'league') handleLeagueChange(chip.id);
                        else handleTeamChange(chip.id);
                      }}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : (
              <View style={styles.hintSection}>
                <Text style={styles.hintText}>
                  {`Choose from ${filterData?.countries?.length || 0} countries, ${filterData?.leagues?.length || 0} leagues, ${filterData?.teams?.length || 0} teams`}
                </Text>
              </View>
            )}

            <View style={styles.sectionRule} />

            <BottomSheetScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {recommendedLeagues.length > 0 && (
                <View style={styles.recommendedBlock}>
                  <Text style={styles.recommendedTitle}>Popular leagues</Text>
                  <ScrollView
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.recommendedRow}
                  >
                    {recommendedLeagues.map((league) => (
                      <TouchableOpacity
                        key={league.id}
                        style={styles.recommendedPill}
                        onPress={() => handleLeagueChange(league.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${league.name} filter`}
                      >
                        <Text style={styles.recommendedPillPlus}>+</Text>
                        <Text style={styles.recommendedPillText} numberOfLines={1}>
                          {league.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={styles.sectionRule} />
                </View>
              )}
              {renderCountrySection()}
            </BottomSheetScrollView>

            <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
              <TouchableOpacity
                style={styles.footerClearAll}
                onPress={handleClearAll}
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
              >
                <Text style={styles.footerClearAllText}>Clear all</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyButton}
                onPress={handleApply}
                disabled={false}
                accessibilityRole="button"
                accessibilityLabel={applyCtaLabel}
              >
                <Text style={styles.applyButtonText}>{applyCtaLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </ErrorBoundary>
  );
});

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  handleContainer: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  handleBar: {
    width: spacing.xl * 2,
    height: spacing.xs / 2,
    backgroundColor: colors.border,
    borderRadius: borderRadius.pill,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  handleContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  handleTitle: {
    ...typography.h2,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
    minWidth: spacing.xl + spacing.xs,
    minHeight: spacing.xl + spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // BottomSheetView merges position:absolute + top/left/right only; without bottom:0
  // height follows intrinsic content, so expanded lists push the footer off-screen and
  // BottomSheetScrollView never gets a bounded height. Pin bottom to fill the sheet body.
  content: {
    flex: 1,
    minHeight: 0,
    bottom: 0,
    backgroundColor: colors.card,
  },
  sheetColumn: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
    backgroundColor: colors.card,
  },
  hintSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
  },
  hintText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  selectedSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.card,
  },
  selectedSectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  selectedChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    paddingBottom: spacing.xs,
  },
  sectionRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
  },
  recommendedBlock: {
    marginBottom: spacing.md,
  },
  recommendedTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    paddingHorizontal: 0,
  },
  recommendedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  recommendedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 200,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    backgroundColor: colors.card,
  },
  recommendedPillPlus: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.text.primary,
    marginRight: spacing.xs,
  },
  recommendedPillText: {
    ...typography.bodySmall,
    color: colors.text.primary,
    flexShrink: 1,
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
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
  leaguesBlock: {
    marginTop: spacing.sm,
  },
  teamsBlock: {
    marginTop: spacing.sm,
  },
  nestedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
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
    flexShrink: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.cardGrey,
  },
  footerClearAll: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
  },
  footerClearAllText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
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

FilterModal.displayName = 'FilterModal';

export default FilterModal;