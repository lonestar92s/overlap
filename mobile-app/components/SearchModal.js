import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Button, Overlay } from 'react-native-elements';
import { Calendar } from 'react-native-calendars';
import LocationAutocomplete from './LocationAutocomplete';

const SearchModal = ({ 
  visible, 
  onClose, 
  onSearch, 
  initialLocation = null,
  initialDateFrom = null,
  initialDateTo = null,
  loading = false
}) => {
  const [location, setLocation] = useState(initialLocation);
  const [selectedDates, setSelectedDates] = useState({});
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [showCalendar, setShowCalendar] = useState(false);

  // Update state when initial values change
  useEffect(() => {
    setLocation(initialLocation);
    setDateFrom(initialDateFrom);
    setDateTo(initialDateTo);
    
    // Set selected dates for calendar
    if (initialDateFrom && initialDateTo) {
      const dates = {};
      
      // Create range using string-based date arithmetic
      const [startYear, startMonth, startDay] = initialDateFrom.split('-').map(Number);
      const [endYear, endMonth, endDay] = initialDateTo.split('-').map(Number);
      
      const rangeDates = [];
      let currentYear = startYear;
      let currentMonth = startMonth;
      let currentDay = startDay;
      
      while (currentYear < endYear || (currentYear === endYear && currentMonth < endMonth) || 
             (currentYear === endYear && currentMonth === endMonth && currentDay <= endDay)) {
        
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
        rangeDates.push(dateStr);
        
        // Move to next day
        currentDay++;
        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
        const maxDays = currentMonth === 2 && isLeapYear ? 29 : daysInMonth[currentMonth - 1];
        
        if (currentDay > maxDays) {
          currentDay = 1;
          currentMonth++;
          if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
          }
        }
      }
      
      rangeDates.forEach((dateStr, index) => {
        dates[dateStr] = {
          selected: true,
          startingDay: index === 0,
          endingDay: index === rangeDates.length - 1,
        };
      });
      
      setSelectedDates(dates);
    }
  }, [initialLocation, initialDateFrom, initialDateTo]);

  const formatDate = (date) => {
    if (!date) return null;
    return date.split('T')[0];
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Add dates';
    
    // Format directly from string without any Date object conversion
    const [year, month, day] = dateString.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[parseInt(month) - 1];
    
    return `${monthName} ${parseInt(day)}`;
  };

  const onDayPress = (day) => {
    const selectedDate = day.dateString;
    
    if (!dateFrom || (dateFrom && dateTo)) {
      // Start new selection
      setDateFrom(selectedDate);
      setDateTo(null);
      setSelectedDates({
        [selectedDate]: {
          selected: true,
          startingDay: true,
          endingDay: true,
        }
      });
    } else {
      // Complete selection - compare dates as strings to avoid timezone issues
      if (selectedDate < dateFrom) {
        // Swap dates if end is before start
        setDateFrom(selectedDate);
        setDateTo(dateFrom);
        const dates = {};
        
        // Create range from selectedDate to dateFrom
        const [startYear, startMonth, startDay] = selectedDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = dateFrom.split('-').map(Number);
        
        const rangeDates = [];
        let currentYear = startYear;
        let currentMonth = startMonth;
        let currentDay = startDay;
        
        while (currentYear < endYear || (currentYear === endYear && currentMonth < endMonth) || 
               (currentYear === endYear && currentMonth === endMonth && currentDay <= endDay)) {
          
          const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
          rangeDates.push(dateStr);
          
          // Move to next day
          currentDay++;
          const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
          const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
          const maxDays = currentMonth === 2 && isLeapYear ? 29 : daysInMonth[currentMonth - 1];
          
          if (currentDay > maxDays) {
            currentDay = 1;
            currentMonth++;
            if (currentMonth > 12) {
              currentMonth = 1;
              currentYear++;
            }
          }
        }
        
        rangeDates.forEach((dateStr, index) => {
          dates[dateStr] = {
            selected: true,
            startingDay: index === 0,
            endingDay: index === rangeDates.length - 1,
          };
        });
        
        setSelectedDates(dates);
      } else {
        setDateTo(selectedDate);
        const dates = { ...selectedDates };
        
        // Create range from dateFrom to selectedDate
        const [startYear, startMonth, startDay] = dateFrom.split('-').map(Number);
        const [endYear, endMonth, endDay] = selectedDate.split('-').map(Number);
        
        const rangeDates = [];
        let currentYear = startYear;
        let currentMonth = startMonth;
        let currentDay = startDay;
        
        while (currentYear < endYear || (currentYear === endYear && currentMonth < endMonth) || 
               (currentYear === endYear && currentMonth === endMonth && currentDay <= endDay)) {
          
          const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
          rangeDates.push(dateStr);
          
          // Move to next day
          currentDay++;
          const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
          const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
          const maxDays = currentMonth === 2 && isLeapYear ? 29 : daysInMonth[currentMonth - 1];
          
          if (currentDay > maxDays) {
            currentDay = 1;
            currentMonth++;
            if (currentMonth > 12) {
              currentMonth = 1;
              currentYear++;
            }
          }
        }
        
        rangeDates.forEach((dateStr, index) => {
          dates[dateStr] = {
            selected: true,
            startingDay: index === 0,
            endingDay: index === rangeDates.length - 1,
          };
        });
        
        setSelectedDates(dates);
      }
    }
  };

  const clearAll = () => {
    setLocation(null);
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

    const searchParams = {
      location,
      dateFrom: formatDate(dateFrom),
      dateTo: formatDate(dateTo)
    };

    onSearch(searchParams);
  };

  return (
    <Overlay
      isVisible={visible}
      onBackdropPress={onClose}
      overlayStyle={styles.overlayStyle}
      animationType="slide"
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Search</Text>
          <TouchableOpacity onPress={clearAll} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Search Form */}
        <View style={styles.form}>
          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Where</Text>
            <LocationAutocomplete
              onLocationSelect={setLocation}
              initialValue={location?.city}
              placeholder="Search for a city"
            />
          </View>

          {/* Dates */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>When</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowCalendar(!showCalendar)}
            >
              <Text style={styles.dateButtonText}>
                {dateFrom && dateTo 
                  ? `${formatDisplayDate(dateFrom)} - ${formatDisplayDate(dateTo)}`
                  : 'Select dates'
                }
              </Text>
            </TouchableOpacity>
          </View>

          {/* Calendar */}
          {showCalendar && (
            <View style={styles.calendarContainer}>
              <Calendar
                onDayPress={onDayPress}
                markedDates={selectedDates}
                markingType="period"
                theme={{
                  selectedDayBackgroundColor: '#007AFF',
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: '#007AFF',
                  dayTextColor: '#2d4150',
                  textDisabledColor: '#d9e1e8',
                  arrowColor: '#007AFF',
                  monthTextColor: '#2d4150',
                  indicatorColor: '#007AFF',
                  textDayFontWeight: '300',
                  textMonthFontWeight: 'bold',
                  textDayHeaderFontWeight: '300',
                  textDayFontSize: 16,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 13
                }}
              />
            </View>
          )}
        </View>

        {/* Search Button */}
        <View style={styles.buttonContainer}>
          <Button
            title={loading ? "Searching..." : "Search Matches"}
            onPress={handleSearch}
            disabled={loading || !location || !dateFrom || !dateTo}
            loading={loading}
            buttonStyle={styles.searchButton}
            titleStyle={styles.searchButtonText}
          />
        </View>
      </View>
    </Overlay>
  );
};

const styles = StyleSheet.create({
  overlayStyle: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 0,
    margin: 20,
    width: '90%',
    maxHeight: '80%',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  clearButton: {
    padding: 5,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  form: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 15,
    backgroundColor: '#f8f8f8',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  calendarContainer: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  searchButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SearchModal;

