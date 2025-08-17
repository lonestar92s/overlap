import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDateToLocalString, getTodayLocalString } from '../utils/dateUtils';

import BottomSheet from '../components/BottomSheet';
import MatchMapView from '../components/MapView';
import LocationAutocomplete from '../components/LocationAutocomplete';
import ApiService from '../services/api';

const MapSearchScreen = ({ navigation }) => {
  // Search state
  const [location, setLocation] = useState(null);
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [selectedDates, setSelectedDates] = useState({});
  const [loading, setLoading] = useState(false);
  
  // Map and matches state
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);
  
  // Bottom sheet state
  const [sheetState, setSheetState] = useState('collapsed');
  const [showLocationSearch, setShowLocationSearch] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Refs
  const mapRef = useRef();
  const searchTimeoutRef = useRef();


  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (bounds, dates) => {
      if (!dates.from || !dates.to) return;
      
      setLoading(true);
      try {
        const response = await ApiService.searchMatchesByBounds({
          bounds,
          dateFrom: dates.from,
          dateTo: dates.to,
        });

        if (response.success) {
          setMatches(response.data);
  
        } else {
          Alert.alert('Search Error', response.error || 'Failed to search matches');
        }
      } catch (error) {
        console.error('Search error:', error);
        Alert.alert('Error', 'Failed to search matches');
      } finally {
        setLoading(false);
      }
    }, 800),
    []
  );

  // Handle map region change (when user pans/zooms)
  const handleMapRegionChange = (region, bounds) => {
    setMapRegion(region);
    
    // Only search if we have dates
    if (dateFrom && dateTo) {
      debouncedSearch(bounds, { from: dateFrom, to: dateTo });
    }
  };

  // Handle location selection
  const handleLocationSelect = (selectedLocation) => {
    setLocation(selectedLocation);
    setShowLocationSearch(false);
    
    if (selectedLocation && mapRef.current) {
      // Center map on selected location
      const newRegion = {
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lon,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
      
      mapRef.current.animateToRegion(newRegion, 1000);
    }
  };

  // Handle marker press
  const handleMarkerPress = (match) => {
    setSelectedMatch(match);
    // Auto-expand bottom sheet to show match details
    if (sheetState === 'collapsed') {
      setSheetState('half');
    }
  };

  // Handle match item press in list
  const handleMatchPress = (match) => {
    setSelectedMatch(match);
    
    // Center map on venue
    const venue = match.fixture?.venue;
    if (venue?.coordinates && venue.coordinates.length === 2 && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: venue.coordinates[0],
        longitude: venue.coordinates[1],
        latitudeDelta: mapRegion?.latitudeDelta || 0.1,
        longitudeDelta: mapRegion?.longitudeDelta || 0.1,
      }, 1000);
    }
  };

  // Format date for display
  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Select date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Handle date selection in calendar
  const onDayPress = (day) => {
    const dateString = day.dateString;
    
    if (!dateFrom || (dateFrom && dateTo)) {
      // Starting fresh or restarting selection
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
      // Selecting end date
      if (dateString < dateFrom) {
        // If selected date is before start date, make it the new start date
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
        // Valid end date selection
        setDateTo(dateString);
        
        // Create range marking
        const range = {};
        const start = new Date(dateFrom);
        const end = new Date(dateString);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          // Fix: Use local date formatting instead of toISOString() to avoid timezone shift
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const currentDate = `${year}-${month}-${day}`;
          
          if (currentDate === dateFrom) {
            range[currentDate] = {
              selected: true,
              startingDay: true,
              color: '#1976d2',
              textColor: 'white'
            };
          } else if (currentDate === dateString) {
            range[currentDate] = {
              selected: true,
              endingDay: true,
              color: '#1976d2',
              textColor: 'white'
            };
          } else {
            range[currentDate] = {
              selected: true,
              color: '#e3f2fd',
              textColor: '#1976d2'
            };
          }
        }
        
        setSelectedDates(range);
        // Auto-close calendar after selecting date range
        setTimeout(() => setShowDatePicker(false), 500);
      }
    }
  };

  // Clear selected dates
  const clearDates = () => {
    setDateFrom(null);
    setDateTo(null);
    setSelectedDates({});
  };

  // Render search controls
  const renderSearchControls = () => (
    <View style={styles.searchControls}>
      {showLocationSearch ? (
        <View style={styles.locationSearchContainer}>
          <Text style={styles.searchLabel}>Where are you traveling?</Text>
          <LocationAutocomplete
            value={location}
            onSelect={handleLocationSelect}
            placeholder="Enter your destination..."
            style={styles.locationInput}
          />
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.locationSummary}
          onPress={() => setShowLocationSearch(true)}
        >
          <Text style={styles.locationSummaryText}>
            📍 {location?.city}, {location?.country}
          </Text>
          <Text style={styles.changeLocationText}>Tap to change</Text>
        </TouchableOpacity>
      )}

      <View style={styles.dateControls}>
        <Text style={styles.searchLabel}>Travel dates</Text>
        <TouchableOpacity
          style={styles.dateRangeButton}
          onPress={() => setShowDatePicker(!showDatePicker)}
        >
          <View style={styles.dateRangeContent}>
            <View style={styles.dateSection}>
              <Text style={styles.dateLabel}>From</Text>
              <Text style={styles.dateValue}>{formatDisplayDate(dateFrom)}</Text>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateSection}>
              <Text style={styles.dateLabel}>To</Text>
              <Text style={styles.dateValue}>{formatDisplayDate(dateTo)}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {dateFrom && dateTo && (
          <TouchableOpacity style={styles.clearDatesButton} onPress={clearDates}>
            <Text style={styles.clearDatesText}>Clear dates</Text>
          </TouchableOpacity>
        )}

        {showDatePicker && (
          <View style={styles.calendarContainer}>
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
      </View>
    </View>
  );

  // Render match item
  const renderMatchItem = ({ item }) => {
    const isSelected = selectedMatch?.fixture.id === item.fixture.id;
    const venue = item.fixture?.venue;
    
    return (
      <TouchableOpacity
        style={[styles.matchCard, isSelected && styles.selectedMatchCard]}
        onPress={() => handleMatchPress(item)}
      >
        <View style={styles.matchHeader}>
          <Text style={styles.matchDate}>
            {new Date(item.fixture.date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}
          </Text>
          <Text style={styles.matchTime}>
            {new Date(item.fixture.date).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        <View style={styles.teamsRow}>
          <View style={styles.teamContainer}>
            <Avatar
              source={{ uri: item.teams.home.logo }}
              size={30}
              rounded
            />
            <Text style={styles.teamName}>{item.teams.home.name}</Text>
          </View>
          
          <Text style={styles.vsText}>vs</Text>
          
          <View style={styles.teamContainer}>
            <Avatar
              source={{ uri: item.teams.away.logo }}
              size={30}
              rounded
            />
            <Text style={styles.teamName}>{item.teams.away.name}</Text>
          </View>
        </View>

        <View style={styles.venueRow}>
          <Text style={styles.venueName}>{venue?.name}</Text>
          <Text style={styles.venueLocation}>
            {venue?.city}, {venue?.country}
          </Text>
        </View>

        <View style={styles.leagueRow}>
          <Avatar
            source={{ uri: item.league?.logo || item.competition?.logo }}
            size={16}
            rounded
          />
          <Text style={styles.leagueName}>
            {item.league?.name || item.competition?.name}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Render bottom sheet content
  const renderBottomSheetContent = () => {
    if (sheetState === 'collapsed') {
      return (
        <View style={styles.collapsedContent}>
          <Text style={styles.matchCount}>
            {matches.length} matches found
          </Text>
          {matches.slice(0, 2).map(match => (
            <TouchableOpacity
              key={match.fixture.id}
              style={styles.quickMatchItem}
              onPress={() => handleMatchPress(match)}
            >
              <Text style={styles.quickMatchText}>
                {match.teams.home.name} vs {match.teams.away.name}
              </Text>
              <Text style={styles.quickMatchDate}>
                {new Date(match.fixture.date).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    return (
      <View style={styles.expandedContent}>
        {renderSearchControls()}
        
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#1976d2" />
            <Text style={styles.loadingText}>Searching matches...</Text>
          </View>
        )}

        <Text style={styles.resultsHeader}>
          {matches.length} matches found
        </Text>

        <FlatList
          data={matches}
          renderItem={renderMatchItem}
          keyExtractor={(item) => item.fixture.id.toString()}
          showsVerticalScrollIndicator={false}
          style={styles.matchList}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Map Layer */}
      <MatchMapView
        ref={mapRef}
        matches={matches}
        onRegionChange={handleMapRegionChange}
        onMarkerPress={handleMarkerPress}
        selectedMatchId={selectedMatch?.fixture.id}
        style={styles.map}
      />

      {/* Search Overlay */}
      {(!location || showLocationSearch || !dateFrom || !dateTo) && (
        <View style={styles.searchOverlay}>
          <Card containerStyle={styles.searchCard}>
            <Text style={styles.searchTitle}>Find Football Matches</Text>
            {renderSearchControls()}
          </Card>
        </View>
      )}

      {/* Bottom Sheet */}
      <BottomSheet
        onStateChange={setSheetState}
        initialState="collapsed"
      >
        {renderBottomSheetContent()}
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  searchOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  searchCard: {
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  searchTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  searchControls: {
    gap: 16,
  },
  searchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  locationSearchContainer: {
    marginBottom: 8,
  },
  locationInput: {
    marginBottom: 0,
  },
  locationSummary: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 8,
  },
  locationSummaryText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  changeLocationText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  dateControls: {
    marginBottom: 8,
  },
  dateRangeButton: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dateRangeContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  dateSection: {
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  dateValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1976d2',
  },
  dateDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#ccc',
  },
  clearDatesButton: {
    marginTop: 10,
    alignSelf: 'center',
  },
  clearDatesText: {
    color: '#1976d2',
    fontSize: 16,
  },
  calendarContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  collapsedContent: {
    padding: 16,
  },
  matchCount: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#333',
  },
  quickMatchItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  quickMatchText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  quickMatchDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  expandedContent: {
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 8,
    color: '#666',
  },
  resultsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  matchList: {
    flex: 1,
  },
  matchCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  selectedMatchCard: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
    borderWidth: 2,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  matchDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  matchTime: {
    fontSize: 14,
    color: '#666',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  teamContainer: {
    alignItems: 'center',
    flex: 1,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    color: '#333',
  },
  vsText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    marginHorizontal: 16,
  },
  venueRow: {
    marginBottom: 8,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  venueLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leagueName: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontStyle: 'italic',
  },
});

export default MapSearchScreen;
 