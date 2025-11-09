import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import LocationAutocomplete from './LocationAutocomplete';
import ApiService from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';

const RECENT_SEARCHES_KEY = 'searchRecentLocations';
const MAX_RECENT_SEARCHES = 5;

const LocationSearchModal = ({ visible, onClose, navigation }) => {
  const [location, setLocation] = useState(null);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [selectedDates, setSelectedDates] = useState({});
  const [loading, setLoading] = useState(false);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  
  // Collapsible states
  const [whereExpanded, setWhereExpanded] = useState(true);
  const [whenExpanded, setWhenExpanded] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Recent searches
  const [recentSearches, setRecentSearches] = useState([]);
  
  // Suggested teams
  const [suggestedTeams, setSuggestedTeams] = useState([]);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('Matches');
  
  const { user } = useAuth();

  // Load recent searches and suggested teams
  useEffect(() => {
    if (visible) {
      loadRecentSearches();
      loadSuggestedTeams();
    }
  }, [visible]);

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = async (locationData) => {
    try {
      const newSearch = {
        id: Date.now().toString(),
        location: locationData.city || locationData.name || 'Unknown',
        city: locationData.city,
        country: locationData.country,
        lat: locationData.lat,
        lon: locationData.lon,
      };
      
      const updated = [newSearch, ...recentSearches.filter(s => s.id !== newSearch.id)].slice(0, MAX_RECENT_SEARCHES);
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  const clearRecentSearches = async () => {
    try {
      setRecentSearches([]);
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  };

  const loadSuggestedTeams = async () => {
    try {
      if (user) {
        const prefs = await ApiService.getPreferences();
        const teams = [];
        
        // Add favorite teams (limit to 3)
        if (prefs.favoriteTeams && prefs.favoriteTeams.length > 0) {
          const favoriteTeams = prefs.favoriteTeams.slice(0, 3).map(ft => ({
            id: ft.teamId?.apiId || ft.teamId?._id || ft.teamId,
            name: ft.teamId?.name || 'Team',
            country: ft.teamId?.country || '',
            badge: ft.teamId?.badge,
          }));
          teams.push(...favoriteTeams);
        }
        
        setSuggestedTeams(teams);
      }
    } catch (error) {
      // Ignore if user is not authenticated or preferences not available
      console.log('Could not load suggested teams:', error);
      setSuggestedTeams([]);
    }
  };

  const handleLocationSelect = (selectedLocation) => {
    setLocation(selectedLocation);
    setLocationSearchQuery(selectedLocation.city || selectedLocation.name || '');
    saveRecentSearch(selectedLocation);
  };

  const handleRecentSearchSelect = (search) => {
    const locationData = {
      city: search.city,
      country: search.country,
      lat: search.lat,
      lon: search.lon,
      name: search.location,
    };
    setLocation(locationData);
    setLocationSearchQuery(search.location);
  };

  const formatDateRange = () => {
    if (!dateFrom && !dateTo) return 'Add Dates';
    if (dateFrom && !dateTo) {
      const date = new Date(dateFrom);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    if (dateFrom && dateTo) {
      const start = new Date(dateFrom);
      const end = new Date(dateTo);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return 'Add Dates';
  };

  const onDayPress = (day) => {
    const dateString = day.dateString;
    
    if (!dateFrom || (dateFrom && dateTo)) {
      setDateFrom(dateString);
      setDateTo(null);
      setSelectedDates({
        [dateString]: {
          selected: true,
          startingDay: true,
          color: colors.primary,
          textColor: colors.onPrimary
        }
      });
    } else if (dateFrom && !dateTo) {
      if (dateString < dateFrom) {
        setDateFrom(dateString);
        setDateTo(null);
        setSelectedDates({
          [dateString]: {
            selected: true,
            startingDay: true,
            color: colors.primary,
            textColor: colors.onPrimary
          }
        });
      } else {
        setDateTo(dateString);
        const range = {};
        const start = new Date(dateFrom);
        const end = new Date(dateString);
        const current = new Date(start);
        
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          if (dateStr === dateFrom) {
            range[dateStr] = { selected: true, startingDay: true, color: colors.primary, textColor: colors.onPrimary };
          } else if (dateStr === dateString) {
            range[dateStr] = { selected: true, endingDay: true, color: colors.primary, textColor: colors.onPrimary };
          } else {
            range[dateStr] = { selected: true, color: colors.primary + '40', textColor: colors.text.primary };
          }
          current.setDate(current.getDate() + 1);
        }
        setSelectedDates(range);
      }
    }
  };

  const clearAll = () => {
    setLocation(null);
    setLocationSearchQuery('');
    setDateFrom(null);
    setDateTo(null);
    setSelectedDates({});
    clearRecentSearches();
  };

  const handleSearch = async () => {
    if (!location) {
      Alert.alert('Error', 'Please select a location');
      return;
    }
    if (!dateFrom || !dateTo) {
      Alert.alert('Error', 'Please select your travel dates');
      return;
    }

    setLoading(true);
    try {
      const bounds = {
        northeast: {
          lat: location.lat + 0.25,
          lng: location.lon + 0.25,
        },
        southwest: {
          lat: location.lat - 0.25,
          lng: location.lon - 0.25,
        }
      };

      const response = await ApiService.searchMatchesByBounds({
        bounds,
        dateFrom,
        dateTo,
      });

      if (response.success) {
        onClose(); // Close modal before navigating
        navigation.navigate('MapResults', {
          searchParams: {
            location,
            dateFrom,
            dateTo,
          },
          matches: response.data || [],
          initialRegion: {
            latitude: location.lat,
            longitude: location.lon,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
          },
          hasWho: false,
        });
      } else {
        Alert.alert('Error', 'Failed to search matches');
      }
      setLoading(false);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', error.message || 'Failed to search matches');
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header with tabs and close button */}
        <View style={styles.header}>
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'Matches' && styles.tabActive]}
              onPress={() => setActiveTab('Matches')}
            >
              <Text style={[styles.tabText, activeTab === 'Matches' && styles.tabTextActive]}>
                Matches
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'League' && styles.tabActive]}
              onPress={() => setActiveTab('League')}
            >
              <Text style={[styles.tabText, activeTab === 'League' && styles.tabTextActive]}>
                League
              </Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <MaterialIcons name="close" size={15} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Where Card - Collapsible */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => setWhereExpanded(!whereExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.cardTitle}>Where?</Text>
              <MaterialIcons
                name={whereExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>

            {whereExpanded && (
              <View style={styles.cardContent}>
                {/* Location Search Input */}
                <TouchableOpacity
                  style={styles.searchInputContainer}
                  onPress={() => {
                    setShowLocationSearch(true);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="search" size={25} color="rgba(0, 0, 0, 0.5)" />
                  <Text style={styles.searchPlaceholder}>
                    {locationSearchQuery || 'Search by location'}
                  </Text>
                </TouchableOpacity>
                
                {/* Location Autocomplete - shown when searching */}
                {showLocationSearch && (
                  <View style={styles.locationAutocompleteContainer}>
                    <LocationAutocomplete
                      value=""
                      onSelect={(selectedLocation) => {
                        handleLocationSelect(selectedLocation);
                        setShowLocationSearch(false);
                      }}
                      placeholder="Search by location"
                    />
                  </View>
                )}

                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <View style={styles.recentSection}>
                    <Text style={styles.sectionLabel}>Recent searches</Text>
                    {recentSearches.map((search) => (
                      <TouchableOpacity
                        key={search.id}
                        style={styles.recentItem}
                        onPress={() => handleRecentSearchSelect(search)}
                      >
                        <MaterialIcons name="location-on" size={40} color={colors.text.primary} />
                        <View style={styles.recentItemText}>
                          <Text style={styles.recentItemTitle}>{search.location}</Text>
                          <Text style={styles.recentItemSubtitle}>Matches happening near you</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Suggested Teams */}
                {suggestedTeams.length > 0 && (
                  <View style={styles.suggestedSection}>
                    <Text style={styles.sectionLabel}>Suggested Teams</Text>
                    {suggestedTeams.map((team) => (
                      <TouchableOpacity
                        key={team.id}
                        style={styles.suggestedItem}
                        activeOpacity={0.7}
                      >
                        <View style={styles.teamIcon}>
                          {team.badge ? (
                            <Image source={{ uri: team.badge }} style={styles.teamBadge} />
                          ) : (
                            <View style={styles.teamIconCircle}>
                              <Text style={styles.teamIconText}>{team.name?.[0] || 'T'}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.suggestedItemText}>
                          <Text style={styles.suggestedItemTitle}>{team.name}</Text>
                          <Text style={styles.suggestedItemSubtitle}>{team.country || 'Spain'}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* When Card - Collapsible */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => {
                setWhenExpanded(!whenExpanded);
                if (!whenExpanded) {
                  setShowCalendar(true);
                }
              }}
              activeOpacity={0.7}
            >
              <View>
                <Text style={styles.cardLabel}>When</Text>
                <Text style={styles.cardValue}>{formatDateRange()}</Text>
              </View>
              <MaterialIcons
                name={whenExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>

            {whenExpanded && showCalendar && (
              <View style={styles.calendarContainer}>
                <Calendar
                  onDayPress={onDayPress}
                  markedDates={selectedDates}
                  minDate={new Date().toISOString().split('T')[0]}
                  theme={{
                    backgroundColor: colors.card,
                    calendarBackground: colors.card,
                    textSectionTitleColor: colors.text.secondary,
                    selectedDayBackgroundColor: colors.primary,
                    selectedDayTextColor: colors.onPrimary,
                    todayTextColor: colors.primary,
                    dayTextColor: colors.text.primary,
                    textDisabledColor: colors.text.light,
                    dotColor: colors.primary,
                    selectedDotColor: colors.onPrimary,
                    arrowColor: colors.primary,
                    monthTextColor: colors.text.primary,
                    textDayFontFamily: typography.fontFamily,
                    textMonthFontFamily: typography.fontFamily,
                    textDayHeaderFontFamily: typography.fontFamily,
                    textDayFontSize: 14,
                    textMonthFontSize: 16,
                    textDayHeaderFontSize: 12,
                  }}
                />
              </View>
            )}
          </View>

          {/* Who Card - Placeholder (non-functional for location-only search) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardLabel}>Who</Text>
                <Text style={styles.cardValue}>Add who</Text>
              </View>
              <MaterialIcons
                name="keyboard-arrow-down"
                size={24}
                color={colors.text.primary}
              />
            </View>
          </View>
        </ScrollView>

        {/* Bottom Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearAll}
          >
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.enterButton, (!location || !dateFrom || !dateTo) && styles.enterButtonDisabled]}
            onPress={handleSearch}
            disabled={loading || !location || !dateFrom || !dateTo}
          >
            {loading ? (
              <ActivityIndicator size="small" color="rgba(0, 0, 0, 0.5)" />
            ) : (
              <Text style={styles.enterButtonText}>Enter</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D9E8F2', // Light blue background from Figma
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: spacing.sm + spacing.xs,
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -96 }], // Center the tabs (96px total width)
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#DAF2E6', // Light green from Figma
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    width: 96,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#05A85A', // Green from Figma
    borderColor: '#05A85A',
  },
  tabText: {
    ...typography.caption,
    color: colors.text.primary,
  },
  tabTextActive: {
    color: '#EBEDF0', // Light text on green background
  },
  closeButton: {
    padding: spacing.xs,
    width: 25,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl + spacing.lg,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: borderRadius.card, // 14px from design tokens
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  cardTitle: {
    ...typography.h1,
    fontWeight: '500',
    fontSize: 24,
    color: colors.text.primary,
  },
  cardLabel: {
    ...typography.caption,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  cardValue: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  cardContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.md + spacing.xs,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 49,
    gap: spacing.sm,
  },
  searchPlaceholder: {
    flex: 1,
    ...typography.body,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  locationAutocompleteContainer: {
    marginTop: spacing.sm,
    zIndex: 1000,
  },
  recentSection: {
    gap: spacing.sm + spacing.xs + 3,
  },
  sectionLabel: {
    ...typography.caption,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.card,
    gap: spacing.xl + spacing.sm, // 36px gap from Figma
  },
  recentItemText: {
    flex: 1,
    gap: 7, // 7px gap from Figma
  },
  recentItemTitle: {
    ...typography.caption,
    color: colors.text.primary,
  },
  recentItemSubtitle: {
    ...typography.caption,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  suggestedSection: {
    gap: spacing.sm + spacing.xs + 3,
  },
  suggestedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.card,
    gap: spacing.xl + spacing.sm, // 36px gap from Figma
  },
  teamIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardGrey,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamIconText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.primary,
  },
  teamBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  suggestedItemText: {
    flex: 1,
    gap: 7, // 7px gap from Figma
  },
  suggestedItemTitle: {
    ...typography.caption,
    color: colors.text.primary,
  },
  suggestedItemSubtitle: {
    ...typography.caption,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  calendarContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg + spacing.xs + 7, // 55px from Figma
    paddingBottom: spacing.lg,
    gap: spacing.sm + spacing.xs,
  },
  clearButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 49,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    maxWidth: 160,
  },
  clearButtonText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.text.primary,
  },
  enterButton: {
    backgroundColor: '#B2E4CC', // Light green from Figma
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 49,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    maxWidth: 160,
  },
  enterButtonDisabled: {
    opacity: 0.5,
  },
  enterButtonText: {
    ...typography.caption,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.5)',
  },
});

export default LocationSearchModal;

