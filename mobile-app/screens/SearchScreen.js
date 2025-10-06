import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Dimensions,
  SafeAreaView,
  Image,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SearchBar } from 'react-native-elements';
import { Icon } from 'react-native-elements';
import { formatDateToLocalString, getTodayLocalString, createDateRange } from '../utils/dateUtils';

import LocationAutocomplete from '../components/LocationAutocomplete';
import FilterModal from '../components/FilterModal';
import FilterIcon from '../components/FilterIcon';
import PopularMatches from '../components/PopularMatches';
import PopularMatchModal from '../components/PopularMatchModal';
import TripCountdownWidget from '../components/TripCountdownWidget';
import ApiService from '../services/api';
import { useFilter } from '../contexts/FilterContext';

const SearchScreen = ({ navigation }) => {
  const [location, setLocation] = useState(null);
  const [selectedDates, setSelectedDates] = useState({});
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  // Who selections (cap total to 5)
  const MAX_WHO = 5;
  const [selectedLeagues, setSelectedLeagues] = useState([]); // array of {id, name}
  const [selectedTeams, setSelectedTeams] = useState([]); // array of {id, name}
  const [teamIdInput, setTeamIdInput] = useState('');
  const [teamNameInput, setTeamNameInput] = useState('');
  const [popularMatches, setPopularMatches] = useState([]);
  const [showPopularMatchModal, setShowPopularMatchModal] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [showLeaguePicker, setShowLeaguePicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [leagueSearchQuery, setLeagueSearchQuery] = useState('');
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [leagueSearchResults, setLeagueSearchResults] = useState([]);
  const [teamSearchResults, setTeamSearchResults] = useState([]);
  const [isSearchingLeagues, setIsSearchingLeagues] = useState(false);
  const [isSearchingTeams, setIsSearchingTeams] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);

  // Local leagues data for search
  const getAllLeagues = () => [
    { id: 39, name: 'Premier League', country: 'England' },
    { id: 140, name: 'La Liga', country: 'Spain' },
    { id: 135, name: 'Serie A', country: 'Italy' },
    { id: 78, name: 'Bundesliga', country: 'Germany' },
    { id: 61, name: 'Ligue 1', country: 'France' },
    { id: 88, name: 'Eredivisie', country: 'Netherlands' },
    { id: 94, name: 'Primeira Liga', country: 'Portugal' },
    { id: 119, name: 'Super Lig', country: 'Turkey' },
    { id: 179, name: 'UEFA Champions League', country: 'Europe' },
    { id: 180, name: 'UEFA Europa League', country: 'Europe' },
  ];

  // Combined data for the main FlatList
  const sections = [
    {
      id: 'popular-destinations',
      title: 'Popular Destinations',
      type: 'horizontal',
      data: [
        { 
          id: '1', 
          city: 'Madrid',
          country: 'Spain',
          image: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400&h=300&fit=crop'
        },
        { 
          id: '2', 
          city: 'Rome',
          country: 'Italy', 
          image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop'
        },
        { 
          id: '3', 
          city: 'Berlin',
          country: 'Germany',
          image: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=400&h=300&fit=crop'
        },
        { 
          id: '4', 
          city: 'Milan',
          country: 'Italy',
          image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop'
        },
        { 
          id: '5', 
          city: 'Dortmund',
          country: 'Germany',
          image: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=400&h=300&fit=crop'
        },
      ]
    }
  ];

  // Recent searches data - will be populated from actual search history
  const [recentSearches, setRecentSearches] = useState([]);

  // Suggested destinations
  const suggestedDestinations = [
    { id: '1', name: 'Manchester', icon: '🏟️' },
    { id: '2', name: 'Liverpool', icon: '⚽' },
    { id: '3', name: 'Dortmund', icon: '🟡' },
    { id: '4', name: 'Milan', icon: '🔴' },
    { id: '5', name: 'Madrid', icon: '⚪' },
  ];

  const formatDate = (date) => {
    if (!date) return null;
    // Use the dateUtils function to avoid timezone issues
    return date; // Just return the date string directly since it's already in the correct format
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Add dates';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateRange = () => {
    if (!dateFrom && !dateTo) return 'Add dates';
    if (dateFrom && !dateTo) return `${formatDisplayDate(dateFrom)} - Select end`;
    if (dateFrom && dateTo) return `${formatDisplayDate(dateFrom)} - ${formatDisplayDate(dateTo)}`;
    return 'Add dates';
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
          color: '#1976d2',
          textColor: 'white'
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
            color: '#1976d2',
            textColor: 'white'
          }
        });
      } else {
        setDateTo(dateString);
        
        const range = {};
        
        // Create date range using dateUtils without timezone conversion
        const dateRange = createDateRange(dateFrom, dateString);
        
        dateRange.forEach((dateStr, index) => {
          if (index === 0) {
            // First date (starting day)
            range[dateStr] = {
              selected: true,
              startingDay: true,
              color: '#1976d2',
              textColor: 'white'
            };
          } else if (index === dateRange.length - 1) {
            // Last date (ending day)
            range[dateStr] = {
              selected: true,
              endingDay: true,
              color: '#1976d2',
              textColor: 'white'
            };
          } else {
            // Middle dates
            range[dateStr] = {
              selected: true,
              color: '#e3f2fd',
              textColor: '#1976d2'
            };
          }
        });
        
        setSelectedDates(range);
        setTimeout(() => setShowCalendar(false), 500);
      }
    }
  };

  const clearAll = () => {
    setLocation(null);
    setDateFrom(null);
    setDateTo(null);
    setSelectedDates({});
    setSelectedLeagues([]);
    setSelectedTeams([]);
  };

  // Who helpers
  const totalWhoCount = () => selectedLeagues.length + selectedTeams.length;
  const guardCap = () => {
    if (totalWhoCount() >= MAX_WHO) {
      Alert.alert('Limit reached', `You can select up to ${MAX_WHO} items in Who.`);
      return true;
    }
    return false;
  };
  const addLeagueById = (league) => {
    if (!league || !league.id) return;
    if (selectedLeagues.find(l => String(l.id) === String(league.id))) return;
    if (guardCap()) return;
    setSelectedLeagues(prev => [...prev, { id: String(league.id), name: league.name || `League ${league.id}` }]);
    setShowLeaguePicker(false);
    setLeagueSearchQuery('');
    setLeagueSearchResults([]);
  };
  const removeLeague = (leagueId) => {
    setSelectedLeagues(prev => prev.filter(l => String(l.id) !== String(leagueId)));
  };
  const addTeamById = () => {
    if (guardCap()) return;
    const id = String(teamIdInput).trim();
    if (!id) { Alert.alert('Team ID required', 'Enter a numeric team ID.'); return; }
    if (selectedTeams.find(t => String(t.id) === id)) { setShowTeamModal(false); setTeamIdInput(''); setTeamNameInput(''); return; }
    setSelectedTeams(prev => [...prev, { id, name: teamNameInput?.trim() || `Team ${id}` }]);
    setShowTeamModal(false);
    setTeamIdInput('');
    setTeamNameInput('');
  };

  const addTeamFromModal = (team) => {
    if (!team || !team.id) return;
    if (selectedTeams.find(t => String(t.id) === String(team.id))) return;
    if (guardCap()) return;
    setSelectedTeams(prev => [...prev, { id: String(team.id), name: team.name || `Team ${team.id}` }]);
    setShowTeamPicker(false);
    setTeamSearchQuery('');
    setTeamSearchResults([]);
  };
  const removeTeam = (teamId) => {
    setSelectedTeams(prev => prev.filter(t => String(t.id) !== String(teamId)));
  };

  const clearAllSelections = () => {
    setSelectedLeagues([]);
    setSelectedTeams([]);
  };

  // Helper functions for search button
  const canSearch = () => {
    const hasLocation = !!location;
    const hasDates = !!(dateFrom && dateTo);
    const hasWho = (selectedLeagues.length + selectedTeams.length) > 0;

    // If no Who is selected, we need both location and dates
    if (!hasWho) {
      return hasLocation && hasDates;
    }

    // If Who is selected, we need at least one of: location, dates, or both
    return hasLocation || hasDates;
  };

  const getSearchButtonText = () => {
    const hasLocation = !!location;
    const hasDates = !!(dateFrom && dateTo);
    const hasWho = (selectedLeagues.length + selectedTeams.length) > 0;

    if (hasWho) {
      if (hasLocation && hasDates) {
        return 'Search';
      } else if (hasLocation) {
        return 'Search';
      } else if (hasDates) {
        return 'Search';
      } else {
        return 'Search';
      }
          } else {
        return 'Search';
      }
  };

  const handleSearch = async () => {
    // Check if we have any search criteria
    const hasLocation = !!location;
    const hasDates = !!(dateFrom && dateTo);
    const hasWho = (selectedLeagues.length + selectedTeams.length) > 0;

    // If no Who is selected, we need both location and dates
    if (!hasWho) {
      if (!hasLocation) {
        Alert.alert('Error', 'Please select a location');
        return;
      }
      if (!hasDates) {
        Alert.alert('Error', 'Please select your travel dates');
        return;
      }
    }

    // If Who is selected, we need at least one of: location, dates, or both
    if (hasWho && !hasLocation && !hasDates) {
      Alert.alert('Error', 'Please select at least a location or travel dates when searching by teams/leagues');
      return;
    }

    setLoading(true);
    try {
      const searchParams = {
        location,
        dateFrom: formatDate(dateFrom),
        dateTo: formatDate(dateTo)
      };
      
      console.log('SearchScreen: hasWho =', hasWho);
      console.log('SearchScreen: selectedLeagues =', selectedLeagues);
      console.log('SearchScreen: selectedTeams =', selectedTeams);
      console.log('SearchScreen: hasLocation =', hasLocation);
      console.log('SearchScreen: hasDates =', hasDates);
      
      let matches = [];
      let initialRegion = null;
      let autoFitKey = 0;

      if (hasWho) {
        // Global search by leagues/teams
        const apiParams = {
          competitions: selectedLeagues.map(l => String(l.id)),
          teams: selectedTeams.map(t => String(t.id)),
        };

        // Add optional date range if provided
        if (hasDates) {
          apiParams.dateFrom = searchParams.dateFrom;
          apiParams.dateTo = searchParams.dateTo;
        }

        // Add optional bounds if location is provided
        if (hasLocation) {
          apiParams.bounds = {
            northeast: { lat: location.lat + 0.25, lng: location.lon + 0.25 },
            southwest: { lat: location.lat - 0.25, lng: location.lon - 0.25 }
          };
          // Set initial region for map centering
          initialRegion = {
            latitude: location.lat,
            longitude: location.lon,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
          };
        }

        console.log('SearchScreen: Calling searchAggregatedMatches with params:', apiParams);
        
        const agg = await ApiService.searchAggregatedMatches(apiParams);
        console.log('SearchScreen: searchAggregatedMatches response:', agg);
        matches = agg?.data || [];
        console.log('SearchScreen: Final matches from aggregated search:', matches);
        autoFitKey = Date.now(); // trigger map to auto-fit
      } else {
        // Traditional bounds-based search (requires both location and dates)
        const bounds = {
          northeast: { lat: location.lat + 0.25, lng: location.lon + 0.25 },
          southwest: { lat: location.lat - 0.25, lng: location.lon - 0.25 }
        };
        const response = await ApiService.searchMatchesByBounds({
          bounds,
          dateFrom: searchParams.dateFrom,
          dateTo: searchParams.dateTo
        });
        matches = response.data || [];
        
        // Set initial region for bounds-based search
        initialRegion = {
          latitude: location.lat,
          longitude: location.lon,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        };
      }
      
      // Save to recent searches
      saveToRecentSearches(searchParams, matches, initialRegion);
      
      // Close modal and navigate
      setShowSearchModal(false);
      navigation.navigate('MapResults', { 
        searchParams,
        matches,
        initialRegion,
        autoFitKey,
        hasLocation,
        hasDates,
        hasWho
      });
    } catch (error) {
      console.error('SearchScreen: Search error:', error);
      Alert.alert('Error', error.message || 'Failed to search matches');
    } finally {
      setLoading(false);
    }
  };

  const renderDestinationCard = ({ item }) => (
    <TouchableOpacity style={styles.destinationCard}>
      <Image 
        source={{ uri: item.image }} 
        style={styles.cardImage}
        resizeMode="cover"
      />
      <View style={styles.cardContent}>
        <Text style={styles.cardCity}>{item.city}</Text>
        <Text style={styles.cardCountry}>{item.country}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderRecentSearch = ({ item }) => (
    <TouchableOpacity 
      style={styles.recentSearchItem}
      onPress={() => handleRecentSearchSelect(item)}
    >
      <View style={styles.recentSearchIcon}>
        <Icon name="location-on" size={20} color="#1976d2" />
      </View>
      <View style={styles.recentSearchContent}>
        <Text style={styles.recentSearchLocation}>{item.location}</Text>
        <Text style={styles.recentSearchDates}>{item.dates}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSuggestedDestination = ({ item }) => (
    <TouchableOpacity style={styles.suggestedDestinationItem}>
      <Text style={styles.suggestedDestinationIcon}>{item.icon}</Text>
      <Text style={styles.suggestedDestinationName}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderSection = ({ item }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{item.title}</Text>
      <FlatList
        data={item.data}
        renderItem={renderDestinationCard}
        keyExtractor={(cardItem, index) => (cardItem.id || `card-${index}`).toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        scrollEnabled={true}
      />
    </View>
  );

  const renderHeader = () => (
    <View>
      {/* Top Search Bar */}
      <View style={styles.searchBarContainer}>
        <SearchBar
          placeholder="Start your lap"
          platform="ios"
          containerStyle={styles.searchBarContainer}
          inputContainerStyle={styles.searchBarInputContainer}
          onPressIn={() => setShowSearchModal(true)}
          editable={false}
          showLoading={false}
          searchIcon={{ name: 'search', type: 'ionicon' }}
        />
      </View>

      {/* Trip Countdown Widget */}
      <TripCountdownWidget 
        onTripPress={(trip) => {
          // Navigate to trip details or trip overview
          navigation.navigate('TripOverview', { itineraryId: trip.id || trip._id });
        }}
      />

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterButtonText}>Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterButtonText}>Location</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterButtonText}>League</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handlePopularMatchPress = (match) => {
    // Find the index of the pressed match in the popular matches array
    const matchIndex = popularMatches.findIndex(m => m.id === match.id);
    if (matchIndex !== -1) {
      setCurrentMatchIndex(matchIndex);
      setShowPopularMatchModal(true);
    }
  };

  const handlePopularMatchNavigate = (newIndex) => {
    setCurrentMatchIndex(newIndex);
  };

  const handlePopularMatchModalClose = () => {
    setShowPopularMatchModal(false);
  };

  // Handle recent search selection
  const handleRecentSearchSelect = (recentSearch) => {
    // Parse the stored search data and navigate to map view
    if (recentSearch.searchParams) {
      navigation.navigate('MapResults', {
        searchParams: recentSearch.searchParams,
        matches: recentSearch.matches || [],
        initialRegion: recentSearch.initialRegion,
        autoFitKey: Date.now()
      });
      setShowSearchModal(false);
    }
  };

  // Save search to recent searches
  const saveToRecentSearches = async (searchParams, matches, initialRegion) => {
    const newSearch = {
      id: Date.now().toString(),
      location: searchParams.location?.city || 'Unknown Location',
      dates: formatDateRange(),
      searchParams,
      matches,
      initialRegion,
      timestamp: new Date().toISOString()
    };

    setRecentSearches(prev => {
      // Remove duplicates and keep only last 3 searches
      const filtered = prev.filter(s => 
        s.location !== newSearch.location || 
        s.dates !== newSearch.dates
      );
      return [newSearch, ...filtered].slice(0, 3);
    });

    // Save to AsyncStorage
    try {
      const updatedSearches = [newSearch, ...recentSearches.filter(s => 
        s.location !== newSearch.location || 
        s.dates !== newSearch.dates
      )].slice(0, 3);
      await AsyncStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
    } catch (error) {
      console.error('Failed to save recent searches:', error);
    }
  };

  // Load recent searches from AsyncStorage
  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem('recentSearches');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error);
    }
  };

  // Load recent searches on component mount
  useEffect(() => {
    loadRecentSearches();
  }, []);

  // Handle matches near me with time period
  const handleMatchesNearMe = async (timePeriod) => {
    try {
      // Get user's current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to find matches near you.');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const userLocation = {
        lat: currentLocation.coords.latitude,
        lon: currentLocation.coords.longitude
      };

      // Calculate date range based on time period
      const today = new Date();
      let dateFrom, dateTo;
      
      switch (timePeriod) {
        case 'today':
          dateFrom = getTodayLocalString();
          dateTo = getTodayLocalString();
          break;
        case 'thisWeek':
          dateFrom = getTodayLocalString();
          const thisWeekEnd = new Date(today);
          thisWeekEnd.setDate(today.getDate() + 7);
          dateTo = formatDateToLocalString(thisWeekEnd);
          break;
        case 'thisMonth':
          dateFrom = getTodayLocalString();
          const thisMonthEnd = new Date(today);
          thisMonthEnd.setDate(today.getDate() + 30);
          dateTo = formatDateToLocalString(thisMonthEnd);
          break;
        default:
          dateFrom = getTodayLocalString();
          dateTo = getTodayLocalString();
      }

      // Create search params for current location
      const searchParams = {
        location: {
          city: 'Current Location',
          region: 'Near You',
          country: 'GPS',
          lat: userLocation.lat,
          lon: userLocation.lon
        },
        dateFrom,
        dateTo
      };

      // Search for matches near current location
      const bounds = {
        northeast: { lat: userLocation.lat + 0.25, lng: userLocation.lon + 0.25 },
        southwest: { lat: userLocation.lat - 0.25, lng: userLocation.lon - 0.25 }
      };

      const response = await ApiService.searchMatchesByBounds({
        bounds,
        dateFrom,
        dateTo
      });

      const matches = response.data || [];
      
      // Set initial region for map centering
      const initialRegion = {
        latitude: userLocation.lat,
        longitude: userLocation.lon,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };

      // Save to recent searches
      saveToRecentSearches(searchParams, matches, initialRegion);
      
      // Close modal and navigate
      setShowSearchModal(false);
      navigation.navigate('MapResults', { 
        searchParams,
        matches,
        initialRegion,
        autoFitKey: Date.now(),
        hasLocation: true,
        hasDates: true,
        hasWho: false
      });
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Failed to get your current location. Please try again.');
    }
  };

  const searchLeagues = async (query) => {
    if (!query.trim()) {
      setLeagueSearchResults([]);
      return;
    }

    setIsSearchingLeagues(true);
    try {
      // Search through the local leagues data
      const results = getAllLeagues().filter(league => 
        league.name.toLowerCase().includes(query.toLowerCase()) ||
        league.country.toLowerCase().includes(query.toLowerCase())
      );
      console.log('League search results:', results);
      setLeagueSearchResults(results);
    } catch (error) {
      console.error('Error searching leagues:', error);
      setLeagueSearchResults([]);
    } finally {
      setIsSearchingLeagues(false);
    }
  };

  const searchTeams = async (query) => {
    if (!query.trim()) {
      setTeamSearchResults([]);
      return;
    }

    setIsSearchingTeams(true);
    try {
      // Call the real Football API through our backend
      const response = await ApiService.searchTeams(query, 10);
      
      if (response.success && response.results) {
        // Transform the API response to match our expected format
        const transformedResults = response.results.map(team => ({
          id: team.id,
          name: team.name,
          league: team.league || 'Unknown League',
          country: team.country || 'Unknown Country',
          logo: team.logo,
          city: team.city
        }));
        setTeamSearchResults(transformedResults);
      } else {
        setTeamSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching teams:', error);
      setTeamSearchResults([]);
    } finally {
      setIsSearchingTeams(false);
    }
  };

  // Debounced search functions
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchLeagues(leagueSearchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [leagueSearchQuery]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchTeams(teamSearchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [teamSearchQuery]);

  // Quick search functions
  const quickSearchToday = () => {
    const today = getTodayLocalString();
    setDateFrom(today);
    setDateTo(today);
    setSelectedDates({
      [today]: {
        selected: true,
        startingDay: true,
        endingDay: true,
        color: '#1976d2',
        textColor: 'white'
      }
    });
  };

  const quickSearchThisWeek = () => {
    const today = getTodayLocalString();
    
    // Create end date by adding 6 days to today
    const todayDate = new Date();
    todayDate.setDate(todayDate.getDate() + 6);
    const thisWeekEndStr = formatDateToLocalString(todayDate);
    
    setDateFrom(today);
    setDateTo(thisWeekEndStr);
    
    // Use dateUtils to create the range without timezone issues
    const dateRange = createDateRange(today, thisWeekEndStr);
    
    // Create range marking
    const range = {};
    dateRange.forEach((dateStr, index) => {
      if (index === 0) {
        // First date (starting day)
        range[dateStr] = {
          selected: true,
          startingDay: true,
          color: '#1976d2',
          textColor: 'white'
        };
      } else if (index === dateRange.length - 1) {
        // Last date (ending day)
        range[dateStr] = {
          selected: true,
          endingDay: true,
          color: '#1976d2',
          textColor: 'white'
        };
      } else {
        // Middle dates
        range[dateStr] = {
          selected: true,
          color: '#e3f2fd',
          textColor: '#1976d2'
        };
      }
    });
    
    setSelectedDates(range);
  };

  const quickSearchThisMonth = () => {
    const today = getTodayLocalString();
    
    // Create end date (last day of current month)
    const todayDate = new Date();
    todayDate.setMonth(todayDate.getMonth() + 1);
    todayDate.setDate(0); // Last day of current month
    const thisMonthEndStr = formatDateToLocalString(todayDate);
    
    setDateFrom(today);
    setDateTo(thisMonthEndStr);
    
    // Use dateUtils to create the range without timezone issues
    const dateRange = createDateRange(today, thisMonthEndStr);
    
    // Create range marking
    const range = {};
    dateRange.forEach((dateStr, index) => {
      if (index === 0) {
        // First date (starting day)
        range[dateStr] = {
          selected: true,
          startingDay: true,
          color: '#1976d2',
          textColor: 'white'
        };
      } else if (index === dateRange.length - 1) {
        // Last date (ending day)
        range[dateStr] = {
          selected: true,
          endingDay: true,
          color: '#1976d2',
          textColor: 'white'
        };
      } else {
        // Middle dates
        range[dateStr] = {
          selected: true,
          color: '#e3f2fd',
          textColor: '#1976d2'
        };
      }
    });
    
    setSelectedDates(range);
  };

  const quickSearchNextMonth = () => {
    const today = getTodayLocalString();
    
    // Create end date (last day of next month)
    const todayDate = new Date();
    todayDate.setMonth(todayDate.getMonth() + 2);
    todayDate.setDate(0); // Last day of next month
    const nextMonthEndStr = formatDateToLocalString(todayDate);
    
    setDateFrom(today);
    setDateTo(nextMonthEndStr);
    
    // Use dateUtils to create the range without timezone issues
    const dateRange = createDateRange(today, nextMonthEndStr);
    
    // Create range marking
    const range = {};
    dateRange.forEach((dateStr, index) => {
      if (index === 0) {
        // First date (starting day)
        range[dateStr] = {
          selected: true,
          startingDay: true,
          color: '#1976d2',
          textColor: 'white'
        };
      } else if (index === dateRange.length - 1) {
        // Last date (ending day)
        range[dateStr] = {
          selected: true,
          endingDay: true,
          color: '#1976d2',
          textColor: 'white'
        };
      } else {
        // Middle dates
        range[dateStr] = {
          selected: true,
          color: '#e3f2fd',
          textColor: '#1976d2'
        };
      }
    });
    
    setSelectedDates(range);
  };


  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={sections}
        renderItem={renderSection}
        keyExtractor={(item, index) => (item.id || `section-${index}`).toString()}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />

      {/* Popular Matches Section */}
      <PopularMatches 
        onMatchPress={handlePopularMatchPress}
        onMatchesLoaded={setPopularMatches}
      />

      {/* New Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSearchModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Top Navigation Bar */}
          <View style={styles.modalHeader}>
            <View style={styles.modalCategories}>
              <TouchableOpacity style={styles.modalCategoryActive}>
                <Text style={styles.modalCategoryTextActive}>Matches</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCategory}>
                <Text style={styles.modalCategoryText}>Teams</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCategory}>
                <Text style={styles.modalCategoryText}>Venues</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowSearchModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={[{ id: 'modal-content' }]}
            renderItem={() => (
              <View style={styles.modalSearchCard}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.modalSearchTitle}>Where?</Text>
                  {(selectedLeagues.length > 0 || selectedTeams.length > 0) && (
                    <Text style={styles.optionalText}>(Optional when teams/leagues selected)</Text>
                  )}
                </View>
                
        <LocationAutocomplete
          value={location}
          onSelect={setLocation}
                  placeholder="Search destinations"
                  style={styles.modalLocationInput}
        />

                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <>
                    <Text style={styles.modalSectionTitle}>Recent searches</Text>
                    <FlatList
                      data={recentSearches}
                      renderItem={renderRecentSearch}
                      keyExtractor={(item, index) => (item.id || `recent-${index}`).toString()}
                      scrollEnabled={false}
                    />
                  </>
                )}

                {/* Matches Near Me - Time Options */}
                <Text style={styles.modalSectionTitle}>Quick Search</Text>
                <View style={styles.quickAccessColumn}>
                  <TouchableOpacity 
                    style={styles.quickAccessButton}
                    onPress={() => handleMatchesNearMe('today')}
                  >
                    <View style={styles.quickAccessIcon}>
                      <Icon name="sports-soccer" size={16} color="#4CAF50" />
                    </View>
                    <Text style={styles.quickAccessText}>Matches Nearby Today</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.quickAccessButton}
                    onPress={() => handleMatchesNearMe('thisWeek')}
                  >
                    <View style={styles.quickAccessIcon}>
                      <Icon name="sports-soccer" size={16} color="#4CAF50" />
                    </View>
                    <Text style={styles.quickAccessText}>Matches Nearby This Week</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.quickAccessButton}
                    onPress={() => handleMatchesNearMe('thisMonth')}
                  >
                    <View style={styles.quickAccessIcon}>
                      <Icon name="sports-soccer" size={16} color="#4CAF50" />
                    </View>
                    <Text style={styles.quickAccessText}>Matches Nearby This Month</Text>
                  </TouchableOpacity>
                </View>

                {/* Suggested Destinations - Hidden for now */}
                {/* <Text style={styles.modalSectionTitle}>Suggested destinations</Text>
                <View style={styles.suggestedDestinationsGrid}>
                  {suggestedDestinations.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.suggestedDestinationItem}>
                      <Text style={styles.suggestedDestinationIcon}>{item.icon}</Text>
                      <Text style={styles.suggestedDestinationName}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View> */}

                {/* When Input */}
                <View style={styles.fieldHeaderRow}>
                  <Text style={styles.modalSearchTitle}>When?</Text>
                  {(selectedLeagues.length > 0 || selectedTeams.length > 0) && (
                    <Text style={styles.optionalText}>(Optional when teams/leagues selected)</Text>
                  )}
                </View>
        <TouchableOpacity
                  style={styles.modalSearchInput}
          onPress={() => setShowCalendar(!showCalendar)}
        >
                  <Text style={styles.modalSearchIcon}>📅</Text>
                  <Text style={styles.modalSearchPlaceholder}>{formatDateRange()}</Text>
        </TouchableOpacity>

                {/* Calendar */}
        {showCalendar && (
                  <View style={styles.modalCalendarContainer}>
            <Calendar
              onDayPress={onDayPress}
              markingType={'period'}
              markedDates={selectedDates}
              minDate={getTodayLocalString()}
              theme={{
                selectedDayBackgroundColor: '#1976d2',
                selectedDayTextColor: 'white',
                todayTextColor: '#1976d2',
                dayTextColor: '#333',
                textDisabledColor: '#ccc',
                arrowColor: '#1976d2',
                monthTextColor: '#333',
                textDayFontWeight: '500',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '600',
              }}
            />
          </View>
        )}

                {/* Who Input */}
                <Text style={styles.modalSearchTitle}>Who?</Text>
                {/* Selected chips */}
                <View style={styles.whoChipsRow}>
                  {selectedLeagues.map((l) => (
                    <View key={`league-${l.id}`} style={styles.chip}>
                      <Text style={styles.chipText}>{l.name}</Text>
                      <TouchableOpacity onPress={() => removeLeague(l.id)} style={styles.chipClose}>
                        <Text style={styles.chipCloseText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {selectedTeams.map((t) => (
                    <View key={`team-${t.id}`} style={styles.chip}>
                      <Text style={styles.chipText}>{t.name}</Text>
                      <TouchableOpacity onPress={() => removeTeam(t.id)} style={styles.chipClose}>
                        <Text style={styles.chipCloseText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View style={styles.whoActionsRow}>
                  <TouchableOpacity 
                    style={styles.addButton} 
                    onPress={() => {
                      setShowLeaguePicker(!showLeaguePicker);
                      setShowTeamPicker(false); // Close team picker if open
                    }}
                  >
                    <Text style={styles.addButtonText}>
                      {showLeaguePicker ? '− Hide Leagues' : '+ Add League'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.addButton} 
                    onPress={() => {
                      setShowTeamPicker(!showTeamPicker);
                      setShowLeaguePicker(false); // Close league picker if open
                    }}
                  >
                    <Text style={styles.addButtonText}>
                      {showTeamPicker ? '− Hide Teams' : '+ Add Team'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.whoCountText}>{totalWhoCount()}/{MAX_WHO}</Text>
                </View>

                {/* League Picker Section */}
                {showLeaguePicker && (
                  <View style={styles.pickerSection}>
                    <View style={styles.pickerHeader}>
                      <Text style={styles.pickerTitle}>Select Leagues</Text>
                      <Text style={styles.pickerSubtitle}>Search and select leagues to include in your search</Text>
                    </View>
                    
                    <View style={styles.searchInputContainer}>
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search leagues..."
                        value={leagueSearchQuery}
                        onChangeText={setLeagueSearchQuery}
                      />
                    </View>

                    <FlatList
                      data={leagueSearchResults}
                      keyExtractor={(item, index) => (item.id || `league-${index}`).toString()}
                      renderItem={({ item }) => (
                        <TouchableOpacity 
                          style={styles.pickerListItem}
                          onPress={() => addLeagueById(item)}
                        >
                          <View style={styles.pickerListItemContent}>
                            <Text style={styles.pickerListItemTitle}>{item.name}</Text>
                            <Text style={styles.pickerListItemSubtitle}>{item.country}</Text>
                          </View>
                          <Icon name="add" size={24} color="#1976d2" />
                        </TouchableOpacity>
                      )}
                      ListEmptyComponent={
                        <View style={styles.pickerEmptyState}>
                          {isSearchingLeagues ? (
                            <ActivityIndicator size="large" color="#1976d2" />
                          ) : (
                            <Text style={styles.pickerEmptyText}>
                              {leagueSearchQuery ? 'No leagues found' : 'Search for leagues to add'}
                            </Text>
                          )}
                        </View>
                      }
                      style={styles.pickerList}
                    />
                  </View>
                )}

                {/* Team Picker Section */}
                {showTeamPicker && (
                  <View style={styles.pickerSection}>
                    <View style={styles.pickerHeader}>
                      <Text style={styles.pickerTitle}>Select Teams</Text>
                      <Text style={styles.pickerSubtitle}>Search and select teams to include in your search</Text>
                    </View>
                    
                    <View style={styles.searchInputContainer}>
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search teams..."
                        value={teamSearchQuery}
                        onChangeText={setTeamSearchQuery}
                      />
                    </View>

                    <FlatList
                      data={teamSearchResults}
                      keyExtractor={(item, index) => (item.id || `team-${index}`).toString()}
                      renderItem={({ item }) => (
                        <TouchableOpacity 
                          style={styles.pickerListItem}
                          onPress={() => addTeamFromModal(item)}
                        >
                          <View style={styles.pickerListItemContent}>
                            <Text style={styles.pickerListItemTitle}>{item.name}</Text>
                            <Text style={styles.pickerListItemSubtitle}>{item.league}</Text>
                          </View>
                          <Icon name="add" size={24} color="#1976d2" />
                        </TouchableOpacity>
                      )}
                      ListEmptyComponent={
                        <View style={styles.pickerEmptyState}>
                          {isSearchingTeams ? (
                            <ActivityIndicator size="large" color="#1976d2" />
                          ) : (
                            <Text style={styles.pickerEmptyText}>
                              {teamSearchQuery ? 'No teams found' : 'Search for teams to add'}
                            </Text>
                          )}
                        </View>
                      }
                      style={styles.pickerList}
                    />
                  </View>
                )}
              </View>
            )}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={styles.modalContent}
          />

          {/* Bottom Action Bar */}
          <View style={styles.modalActionBar}>
            <TouchableOpacity onPress={clearAll}>
              <Text style={styles.modalClearAllText}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.modalSearchButton,
                (!canSearch()) && styles.modalSearchButtonDisabled
              ]}
              onPress={handleSearch}
              disabled={loading || !canSearch()}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSearchButtonText}>{getSearchButtonText()}</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>





      {/* Popular Match Modal */}
      <PopularMatchModal
        visible={showPopularMatchModal}
        matches={popularMatches}
        currentMatchIndex={currentMatchIndex}
        onClose={handlePopularMatchModalClose}
        onNavigate={handlePopularMatchNavigate}
      />


    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContainer: {
    paddingBottom: 20,
  },
  searchBarContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderBottomWidth: 0,
  },
  searchBarInputContainer: {
    backgroundColor: '#fff',
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
    justifyContent: 'center',
  },
  filterButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 20,
    marginBottom: 15,
  },
  horizontalList: {
    paddingHorizontal: 20,
  },
  destinationCard: {
    width: 150,
    marginRight: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  cardContent: {
    padding: 12,
  },
  cardCity: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  cardCountry: {
    fontSize: 14,
    color: '#666',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCategories: {
    flexDirection: 'row',
    gap: 20,
  },
  modalCategoryActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingBottom: 5,
  },
  modalCategory: {
    paddingBottom: 5,
  },
  modalCategoryTextActive: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  modalCategoryText: {
    fontSize: 16,
    color: '#666',
  },
  modalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
  },
  modalSearchCard: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalSearchTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
    marginTop: 20,
  },
  modalSearchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 20,
  },
  modalSearchIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  modalSearchPlaceholder: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  whoChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    color: '#1f2937',
    fontWeight: '600',
  },
  chipClose: {
    marginLeft: 8,
  },
  chipCloseText: {
    fontSize: 16,
    color: '#6b7280',
  },
  whoActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  whoCountText: {
    marginLeft: 'auto',
    color: '#6b7280',
    fontWeight: '600',
  },
  leagueModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  leagueModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  leagueModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  leagueListContent: {
    padding: 20,
  },
  leagueRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  leagueName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  leagueCountry: {
    fontSize: 12,
    color: '#6b7280',
  },
  browseAllBtn: {
    paddingVertical: 12,
  },
  browseAllText: {
    color: '#1976d2',
    fontWeight: '600',
  },
  teamOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  teamInputCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: '#f8f8f8',
  },
  teamButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalLocationInput: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 25,
    marginBottom: 15,
  },
  recentSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recentSearchIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recentSearchContent: {
    flex: 1,
  },
  recentSearchLocation: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  recentSearchDates: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  suggestedDestinationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  suggestedDestinationItem: {
    alignItems: 'center',
    width: '30%',
  },
  suggestedDestinationIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  suggestedDestinationName: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  modalCalendarContainer: {
    marginTop: 15,
    marginBottom: 20,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 15,
  },
  modalActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalClearAllText: {
    fontSize: 16,
    color: '#1976d2',
    fontWeight: '500',
  },
  modalSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff385c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  modalSearchButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalSearchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  modalSearchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalSearchInput: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalListItemContent: {
    flex: 1,
  },
  modalListItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalListItemSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  modalEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalEmptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  pickerSection: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pickerHeader: {
    marginBottom: 20,
  },
  pickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
  },
  pickerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  searchInputContainer: {
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerListItemContent: {
    flex: 1,
  },
  pickerListItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  pickerListItemSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  pickerEmptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  pickerEmptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  optionalText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  // Quick access styles
  quickAccessColumn: {
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  quickAccessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  quickAccessIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8f5e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickAccessText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
});

export default SearchScreen; 