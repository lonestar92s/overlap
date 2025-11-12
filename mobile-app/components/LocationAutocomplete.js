import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  FlatList,
  Keyboard,
} from 'react-native';
import Autocomplete from 'react-native-autocomplete-input';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { debounce } from 'lodash';
import * as Location from 'expo-location';
import ApiService from '../services/api';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

// Mock data for testing when API key is not available
const MOCK_LOCATIONS = [
  { place_id: '1', city: 'London', country: 'United Kingdom', region: 'England', lat: 51.5074, lon: -0.1278 },
  { place_id: '2', city: 'Barcelona', country: 'Spain', region: 'Catalonia', lat: 41.3851, lon: 2.1734 },
  { place_id: '3', city: 'Munich', country: 'Germany', region: 'Bavaria', lat: 48.1351, lon: 11.5820 },
  { place_id: '4', city: 'Manchester', country: 'United Kingdom', region: 'England', lat: 53.4808, lon: -2.2426 },
  { place_id: '5', city: 'Liverpool', country: 'United Kingdom', region: 'England', lat: 53.4084, lon: -2.9916 },
];

const LocationAutocomplete = ({ 
  value, 
  onSelect, 
  placeholder = "Search destinations...",
  style = {},
  onFocusCallback = null,
  onOptionsChange = null,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(150); // Reduced height to prevent overlap
  const inputRef = React.useRef(null);

  // Get user's current location
  const getUserLocation = async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (__DEV__) {
          console.log('Location permission denied');
        }
        return null;
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 15000,
        maximumAge: 10000
      });

      const { latitude, longitude } = location.coords;
      const userLoc = { lat: latitude, lon: longitude };
      setUserLocation(userLoc);
      return userLoc;
    } catch (error) {
      if (__DEV__) {
        console.log('Error getting location:', error);
      }
      return null;
    }
  };

  useEffect(() => {
    if (value) {
      const displayText = `${value.city}${value.region ? `, ${value.region}` : ''}, ${value.country}`;
      setInputValue(displayText);
    } else {
      setInputValue('');
    }
  }, [value]);

  // Get user location when component mounts
  useEffect(() => {
    getUserLocation();
  }, []);

  // Listen to keyboard events to adjust dropdown height
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener('keyboardWillShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      calculateDropdownHeight(e.endCoordinates.height);
    });
    
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      calculateDropdownHeight(e.endCoordinates.height);
    });
    
    const keyboardWillHide = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
      setDropdownMaxHeight(150);
    });
    
    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
      setDropdownMaxHeight(150);
    });

    return () => {
      keyboardWillShow.remove();
      keyboardDidShow.remove();
      keyboardWillHide.remove();
      keyboardDidHide.remove();
    };
  }, []);

  const calculateDropdownHeight = (kbHeight) => {
    // Reduced height to prevent overlap with elements below
    // For 2-3 items, we need about 150px (2-3 * 50px per item)
    setDropdownMaxHeight(150);
  };

  const formatLocationDisplay = (option) => {
    if (!option) return '';
    return `${option.city}${option.region ? `, ${option.region}` : ''}, ${option.country}`;
  };

  // Use ref for lastRequestTime to avoid recreating debounced function
  const lastRequestTimeRef = useRef(0);
  
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setOptions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Rate limiting - wait at least 500ms between requests
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTimeRef.current;
      if (timeSinceLastRequest < 500) {
        await new Promise(resolve => setTimeout(resolve, 500 - timeSinceLastRequest));
      }
      lastRequestTimeRef.current = Date.now();

      // Use backend endpoint which proxies LocationIQ
      const response = await ApiService.searchLocations(query, 5);
      
      if (response.success && response.suggestions) {
        setOptions(response.suggestions);
        if (onOptionsChange) onOptionsChange(response.suggestions.length > 0);
      } else {
        // Fallback to mock data if backend fails
        await new Promise(resolve => setTimeout(resolve, 300));
        const filteredMockData = MOCK_LOCATIONS.filter(location =>
          location.city.toLowerCase().includes(query.toLowerCase()) ||
          location.country.toLowerCase().includes(query.toLowerCase())
        );
        setOptions(filteredMockData);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error fetching location suggestions:', error);
      }
      
      // On error, fallback to mock data
      if (error.message?.includes('Rate limit') || error.response?.status === 429) {
        setError('Please type more slowly...');
        const filteredMockData = MOCK_LOCATIONS.filter(location =>
          location.city.toLowerCase().includes(query.toLowerCase()) ||
          location.country.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 3); // Limit to 3 results
        setOptions(filteredMockData);
        if (onOptionsChange) onOptionsChange(filteredMockData.length > 0);
      } else {
        setError('Error fetching locations');
        setOptions([]);
        if (onOptionsChange) onOptionsChange(false);
      }
    } finally {
      setLoading(false);
    }
  }, [onOptionsChange]);

  // Use useRef to persist debounced function and ensure proper cleanup
  const debouncedFetchSuggestionsRef = useRef(null);
  
  // Create debounced function once and recreate when fetchSuggestions changes
  useEffect(() => {
    // Cancel previous debounced function if it exists
    if (debouncedFetchSuggestionsRef.current) {
      debouncedFetchSuggestionsRef.current.cancel();
    }
    
    // Create new debounced function with current fetchSuggestions
    debouncedFetchSuggestionsRef.current = debounce(fetchSuggestions, 500);
    
    // Cleanup on unmount or when fetchSuggestions changes
    return () => {
      if (debouncedFetchSuggestionsRef.current) {
        debouncedFetchSuggestionsRef.current.cancel();
      }
    };
  }, [fetchSuggestions]);

  const handleInputChange = (text) => {
    setInputValue(text);
    if (text.length === 0) {
      // Show "Matches near you" when input is empty but focused
      if (userLocation) {
        const nearYouOption = {
          place_id: 'near-you',
          description: 'Matches near you',
          lat: userLocation.lat,
          lon: userLocation.lon,
          city: 'Current Location',
          region: 'Near You',
          country: 'GPS',
          isNearYou: true
        };
        setOptions([nearYouOption]);
        if (onOptionsChange) onOptionsChange(true); // Notify parent that options are showing
      } else {
        setOptions([]);
        if (onOptionsChange) onOptionsChange(false); // Notify parent that no options
      }
      onSelect(null);
    } else {
      if (onOptionsChange) onOptionsChange(true); // Notify parent that we're fetching options
      debouncedFetchSuggestionsRef.current(text);
    }
  };

  const handleInputFocus = () => {
    // Notify parent component that input was focused (so it can scroll if needed)
    if (onFocusCallback) {
      onFocusCallback();
    }
  };

  const handleSelectLocation = (location) => {
    const displayText = formatLocationDisplay(location);
    setInputValue(displayText);
    setOptions([]);
    if (onOptionsChange) onOptionsChange(false); // Notify parent that options are hidden
    onSelect(location);
  };

  const renderItem = ({ item, index }) => (
    <TouchableOpacity 
      style={[
        styles.locationItem,
        index === options.length - 1 && styles.lastLocationItem
      ]} 
      onPress={() => handleSelectLocation(item)} 
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Select location: ${item.city}, ${item.country}`}
    >
      <View style={styles.locationIcon}>
        <Icon name="location-on" size={20} color={colors.primary} />
      </View>
      <View style={styles.locationTextContainer}>
        <Text style={styles.locationMainText}>
          {item.city}
        </Text>
        <Text style={styles.locationSecondaryText}>
          {`${item.region ? `${item.region}, ` : ''}${item.country}`}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.autocompleteWrapper}>
        <Autocomplete
          data={options}
          value={inputValue}
          onChangeText={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          flatListProps={{ 
            keyExtractor: (item) => item.place_id, 
            renderItem: renderItem, 
            keyboardShouldPersistTaps: 'handled', 
            showsVerticalScrollIndicator: true,
            style: { maxHeight: dropdownMaxHeight }
          }}
          inputContainerStyle={styles.inputContainer}
          containerStyle={styles.autocompleteContainer}
          listContainerStyle={[styles.listContainer, { maxHeight: dropdownMaxHeight }]}
          listStyle={[styles.listStyle, { maxHeight: dropdownMaxHeight }]}
          hideResults={options.length === 0}
        />
        {inputValue.length > 0 && (
          <TouchableOpacity onPress={() => { setInputValue(''); setOptions([]); onSelect(null); }} style={styles.clearButton} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} pointerEvents="box-only">
            <Text style={styles.clearButtonText}>×</Text>
          </TouchableOpacity>
        )}
      </View>
      {loading && (<ActivityIndicator size="small" color={colors.primary} style={styles.loadingIndicator} />)}
      {error && (<Text style={styles.errorText}>{error}</Text>)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    position: 'relative', 
    zIndex: 100, // Reduced from 9999 to reasonable z-index
  },
  autocompleteWrapper: { 
    position: 'relative', 
    flex: 1,
  },
  autocompleteContainer: { 
    flex: 1, 
    zIndex: 100,
  },
  inputContainer: { 
    ...typography.body,
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: borderRadius.sm, 
    paddingHorizontal: spacing.md, 
    paddingVertical: spacing.md, 
    backgroundColor: colors.card, 
    minHeight: 48,
    color: colors.text.primary,
  },
  clearButton: { 
    position: 'absolute', 
    right: spacing.sm, 
    top: spacing.sm, 
    width: 32, 
    height: 32, 
    borderRadius: borderRadius.pill, 
    backgroundColor: colors.cardGrey, 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 101,
    elevation: 2,
  },
  clearButtonText: { 
    ...typography.body,
    color: colors.text.secondary, 
    fontWeight: '600',
  },
  loadingIndicator: { 
    marginLeft: spacing.sm,
    marginTop: spacing.xs,
  },
  listContainer: { 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderTopWidth: 0, 
    borderBottomLeftRadius: borderRadius.sm, 
    borderBottomRightRadius: borderRadius.sm, 
    backgroundColor: colors.card, 
    ...shadows.medium,
    zIndex: 100,
    elevation: 4,
  },
  listStyle: {},
  locationItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: spacing.md, 
    paddingVertical: spacing.sm + spacing.xs, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.borderLight, 
    backgroundColor: colors.card,
  },
  lastLocationItem: { 
    borderBottomWidth: 0,
  },
  locationIcon: { 
    marginRight: spacing.sm, 
    justifyContent: 'center', 
    alignItems: 'center',
    width: 24,
    height: 24,
  },
  locationTextContainer: { 
    flex: 1,
  },
  locationMainText: { 
    ...typography.body,
    fontWeight: '600', 
    color: colors.text.primary, 
    marginBottom: spacing.xs / 2,
  },
  locationSecondaryText: { 
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  errorText: { 
    ...typography.caption,
    color: colors.error, 
    marginTop: spacing.xs, 
    marginLeft: spacing.sm,
  },
  infoText: { 
    ...typography.caption,
    color: colors.text.secondary, 
    marginTop: spacing.xs, 
    marginLeft: spacing.sm, 
    fontStyle: 'italic',
  },
});

export default LocationAutocomplete; 