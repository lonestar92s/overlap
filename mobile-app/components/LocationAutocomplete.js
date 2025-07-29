import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  FlatList
} from 'react-native';
import Autocomplete from 'react-native-autocomplete-input';
import axios from 'axios';
import { debounce } from 'lodash';

// LocationIQ API configuration
const LOCATIONIQ_API_KEY = 'pk.6e3ab00541755300772780a4b02cdfe6';
const LOCATIONIQ_BASE_URL = 'https://api.locationiq.com/v1/autocomplete';

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
  style = {}
}) => {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRequestTime, setLastRequestTime] = useState(0);

  // Set initial input value if value is provided
  useEffect(() => {
    if (value) {
      const displayText = `${value.city}${value.region ? `, ${value.region}` : ''}, ${value.country}`;
      setInputValue(displayText);
    } else {
      setInputValue('');
    }
  }, [value]);

  // Helper function to format location for display
  const formatLocationDisplay = (option) => {
    if (!option) return '';
    return `${option.city}${option.region ? `, ${option.region}` : ''}, ${option.country}`;
  };

  const fetchSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setOptions([]);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Check if we have a valid API key
      if (LOCATIONIQ_API_KEY === 'pk.test.key' || !LOCATIONIQ_API_KEY) {
        // Use mock data for testing
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
        
        const filteredMockData = MOCK_LOCATIONS.filter(location =>
          location.city.toLowerCase().includes(query.toLowerCase()) ||
          location.country.toLowerCase().includes(query.toLowerCase())
        );
        
        setOptions(filteredMockData);
        return;
      }

      // Rate limiting: ensure at least 1 second between requests
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      if (timeSinceLastRequest < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
      }

      setLastRequestTime(Date.now());
      const response = await axios.get(LOCATIONIQ_BASE_URL, {
        params: {
          key: LOCATIONIQ_API_KEY,
          q: query,
          limit: 5,
          dedupe: 1,
          'accept-language': 'en'
        }
      });
      
      const suggestions = response.data.map(item => {
        const nameParts = item.display_name.split(', ');
        const city = nameParts[0];
        const country = nameParts[nameParts.length - 1];
        const region = nameParts.slice(1, -1).join(', ');
        
        // Create a unique identifier
        const uniqueId = `${item.place_id}-${item.lat}-${item.lon}-${city}-${region}-${country}`;
        
        return {
          place_id: uniqueId,
          description: `${city}${region ? `, ${region}` : ''}, ${country}`,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          city,
          region,
          country
        };
      });
      
      // Filter out duplicates based on exact coordinates and location details
      const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
        index === self.findIndex((s) => (
          s.lat === suggestion.lat && 
          s.lon === suggestion.lon &&
          s.city === suggestion.city &&
          s.region === suggestion.region &&
          s.country === suggestion.country
        ))
      );
      
      setOptions(uniqueSuggestions);
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
      if (error.response?.status === 429) {
        setError('Please type more slowly...');
      } else if (error.response?.status === 401) {
        setError('Invalid API key - using mock data');
        // Fallback to mock data
        const filteredMockData = MOCK_LOCATIONS.filter(location =>
          location.city.toLowerCase().includes(query.toLowerCase()) ||
          location.country.toLowerCase().includes(query.toLowerCase())
        );
        setOptions(filteredMockData);
      } else {
        setError('Error fetching locations');
        setOptions([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const debouncedFetchSuggestions = useMemo(
    () => debounce(fetchSuggestions, 500),
    []
  );

  useEffect(() => {
    return () => {
      debouncedFetchSuggestions.cancel();
    };
  }, [debouncedFetchSuggestions]);

  const handleInputChange = (text) => {
    setInputValue(text);
    if (text.length === 0) {
      setOptions([]);
      onSelect(null);
    } else {
      debouncedFetchSuggestions(text);
    }
  };

  const handleSelectLocation = (location) => {
    const displayText = formatLocationDisplay(location);
    setInputValue(displayText);
    setOptions([]); // Clear options to close dropdown
    onSelect(location);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.locationItem}
      onPress={() => handleSelectLocation(item)}
      activeOpacity={0.7}
    >
      <View style={styles.locationIcon}>
        <Text style={styles.locationIconText}>📍</Text>
      </View>
      <View style={styles.locationTextContainer}>
        <Text style={styles.locationMainText}>{item.city}</Text>
        <Text style={styles.locationSecondaryText}>
          {item.region ? `${item.region}, ` : ''}{item.country}
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
          placeholder={placeholder}
          flatListProps={{
            keyExtractor: (item) => item.place_id,
            renderItem: renderItem,
            keyboardShouldPersistTaps: "handled",
            showsVerticalScrollIndicator: false,
          }}
          inputContainerStyle={styles.inputContainer}
          containerStyle={styles.autocompleteContainer}
          listContainerStyle={styles.listContainer}
          listStyle={styles.listStyle}
          hideResults={options.length === 0}
        />
        {inputValue.length > 0 && (
          <TouchableOpacity 
            onPress={() => {
              setInputValue('');
              setOptions([]);
              onSelect(null);
            }}
            style={styles.clearButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            pointerEvents="box-only"
          >
            <Text style={styles.clearButtonText}>×</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {loading && (
        <ActivityIndicator 
          size="small" 
          color="#007AFF" 
          style={styles.loadingIndicator}
        />
      )}
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      
      {(LOCATIONIQ_API_KEY === 'pk.test.key' || !LOCATIONIQ_API_KEY) && (
        <Text style={styles.infoText}>
          Using mock data. Get a free API key from locationiq.com for real location search.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 9999,
  },
  autocompleteWrapper: {
    position: 'relative',
    flex: 1,
  },
  autocompleteContainer: {
    flex: 1,
    zIndex: 9999,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    minHeight: 48,
  },

  clearButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10001,
    elevation: 5,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
    lineHeight: 16,
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  listContainer: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 15,
    zIndex: 10000,
  },
  listStyle: {
    maxHeight: 200,
  },
  dropdownList: {
    maxHeight: 200,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  locationIcon: {
    marginRight: 12,
  },
  locationIconText: {
    fontSize: 16,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationMainText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  locationSecondaryText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 12,
  },
  infoText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 12,
    fontStyle: 'italic',
  },
});

export default LocationAutocomplete; 