import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const FilterModal = ({ 
  visible, 
  onClose, 
  filterData,
  selectedFilters,
  onFiltersChange 
}) => {
  console.log('FilterModal received filterData:', filterData);
  console.log('FilterModal received selectedFilters:', selectedFilters);
  const [localFilters, setLocalFilters] = useState({
    countries: [],
    leagues: [],
    teams: []
  });

  // Initialize local filters when modal opens
    useEffect(() => {
    console.log('useEffect triggered - visible:', visible, 'selectedFilters:', selectedFilters, 'filterData:', filterData);

    if (visible && selectedFilters) {
      console.log('Setting localFilters from selectedFilters:', selectedFilters);
      setLocalFilters(selectedFilters);
    }

    // Auto-select countries based on available matches - ONLY when modal first opens AND no filters are applied
    if (visible && filterData && filterData.countries && filterData.countries.length > 0) {
      const hasExistingFilters = selectedFilters && (
        selectedFilters.countries.length > 0 || 
        selectedFilters.leagues.length > 0 || 
        selectedFilters.teams.length > 0
      );
      
      // Only auto-select if there are no existing filters
      if (!hasExistingFilters) {
        // If only one country, auto-select it and its leagues/teams
        if (filterData.countries.length === 1) {
          const singleCountry = filterData.countries[0];
          
          // Get leagues for this country
          const countryLeagues = filterData.leagues.filter(league => 
            league.countryId === singleCountry.id
          );
          
          // Auto-select single league if only one exists
          let leaguesToSelect = [];
          if (countryLeagues.length === 1) {
            const singleLeague = countryLeagues[0];
            leaguesToSelect = [singleLeague.id];
          }
          
          // Get teams for selected leagues
          let teamsToSelect = [];
          if (leaguesToSelect.length > 0) {
            const leagueTeams = filterData.teams.filter(team => 
              leaguesToSelect.includes(team.leagueId)
            );
            
            // Auto-select single team if only one exists in a league
            leaguesToSelect.forEach(leagueId => {
              const leagueTeamCount = leagueTeams.filter(team => team.leagueId === leagueId).length;
              if (leagueTeamCount === 1) {
                const singleTeam = leagueTeams.find(team => team.leagueId === leagueId);
                if (singleTeam) {
                  teamsToSelect.push(singleTeam.id);
                }
              }
            });
          }
          
          setLocalFilters(prev => ({
            ...prev,
            countries: [singleCountry.id],
            leagues: leaguesToSelect,
            teams: teamsToSelect
          }));
        } 
        // If multiple countries, auto-select ALL of them and their leagues/teams
        else if (filterData.countries.length > 1) {
          const allCountryIds = filterData.countries.map(country => country.id);
          const allLeagueIds = filterData.leagues.map(league => league.id);
          const allTeamIds = filterData.teams.map(team => team.id);
          
          setLocalFilters(prev => ({
            ...prev,
            countries: allCountryIds,
            leagues: allLeagueIds,
            teams: allTeamIds
          }));
        }
      }
    }
  }, [visible, selectedFilters]); // Removed filterData from dependencies

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
    setLocalFilters({
      countries: [],
      leagues: [],
      teams: []
    });
  };

  const handleReset = () => {
    if (selectedFilters) {
      setLocalFilters(selectedFilters);
    }
  };

  const handleApply = () => {
    const totalFilters = localFilters.countries.length + localFilters.leagues.length + localFilters.teams.length;
    
    if (totalFilters > 10) {
      Alert.alert(
        'Too Many Filters',
        'Please select a maximum of 10 filters.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    onFiltersChange(localFilters);
    onClose();
  };

  const getTotalFilters = () => {
    const total = localFilters.countries.length + localFilters.leagues.length + localFilters.teams.length;
    return total;
  };

  const renderCheckbox = (checked, onPress, disabled = false) => (
    <TouchableOpacity
      style={[
        styles.checkbox,
        checked && styles.checkboxChecked,
        disabled && styles.checkboxDisabled
      ]}
      onPress={onPress}
      disabled={disabled}
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
          
          return (
            <View key={country.id} style={styles.filterItem}>
              <TouchableOpacity
                style={styles.filterItemContent}
                onPress={() => handleCountryChange(country.id)}
              >
                {renderCheckbox(
                  isSelected,
                  () => handleCountryChange(country.id)
                )}
                <Text style={styles.filterItemText}>{country.name}</Text>
                <View style={styles.countChip}>
                  <Text style={styles.countText}>{country.count || 0}</Text>
                </View>
              </TouchableOpacity>
              
              {/* Show leagues for this country */}
              {isSelected && (
                <View style={styles.nestedSection}>
                  <View style={styles.nestedHeader}>
                    <Text style={styles.nestedTitle}>Leagues</Text>
                    <TouchableOpacity onPress={() => handleSelectAllLeagues(country.id)}>
                      <Text style={styles.selectAllText}>Select All</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {filterData.leagues
                    .filter(league => league.countryId === country.id)
                    .map(league => {
                      const isLeagueSelected = localFilters.leagues.includes(league.id);
                      const leagueSelectionState = getLeagueSelectionState(league.id);
                      const isLeagueIndeterminate = leagueSelectionState === 'some';
                      
                      return (
                        <View key={league.id} style={styles.nestedItem}>
                          <TouchableOpacity
                            style={styles.filterItemContent}
                            onPress={() => handleLeagueChange(league.id)}
                          >
                            {renderCheckbox(
                              isLeagueSelected,
                              () => handleLeagueChange(league.id)
                            )}
                            <Text style={styles.filterItemText}>{league.name}</Text>
                            <View style={styles.countChip}>
                              <Text style={styles.countText}>{league.count || 0}</Text>
                            </View>
                          </TouchableOpacity>
                          
                          {/* Show teams for this league */}
                          {isLeagueSelected && (
                            <View style={styles.nestedSection}>
                              <View style={styles.nestedHeader}>
                                <Text style={styles.nestedTitle}>Teams</Text>
                                <TouchableOpacity onPress={() => handleSelectAllTeams(league.id)}>
                                  <Text style={styles.selectAllText}>Select All</Text>
                                </TouchableOpacity>
                              </View>
                              
                              {filterData.teams
                                .filter(team => team.leagueId === league.id)
                                .map(team => (
                                  <View key={team.id} style={styles.nestedItem}>
                                    <TouchableOpacity
                                      style={styles.filterItemContent}
                                      onPress={() => handleTeamChange(team.id)}
                                    >
                                      {renderCheckbox(
                                        localFilters.teams.includes(team.id),
                                        () => handleTeamChange(team.id)
                                      )}
                                      <Text style={styles.filterItemText}>{team.name}</Text>
                                      <View style={styles.countChip}>
                                        <Text style={styles.countText}>{team.count || 0}</Text>
                                      </View>
                                    </TouchableOpacity>
                                  </View>
                                ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
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

          {/* Active Filters Summary */}
          {getTotalFilters() > 0 && (
            <View style={styles.activeFiltersContainer}>
              <Text style={styles.activeFiltersText}>
                {getTotalFilters()} filter{getTotalFilters() !== 1 ? 's' : ''} selected
              </Text>
              <TouchableOpacity onPress={handleClearAll}>
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Current Filters Summary */}
          {getTotalFilters() > 0 && (
            <View style={styles.currentFiltersSummary}>
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
          )}

          {/* Filter Content */}
          <View style={styles.contentWrapper}>
            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              contentContainerStyle={styles.scrollContent}
            >

              
              {renderCountrySection()}
            </ScrollView>
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.applyButton,
                getTotalFilters() === 0 && styles.applyButtonDisabled
              ]}
              onPress={handleApply}
              disabled={getTotalFilters() === 0}
            >
              <Text style={styles.applyButtonText}>
                Apply Filters ({getTotalFilters()})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxHeight: '85%',
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  activeFiltersText: {
    fontSize: 14,
    color: '#666',
  },
  clearAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  currentFiltersSummary: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  currentFiltersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  currentFilterItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: 'white',
    minHeight: 300, // Give explicit minimum height
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  selectAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  filterItem: {
    marginBottom: 8,
  },
  filterItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
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
  filterItemText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  countChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  nestedSection: {
    marginLeft: 32,
    marginTop: 8,
  },
  nestedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nestedTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
  },
  nestedItem: {
    marginBottom: 6,
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  applyButton: {
    flex: 2,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonDisabled: {
    backgroundColor: '#ccc',
  },
  applyButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
});

export default FilterModal;