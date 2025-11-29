import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { debounce } from 'lodash';
import ApiService from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FlightSearchTab from './FlightSearchTab';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const RECENT_SEARCHES_KEY = 'searchRecentLocations';
const MAX_RECENT_SEARCHES = 5;

const LocationSearchModal = ({ visible, onClose, navigation }) => {
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' or 'flights'
  const [location, setLocation] = useState(null);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [selectedDates, setSelectedDates] = useState({});
  const [loading, setLoading] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  
  // Location search results
  const [locationResults, setLocationResults] = useState([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  
  // Collapsible states
  const [whereExpanded, setWhereExpanded] = useState(true);
  const [whenExpanded, setWhenExpanded] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Calendar month state - controls which month is displayed
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().split('T')[0]);
  
  // Recent searches
  const [recentSearches, setRecentSearches] = useState([]);
  
  // Ref for location search TextInput
  const locationInputRef = useRef(null);
  
  // Ref to track if we're in the middle of selecting a location (prevents double API calls)
  const isSelectingLocationRef = useRef(false);
  
  // Ref to store the debounced search function so we can cancel it
  const debouncedSearchRef = useRef(null);

  // Load recent searches
  useEffect(() => {
    if (visible) {
      loadRecentSearches();
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

  const saveRecentSearch = async (locationData, dateFrom, dateTo) => {
    try {
      const formatDateRange = (dateFrom, dateTo) => {
        if (!dateFrom && !dateTo) return 'Add Dates';
        if (dateFrom && !dateTo) {
          // Parse date string as local date (YYYY-MM-DD format)
          const [year, month, day] = dateFrom.split('-').map(Number);
          const date = new Date(year, month - 1, day);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        if (dateFrom && dateTo) {
          // Parse date strings as local dates (YYYY-MM-DD format)
          const [startYear, startMonth, startDay] = dateFrom.split('-').map(Number);
          const [endYear, endMonth, endDay] = dateTo.split('-').map(Number);
          const start = new Date(startYear, startMonth - 1, startDay);
          const end = new Date(endYear, endMonth - 1, endDay);
          return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }
        return 'Add Dates';
      };

      const newSearch = {
        id: Date.now().toString(),
        location: locationData.city || locationData.name || 'Unknown',
        city: locationData.city,
        country: locationData.country,
        lat: locationData.lat,
        lon: locationData.lon,
        dateFrom,
        dateTo,
        dateRange: formatDateRange(dateFrom, dateTo),
      };
      
      const updated = [newSearch, ...recentSearches.filter(s => 
        s.city !== newSearch.city || 
        s.country !== newSearch.country || 
        s.dateFrom !== newSearch.dateFrom || 
        s.dateTo !== newSearch.dateTo
      )].slice(0, MAX_RECENT_SEARCHES);
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

  // Location search function (not debounced)
  const performLocationSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setLocationResults([]);
      setLocationSearchLoading(false);
      return;
    }
    setLocationSearchLoading(true);
    try {
      const response = await ApiService.searchLocations(query.trim(), 5);
      if (response.success && response.suggestions) {
        setLocationResults(response.suggestions);
      } else {
        setLocationResults([]);
      }
    } catch (error) {
      console.error('Error searching locations:', error);
      setLocationResults([]);
    } finally {
      setLocationSearchLoading(false);
    }
  }, []);

  // Create debounced search function and store in ref
  useEffect(() => {
    // Cancel previous debounced function if it exists
    if (debouncedSearchRef.current) {
      debouncedSearchRef.current.cancel();
    }
    
    // Create new debounced function
    debouncedSearchRef.current = debounce(performLocationSearch, 350);
    
    // Cleanup on unmount or when performLocationSearch changes
    return () => {
      if (debouncedSearchRef.current) {
        debouncedSearchRef.current.cancel();
      }
    };
  }, [performLocationSearch]);

  useEffect(() => {
    // Don't trigger search if we're in the middle of selecting a location
    if (isSelectingLocationRef.current) {
      if (__DEV__) {
        console.log('[LocationSearchModal] Skipping search - location selection in progress');
      }
      return;
    }
    
    // Don't trigger search if we already have a location selected
    if (location) {
      if (__DEV__) {
        console.log('[LocationSearchModal] Skipping search - location already selected');
      }
      return;
    }
    
    if (isSearchingLocation && locationSearchQuery.trim().length >= 2) {
      if (__DEV__) {
        console.log('[LocationSearchModal] Triggering location search for:', locationSearchQuery);
      }
      // Use the debounced function from ref
      if (debouncedSearchRef.current) {
        debouncedSearchRef.current(locationSearchQuery);
      }
    } else {
      setLocationResults([]);
      setLocationSearchLoading(false);
    }
  }, [locationSearchQuery, isSearchingLocation, location]);

  const handleLocationSelect = (selectedLocation) => {
    if (__DEV__) {
      console.log('[LocationSearchModal] Location selected:', selectedLocation?.city, selectedLocation?.country);
    }
    
    // Set flag to prevent useEffect from triggering another search during selection
    isSelectingLocationRef.current = true;
    
    // Cancel any pending debounced searches
    if (debouncedSearchRef.current) {
      if (__DEV__) {
        console.log('[LocationSearchModal] Cancelling pending debounced search');
      }
      debouncedSearchRef.current.cancel();
    }
    
    setLocation(selectedLocation);
    const displayText = `${selectedLocation.city}${selectedLocation.region ? `, ${selectedLocation.region}` : ''}, ${selectedLocation.country}`;
    
    // IMPORTANT: Set isSearchingLocation to false FIRST to prevent useEffect from triggering another search
    // when we update locationSearchQuery below
    setIsSearchingLocation(false);
    setLocationResults([]);
    
    // Now update the query - this won't trigger a search because:
    // 1. isSearchingLocation is already false
    // 2. location will be set, which will prevent search in useEffect
    // 3. isSelectingLocationRef flag is set
    setLocationSearchQuery(displayText);
    
    // Clear the flag after a brief delay to allow state updates to complete
    // Use a longer delay (500ms) to ensure debounced calls have time to be cancelled
    setTimeout(() => {
      isSelectingLocationRef.current = false;
      if (__DEV__) {
        console.log('[LocationSearchModal] Location selection complete, flag cleared');
      }
    }, 500);
    
    // Don't save to recent searches here - only save after successful search with dates
    
    // Blur the TextInput to prevent it from refocusing and triggering search again
    if (locationInputRef.current) {
      if (__DEV__) {
        console.log('[LocationSearchModal] Blurring location input');
      }
      locationInputRef.current.blur();
    }
    
    // Dismiss keyboard after location selection
    if (__DEV__) {
      console.log('[LocationSearchModal] Dismissing keyboard');
    }
    Keyboard.dismiss();
    
    // Auto-open the "When" section (calendar) after location is selected
    if (__DEV__) {
      console.log('[LocationSearchModal] Auto-opening When section');
    }
    setWhenExpanded(true);
    setShowCalendar(true);
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
    
    // Restore dates if they exist
    if (search.dateFrom) {
      setDateFrom(search.dateFrom);
    }
    if (search.dateTo) {
      setDateTo(search.dateTo);
      
      // Restore selected dates for calendar display
      if (search.dateFrom && search.dateTo) {
        const range = {};
        const start = new Date(search.dateFrom);
        const end = new Date(search.dateTo);
        const current = new Date(start);
        
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          if (dateStr === search.dateFrom) {
            range[dateStr] = { selected: true, startingDay: true, color: colors.primary, textColor: colors.onPrimary };
          } else if (dateStr === search.dateTo) {
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

  const formatDateRange = () => {
    if (!dateFrom && !dateTo) return 'Add Dates';
    if (dateFrom && !dateTo) {
      // Parse date string as local date (YYYY-MM-DD format)
      const [year, month, day] = dateFrom.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    if (dateFrom && dateTo) {
      // Parse date strings as local dates (YYYY-MM-DD format)
      const [startYear, startMonth, startDay] = dateFrom.split('-').map(Number);
      const [endYear, endMonth, endDay] = dateTo.split('-').map(Number);
      const start = new Date(startYear, startMonth - 1, startDay);
      const end = new Date(endYear, endMonth - 1, endDay);
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
    setCurrentMonth(new Date().toISOString().split('T')[0]);
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
      // FIXED: Use same viewport-based bounds calculation as "Search this area"
      // This ensures consistent search areas between initial search and "search this area"
      const viewportDelta = 0.5; // Default viewport size (matches initialRegion)
      const bounds = {
        northeast: {
          lat: location.lat + (viewportDelta / 2),
          lng: location.lon + (viewportDelta / 2),
        },
        southwest: {
          lat: location.lat - (viewportDelta / 2),
          lng: location.lon - (viewportDelta / 2),
        }
      };

      if (__DEV__) {
        console.log('🔍 Initial search bounds (unified):', {
          center: { lat: location.lat, lng: location.lon },
          viewportDelta,
          bounds
        });
      }

      const response = await ApiService.searchMatchesByBounds({
        bounds,
        dateFrom,
        dateTo,
      });

      if (response.success) {
        // Save to recent searches after successful search
        await saveRecentSearch(location, dateFrom, dateTo);
        
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
            latitudeDelta: viewportDelta,
            longitudeDelta: viewportDelta,
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
        {/* Header with close button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel="Close search modal"
            accessibilityRole="button"
          >
            <MaterialIcons name="close" size={15} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

               {/* Tab Navigation */}
               {/* Flights tab commented out - no booking capability yet */}
               {/* <View style={styles.tabContainer}>
                 <TouchableOpacity
                   style={[styles.tab, activeTab === 'matches' && styles.activeTab]}
                   onPress={() => setActiveTab('matches')}
                   activeOpacity={0.7}
                   accessibilityLabel="Search matches"
                   accessibilityRole="tab"
                   accessibilityState={{ selected: activeTab === 'matches' }}
                 >
                   <Text style={[
                     styles.tabText,
                     activeTab === 'matches' && styles.activeTabText
                   ]}>
                     Matches
                   </Text>
                 </TouchableOpacity>
                 
                 <TouchableOpacity
                   style={[styles.tab, activeTab === 'flights' && styles.activeTab]}
                   onPress={() => setActiveTab('flights')}
                   activeOpacity={0.7}
                   accessibilityLabel="Search flights"
                   accessibilityRole="tab"
                   accessibilityState={{ selected: activeTab === 'flights' }}
                 >
                   <Text style={[
                     styles.tabText,
                     activeTab === 'flights' && styles.activeTabText
                   ]}>
                     Flights
                   </Text>
                 </TouchableOpacity>
               </View> */}

               {/* Tab Content */}
               {/* Flights tab content commented out */}
               {/* {activeTab === 'matches' ? ( */}
                 <KeyboardAvoidingView
                   behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                   style={styles.keyboardAvoidingView}
                 >
                   <ScrollView
                     style={styles.scrollView}
                     contentContainerStyle={styles.scrollContent}
                     showsVerticalScrollIndicator={false}
                     keyboardShouldPersistTaps="handled"
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
                <View style={styles.searchInputContainer}>
                  <MaterialIcons name="search" size={25} color="rgba(0, 0, 0, 0.5)" />
                  <TextInput
                    ref={locationInputRef}
                    style={styles.searchInput}
                    placeholder="Search by location"
                    placeholderTextColor="rgba(0, 0, 0, 0.5)"
                    value={locationSearchQuery}
                    onChangeText={(text) => {
                      setLocationSearchQuery(text);
                      setIsSearchingLocation(text.trim().length > 0);
                    }}
                    onFocus={() => {
                      // Only set searching to true if we don't have a location selected
                      // This prevents re-triggering search after selection
                      if (!location) {
                        setIsSearchingLocation(true);
                      }
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {locationSearchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setLocationSearchQuery('');
                        setIsSearchingLocation(false);
                        setLocationResults([]);
                        setLocation(null);
                      }}
                      style={styles.clearSearchButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons name="close" size={20} color="rgba(0, 0, 0, 0.5)" />
                    </TouchableOpacity>
                  )}
                  {locationSearchLoading && locationSearchQuery.length === 0 && (
                    <ActivityIndicator size="small" color="rgba(0, 0, 0, 0.5)" style={styles.searchLoadingIndicator} />
                  )}
                </View>
                
                {/* Location Search Results */}
                {isSearchingLocation && locationSearchQuery.trim().length >= 2 && (
                  <View style={styles.locationResultsContainer}>
                    {locationSearchLoading && locationResults.length === 0 && (
                      <View style={styles.locationLoadingContainer}>
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                    )}
                    {!locationSearchLoading && locationResults.length === 0 && locationSearchQuery.trim().length >= 2 && (
                      <View style={styles.locationEmptyContainer}>
                        <Text style={styles.locationEmptyText}>No locations found</Text>
                      </View>
                    )}
                    {locationResults.map((result) => (
                      <TouchableOpacity
                        key={result.place_id}
                        style={styles.locationResultItem}
                        onPress={() => handleLocationSelect(result)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="location-on" size={40} color={colors.text.primary} />
                        <View style={styles.locationResultText}>
                          <Text style={styles.locationResultTitle}>{result.city}</Text>
                          <Text style={styles.locationResultSubtitle}>
                            {`${result.region ? `${result.region}, ` : ''}${result.country}`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Recent Searches - Only show when not searching */}
                {!isSearchingLocation && recentSearches.length > 0 && (
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
                          <Text style={styles.recentItemSubtitle}>{search.dateRange || 'Add Dates'}</Text>
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
                  onMonthChange={(month) => {
                    // Update currentMonth state when user navigates months
                    const monthString = `${month.year}-${String(month.month).padStart(2, '0')}-01`;
                    setCurrentMonth(monthString);
                  }}
                  markedDates={selectedDates}
                  minDate={new Date().toISOString().split('T')[0]}
                  current={currentMonth}
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
                 </KeyboardAvoidingView>
        {/* ) : (
          <FlightSearchTab
            onClose={onClose}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        )} */}

        {/* Bottom Action Buttons - Only show for Matches tab */}
        {/* {activeTab === 'matches' && ( */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearAll}
              accessibilityLabel="Clear all search filters"
              accessibilityRole="button"
            >
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.enterButton, (!location || !dateFrom || !dateTo) && styles.enterButtonDisabled]}
              onPress={handleSearch}
              disabled={loading || !location || !dateFrom || !dateTo}
              accessibilityLabel="Search for matches"
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator size="small" color="rgba(0, 0, 0, 0.5)" />
              ) : (
                <Text style={styles.enterButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>
        {/* )} */}
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  closeButton: {
    padding: spacing.xs,
    width: 25,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.cardGrey,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 48,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  activeTab: {
    backgroundColor: colors.card,
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '500',
    fontSize: 16,
  },
  activeTabText: {
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  keyboardAvoidingView: {
    flex: 1,
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
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    padding: 0,
    margin: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  clearSearchButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  searchLoadingIndicator: {
    marginLeft: spacing.xs,
  },
  locationResultsContainer: {
    marginTop: spacing.sm,
    maxHeight: 200,
  },
  locationLoadingContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  locationEmptyContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  locationEmptyText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  locationResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.card,
    gap: spacing.xl + spacing.sm,
    marginBottom: spacing.xs,
  },
  locationResultText: {
    flex: 1,
    gap: 7,
  },
  locationResultTitle: {
    ...typography.caption,
    color: colors.text.primary,
  },
  locationResultSubtitle: {
    ...typography.caption,
    color: 'rgba(0, 0, 0, 0.5)',
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

