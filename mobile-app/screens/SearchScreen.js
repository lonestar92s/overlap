import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
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

  const formatDate = (date) => {
    if (!date) return null;
    return date.split('T')[0]; // Convert to YYYY-MM-DD format
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Select date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

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
        // Auto-close calendar after selecting date range
        setTimeout(() => setShowCalendar(false), 500);
      }
    }
  };

  const clearDates = () => {
    setDateFrom(null);
    setDateTo(null);
    setSelectedDates({});
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
      // Navigate to map results screen with search parameters
      const searchParams = {
        location,
        dateFrom: formatDate(dateFrom),
        dateTo: formatDate(dateTo)
      };
      
      console.log('SearchScreen: Navigating with params:', searchParams);
      console.log('SearchScreen: Location details:', location);
      
      navigation.navigate('MapResults', { 
        searchParams
      });
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to search matches');
    } finally {
      setLoading(false);
    }
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

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

        <Text style={styles.sectionTitle}>When are you traveling?</Text>
        
        <TouchableOpacity
          style={styles.dateRangeButton}
          onPress={() => setShowCalendar(!showCalendar)}
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

        {showCalendar && (
          <View style={styles.calendarContainer}>
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



        <Button
          title="Search Matches"
          onPress={handleSearch}
          loading={loading}
          disabled={loading || !location || !dateFrom || !dateTo}
          buttonStyle={[
            styles.searchButton,
            (!location || !dateFrom || !dateTo) && styles.searchButtonDisabled
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
          Select your travel destination and dates to find football matches you can attend.
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

  inputContainer: {
    marginBottom: 15,
  },
  locationInput: {
    marginBottom: 20,
  },
  leaguePicker: {
    marginBottom: 20,
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

});

export default SearchScreen; 