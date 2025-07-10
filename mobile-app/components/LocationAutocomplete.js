import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
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
  const [showDropdown, setShowDropdown] = useState(false);
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
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Check if we have a valid API key
      if (LOCATIONIQ_API_KEY === 'pk.test.key' || !LOCATIONIQ_API_KEY) {
        // Use mock data for testing
        console.log('Using mock location data for testing');
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
        
        const filteredMockData = MOCK_LOCATIONS.filter(location =>
          location.city.toLowerCase().includes(query.toLowerCase()) ||
          location.country.toLowerCase().includes(query.toLowerCase())
        );
        
        setOptions(filteredMockData);
        setShowDropdown(true);
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
      setShowDropdown(true);
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
        setShowDropdown(true);
      } else {
        setError('Error fetching locations');
        setOptions([]);
        setShowDropdown(false);
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
      setShowDropdown(false);
      onSelect(null);
    } else {
      debouncedFetchSuggestions(text);
    }
  };

  const handleSelectLocation = (location) => {
    const displayText = formatLocationDisplay(location);
    setInputValue(displayText);
    setShowDropdown(false);
    setOptions([]);
    onSelect(location);
  };

  const renderLocationItem = ({ item }) => (
    <TouchableOpacity
      style={styles.locationItem}
      onPress={() => handleSelectLocation(item)}
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
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputValue}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          placeholderTextColor="#999"
          autoCapitalize="words"
          autoCorrect={false}
        />
        {loading && (
          <ActivityIndicator 
            size="small" 
            color="#007AFF" 
            style={styles.loadingIndicator}
          />
        )}
      </View>
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      
      {(LOCATIONIQ_API_KEY === 'pk.test.key' || !LOCATIONIQ_API_KEY) && (
        <Text style={styles.infoText}>
          Using mock data. Get a free API key from locationiq.com for real location search.
        </Text>
      )}
      
      {showDropdown && options.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={options}
            renderItem={renderLocationItem}
            keyExtractor={(item) => item.place_id}
            style={styles.dropdownList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  loadingIndicator: {
    marginLeft: 8,
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
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownList: {
    maxHeight: 200,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    fontWeight: '500',
    color: '#333',
  },
  locationSecondaryText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
});

export default LocationAutocomplete; 