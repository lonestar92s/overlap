import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Button, Card, ButtonGroup } from 'react-native-elements';
import DateTimePicker from '@react-native-community/datetimepicker';
import LocationAutocomplete from '../components/LocationAutocomplete';
import ApiService from '../services/api';

const SearchScreen = ({ navigation }) => {
  const [location, setLocation] = useState(null);
  const [dateFrom, setDateFrom] = useState(new Date());
  const [dateTo, setDateTo] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // 30 days from now
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDistance, setSelectedDistance] = useState(1); // Index for 100 miles (default)

  // Distance options
  const distanceOptions = [
    { label: '50 mi', value: 50 },
    { label: '100 mi', value: 100 },
    { label: '250 mi', value: 250 }
  ];

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const handleSearch = async () => {
    if (!location) {
      Alert.alert('Error', 'Please select a location');
      return;
    }

    setLoading(true);
    try {
      const searchParams = {
        location,
        dateFrom: formatDate(dateFrom),
        dateTo: formatDate(dateTo),
        maxDistance: distanceOptions[selectedDistance].value
      };

      // Search matches from all leagues with distance filter
      const response = await ApiService.searchAllMatchesByLocation(searchParams);
      
      if (response.success) {
        navigation.navigate('Results', { 
          matches: response.data,
          searchParams: {
            ...searchParams,
            location,
            maxDistance: distanceOptions[selectedDistance].value
          }
        });
      } else {
        Alert.alert('Error', response.error || 'No matches found for your search criteria');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to search matches');
    } finally {
      setLoading(false);
    }
  };

  const onFromDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || dateFrom;
    setShowFromPicker(false);
    setDateFrom(currentDate);
  };

  const onToDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || dateTo;
    setShowToPicker(false);
    setDateTo(currentDate);
  };

  return (
    <ScrollView style={styles.container}>
      <Card containerStyle={styles.card}>
        <Text style={styles.title}>Plan Your Football Trip</Text>
        <Text style={styles.subtitle}>Find matches to attend during your travels</Text>
        
        <Text style={styles.sectionTitle}>Where are you traveling?</Text>
        <LocationAutocomplete
          value={location}
          onSelect={setLocation}
          placeholder="Enter your destination city..."
          style={styles.locationInput}
        />

        <Text style={styles.sectionTitle}>Travel Dates</Text>
        
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowFromPicker(true)}
        >
          <Text style={styles.dateButtonText}>
            From: {formatDate(dateFrom)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowToPicker(true)}
        >
          <Text style={styles.dateButtonText}>
            To: {formatDate(dateTo)}
          </Text>
        </TouchableOpacity>

        {showFromPicker && (
          <DateTimePicker
            testID="dateFromPicker"
            value={dateFrom}
            mode="date"
            display="default"
            onChange={onFromDateChange}
            minimumDate={new Date()}
          />
        )}

        {showToPicker && (
          <DateTimePicker
            testID="dateToPicker"
            value={dateTo}
            mode="date"
            display="default"
            onChange={onToDateChange}
            minimumDate={dateFrom}
          />
        )}

        <Text style={styles.sectionTitle}>Search Distance</Text>
        <Text style={styles.distanceSubtitle}>
          Find matches within {distanceOptions[selectedDistance].label} of your destination
        </Text>
        
        <ButtonGroup
          onPress={setSelectedDistance}
          selectedIndex={selectedDistance}
          buttons={distanceOptions.map(option => option.label)}
          containerStyle={styles.distanceButtonGroup}
          selectedButtonStyle={styles.selectedDistanceButton}
          textStyle={styles.distanceButtonText}
          selectedTextStyle={styles.selectedDistanceButtonText}
        />

        <Button
          title="Find Matches"
          onPress={handleSearch}
          loading={loading}
          disabled={loading || !location}
          buttonStyle={[
            styles.searchButton,
            (!location) && styles.searchButtonDisabled
          ]}
          titleStyle={styles.searchButtonText}
          icon={{
            name: 'search',
            type: 'material',
            size: 20,
            color: 'white',
          }}
        />

        <Text style={styles.helpText}>
          Select your travel destination, dates, and search distance to find football matches you can attend.
        </Text>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 10,
    borderRadius: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    color: '#666',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
    color: '#555',
  },
  distanceSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  distanceButtonGroup: {
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  distanceButtonText: {
    fontSize: 16,
    color: '#1976d2',
  },
  selectedDistanceButton: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  selectedDistanceButtonText: {
    color: 'white',
  },
  inputContainer: {
    marginBottom: 15,
  },
  locationInput: {
    marginBottom: 20,
  },
  leaguePicker: {
    marginBottom: 20,
  },
  dateButton: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1976d2',
    textAlign: 'center',
  },
  searchButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    marginTop: 20,
    paddingVertical: 15,
  },
  searchButtonDisabled: {
    backgroundColor: '#ccc',
  },
  searchButtonText: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic',
  },
  distanceButtonGroup: {
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  distanceButtonText: {
    fontSize: 16,
    color: '#1976d2',
  },
  selectedDistanceButton: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  selectedDistanceButtonText: {
    color: 'white',
  },
  distanceSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
});

export default SearchScreen; 