import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Modal,
} from 'react-native';
import { Button, Card } from 'react-native-elements';
import { Calendar } from 'react-native-calendars';
import LocationAutocomplete from '../components/LocationAutocomplete';
import ApiService from '../services/api';

const SearchScreen = ({ navigation }) => {
  const [location, setLocation] = useState(null);
  const [selectedDates, setSelectedDates] = useState({});
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Placeholder data for horizontal sections
  const destinationCards = [
    { id: '1', location: 'London', cost: '£150' },
    { id: '2', location: 'Barcelona', cost: '€200' },
    { id: '3', location: 'Munich', cost: '€180' },
    { id: '4', location: 'Paris', cost: '€220' },
    { id: '5', location: 'Amsterdam', cost: '€160' },
  ];

  const popularDestinations = [
    { id: '1', location: 'Madrid', cost: '€190' },
    { id: '2', location: 'Rome', cost: '€170' },
    { id: '3', location: 'Berlin', cost: '€140' },
    { id: '4', location: 'Milan', cost: '€200' },
    { id: '5', location: 'Dortmund', cost: '€120' },
  ];

  // Recent searches data
  const recentSearches = [
    { id: '1', location: 'London', dates: 'Sep 24 - 28', guests: '2 guests' },
    { id: '2', location: 'Barcelona', dates: 'Oct 13 - Nov 15', guests: '4 guests' },
    { id: '3', location: 'Munich', dates: 'Oct 2 - 6', guests: '2 guests' },
  ];

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
    return date.split('T')[0];
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
        const start = new Date(dateFrom);
        const end = new Date(dateString);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const currentDate = d.toISOString().split('T')[0];
          
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
        setTimeout(() => setShowCalendar(false), 500);
      }
    }
  };

  const clearAll = () => {
    setLocation(null);
    setDateFrom(null);
    setDateTo(null);
    setSelectedDates({});
    setSelectedTeam(null);
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
      const searchParams = {
        location,
        dateFrom: formatDate(dateFrom),
        dateTo: formatDate(dateTo)
      };
      
      console.log('SearchScreen: Performing search with params:', searchParams);
      console.log('SearchScreen: Location details:', location);
      
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
        dateFrom: searchParams.dateFrom,
        dateTo: searchParams.dateTo
      });
      
      const matches = response.data || [];
      
      console.log('SearchScreen: Found matches:', matches.length);
      
      const initialRegion = {
        latitude: location.lat,
        longitude: location.lon,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
      
      // Close modal and navigate
      setShowSearchModal(false);
      navigation.navigate('MapResults', { 
        searchParams,
        matches,
        initialRegion
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
      <View style={styles.cardImagePlaceholder} />
      <View style={styles.cardContent}>
        <Text style={styles.cardLocation}>{item.location}</Text>
        <Text style={styles.cardLocation}>{item.location}</Text>
        <View style={styles.cardCostContainer}>
          <Text style={styles.cardCost}>{item.cost}</Text>
          <Text style={styles.cardCost}>{item.cost}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderRecentSearch = ({ item }) => (
    <TouchableOpacity style={styles.recentSearchItem}>
      <View style={styles.recentSearchIcon}>
        <Text style={styles.recentSearchIconText}>🏟️</Text>
      </View>
      <View style={styles.recentSearchContent}>
        <Text style={styles.recentSearchLocation}>{item.location}</Text>
        <Text style={styles.recentSearchDates}>{item.dates}</Text>
        <Text style={styles.recentSearchGuests}>{item.guests}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSuggestedDestination = ({ item }) => (
    <TouchableOpacity style={styles.suggestedDestinationItem}>
      <Text style={styles.suggestedDestinationIcon}>{item.icon}</Text>
      <Text style={styles.suggestedDestinationName}>{item.name}</Text>
    </TouchableOpacity>
  );

  const today = new Date().toISOString().split('T')[0];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Top Search Bar */}
        <View style={styles.searchBarContainer}>
          <TouchableOpacity 
            style={styles.searchBar}
            onPress={() => setShowSearchModal(true)}
          >
            <Text style={styles.searchIcon}>🔍</Text>
            <Text style={styles.searchPlaceholder}>Start your lap</Text>
          </TouchableOpacity>
        </View>

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

        {/* Popular Matches Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Matches</Text>
          <FlatList
            data={destinationCards}
            renderItem={renderDestinationCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </View>

        {/* Popular Destinations Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Destinations</Text>
          <FlatList
            data={popularDestinations}
            renderItem={renderDestinationCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </View>
      </ScrollView>

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

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Main Search Content */}
            <View style={styles.modalSearchCard}>
              <Text style={styles.modalSearchTitle}>Where?</Text>
              
              <LocationAutocomplete
                value={location}
                onSelect={setLocation}
                placeholder="Search destinations"
                style={styles.modalLocationInput}
              />

              {/* Recent Searches */}
              <Text style={styles.modalSectionTitle}>Recent searches</Text>
              <FlatList
                data={recentSearches}
                renderItem={renderRecentSearch}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />

              {/* Suggested Destinations */}
              <Text style={styles.modalSectionTitle}>Suggested destinations</Text>
              <View style={styles.suggestedDestinationsGrid}>
                {suggestedDestinations.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.suggestedDestinationItem}>
                    <Text style={styles.suggestedDestinationIcon}>{item.icon}</Text>
                    <Text style={styles.suggestedDestinationName}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* When Input */}
              <Text style={styles.modalSearchTitle}>When?</Text>
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
                    minDate={today}
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
              <TouchableOpacity style={styles.modalSearchInput}>
                <Text style={styles.modalSearchIcon}>👥</Text>
                <Text style={styles.modalSearchPlaceholder}>Add team</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Bottom Action Bar */}
          <View style={styles.modalActionBar}>
            <TouchableOpacity onPress={clearAll}>
              <Text style={styles.modalClearAllText}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.modalSearchButton,
                (!location || !dateFrom || !dateTo) && styles.modalSearchButtonDisabled
              ]}
              onPress={handleSearch}
              disabled={loading || !location || !dateFrom || !dateTo}
            >
              <Text style={styles.modalSearchIcon}>🔍</Text>
              <Text style={styles.modalSearchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  searchBarContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchPlaceholder: {
    fontSize: 16,
    color: '#999',
    flex: 1,
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
  cardImagePlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: '#e0e0e0',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  cardContent: {
    padding: 12,
  },
  cardLocation: {
    fontSize: 14,
    color: '#333',
    marginBottom: 2,
  },
  cardCostContainer: {
    marginTop: 8,
  },
  cardCost: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
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
  recentSearchIconText: {
    fontSize: 16,
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
  recentSearchGuests: {
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
    backgroundColor: '#ff385c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalSearchButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalSearchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});

export default SearchScreen; 