import React, { useState, useCallback } from 'react';
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
  TextInput,
  Image,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { MaterialIcons } from '@expo/vector-icons';
import { debounce } from 'lodash';
import ApiService from '../services/api';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const AddFlightModal = ({ visible, onClose, tripId, onFlightAdded }) => {
  // Form state
  const [flightNumber, setFlightNumber] = useState('');
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [date, setDate] = useState(null);
  
  // Airport search state
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [originResults, setOriginResults] = useState([]);
  const [destinationResults, setDestinationResults] = useState([]);
  const [originSearchLoading, setOriginSearchLoading] = useState(false);
  const [destinationSearchLoading, setDestinationSearchLoading] = useState(false);
  const [showOriginResults, setShowOriginResults] = useState(false);
  const [showDestinationResults, setShowDestinationResults] = useState(false);
  
  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDates, setSelectedDates] = useState({});
  
  // Flight lookup state
  const [foundFlight, setFoundFlight] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);

  // Debounced airport search
  const debouncedOriginSearch = useCallback(
    debounce(async (query) => {
      if (!query || query.trim().length < 2) {
        setOriginResults([]);
        setOriginSearchLoading(false);
        return;
      }
      
      try {
        setOriginSearchLoading(true);
        const response = await ApiService.searchAirports(query, 10);
        setOriginResults(response.data || []);
      } catch (error) {
        console.error('Error searching airports:', error);
        setOriginResults([]);
      } finally {
        setOriginSearchLoading(false);
      }
    }, 300),
    []
  );

  const debouncedDestinationSearch = useCallback(
    debounce(async (query) => {
      if (!query || query.trim().length < 2) {
        setDestinationResults([]);
        setDestinationSearchLoading(false);
        return;
      }
      
      try {
        setDestinationSearchLoading(true);
        const response = await ApiService.searchAirports(query, 10);
        setDestinationResults(response.data || []);
      } catch (error) {
        console.error('Error searching airports:', error);
        setDestinationResults([]);
      } finally {
        setDestinationSearchLoading(false);
      }
    }, 300),
    []
  );

  // Handle airport search input changes
  const handleOriginQueryChange = (text) => {
    setOriginQuery(text);
    setShowOriginResults(true);
    setFoundFlight(null);
    if (text.trim().length >= 2) {
      debouncedOriginSearch(text);
    } else {
      setOriginResults([]);
    }
  };

  const handleDestinationQueryChange = (text) => {
    setDestinationQuery(text);
    setShowDestinationResults(true);
    setFoundFlight(null);
    if (text.trim().length >= 2) {
      debouncedDestinationSearch(text);
    } else {
      setDestinationResults([]);
    }
  };

  // Handle airport selection
  const handleOriginSelect = (airport) => {
    setOrigin(airport);
    setOriginQuery(`${airport.code} - ${airport.name}`);
    setShowOriginResults(false);
    setOriginResults([]);
    setFoundFlight(null);
  };

  const handleDestinationSelect = (airport) => {
    setDestination(airport);
    setDestinationQuery(`${airport.code} - ${airport.name}`);
    setShowDestinationResults(false);
    setDestinationResults([]);
    setFoundFlight(null);
  };

  // Handle date selection
  const handleDayPress = (day) => {
    const dateStr = day.dateString;
    setDate(dateStr);
    setSelectedDates({
      [dateStr]: {
        selected: true,
        selectedColor: colors.primary,
      }
    });
    setShowCalendar(false);
    setFoundFlight(null);
  };

  // Format date for display
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return 'Select date';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Look up flight
  const handleLookupFlight = async () => {
    if (!flightNumber || !origin || !destination || !date) {
      Alert.alert('Missing Information', 'Please fill in all fields: flight number, origin, destination, and date');
      return;
    }

    try {
      setLookingUp(true);
      setFoundFlight(null);
      
      const response = await ApiService.getFlightByNumber(
        flightNumber.trim().toUpperCase(),
        origin.code,
        destination.code,
        date
      );
      
      if (response.success && response.data) {
        setFoundFlight(response.data);
      } else {
        Alert.alert('Flight Not Found', 'Could not find this flight. Please verify the flight number, route, and date.');
      }
    } catch (error) {
      console.error('Error looking up flight:', error);
      Alert.alert('Error', error.message || 'Failed to look up flight. Please try again.');
    } finally {
      setLookingUp(false);
    }
  };

  // Save flight to trip
  const handleSaveFlight = async () => {
    if (!foundFlight || !tripId) {
      return;
    }

    try {
      setSaving(true);
      
      const flightData = {
        flightNumber: foundFlight.flightNumber,
        airline: {
          code: foundFlight.airline?.code,
          name: foundFlight.airline?.name
        },
        departure: {
          airport: {
            code: foundFlight.departure?.airport,
            name: foundFlight.departure?.airport
          },
          date: foundFlight.departure?.date?.split('T')[0] || date,
          time: foundFlight.departure?.time || foundFlight.departure?.date?.split('T')[1]?.substring(0, 5)
        },
        arrival: {
          airport: {
            code: foundFlight.arrival?.airport,
            name: foundFlight.arrival?.airport
          },
          date: foundFlight.arrival?.date?.split('T')[0],
          time: foundFlight.arrival?.time || foundFlight.arrival?.date?.split('T')[1]?.substring(0, 5)
        },
        duration: foundFlight.duration || 0,
        stops: foundFlight.stops || 0
      };

      await ApiService.addFlightToTrip(tripId, flightData);
      
      Alert.alert('Success', 'Flight added to trip successfully', [
        {
          text: 'OK',
          onPress: () => {
            handleClearAll();
            onFlightAdded && onFlightAdded();
            onClose();
          }
        }
      ]);
    } catch (error) {
      console.error('Error saving flight:', error);
      Alert.alert('Error', error.message || 'Failed to save flight to trip. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Clear all fields
  const handleClearAll = () => {
    setFlightNumber('');
    setOrigin(null);
    setDestination(null);
    setDate(null);
    setOriginQuery('');
    setDestinationQuery('');
    setOriginResults([]);
    setDestinationResults([]);
    setShowOriginResults(false);
    setShowDestinationResults(false);
    setSelectedDates({});
    setShowCalendar(false);
    setFoundFlight(null);
  };

  // Get airline logo URL
  const getAirlineLogoUrl = (airlineCode) => {
    if (!airlineCode) return null;
    return `https://www.gstatic.com/flights/airline_logos/70px/${airlineCode.toUpperCase()}.png`;
  };

  // Get full airline name
  const getAirlineName = (airlineCode) => {
    if (!airlineCode) return 'Unknown Airline';
    const code = airlineCode.toUpperCase();
    const airlineNames = {
      'AA': 'American Airlines',
      'DL': 'Delta Air Lines',
      'UA': 'United Airlines',
      'WN': 'Southwest Airlines',
      'AS': 'Alaska Airlines',
      'B6': 'JetBlue Airways',
      'VS': 'Virgin Atlantic',
      'BA': 'British Airways',
      'AF': 'Air France',
      'LH': 'Lufthansa',
      'EK': 'Emirates',
      'QR': 'Qatar Airways',
    };
    return airlineNames[code] || airlineCode;
  };

  // Format duration
  const formatDuration = (minutes) => {
    if (!minutes) return '--';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Format time
  const formatTime = (timeStr) => {
    if (!timeStr) return '--:--';
    if (timeStr.includes('T')) {
      return timeStr.split('T')[1]?.substring(0, 5) || '--:--';
    }
    return timeStr.substring(0, 5);
  };

  // Render airport result
  const renderAirportResult = (airport, onSelect) => (
    <TouchableOpacity
      key={airport.code}
      style={styles.airportResultItem}
      onPress={() => onSelect(airport)}
      activeOpacity={0.7}
    >
      <MaterialIcons name="location-on" size={40} color={colors.text.primary} />
      <View style={styles.airportResultText}>
        <Text style={styles.airportCode}>{airport.code} - {airport.name}</Text>
        {airport.city && (
          <Text style={styles.airportCity}>
            {`${airport.city}${airport.country ? `, ${airport.country}` : ''}`}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  // Render found flight card
  const renderFlightCard = () => {
    if (!foundFlight) return null;

    const departureTime = formatTime(foundFlight.departure?.time || foundFlight.departure?.date);
    const arrivalTime = formatTime(foundFlight.arrival?.time || foundFlight.arrival?.date);
    const airlineCode = foundFlight.airline?.code;
    const airlineLogoUrl = airlineCode ? getAirlineLogoUrl(airlineCode) : null;

    return (
      <View style={styles.flightCard}>
        <View style={styles.flightCardHeader}>
          <Text style={styles.flightCardTitle}>Flight Found</Text>
        </View>
        
        <View style={styles.flightRoute}>
          <View style={styles.flightSegment}>
            <Text style={styles.flightTime}>{departureTime}</Text>
            <Text style={styles.flightAirport}>{foundFlight.departure?.airport || 'N/A'}</Text>
          </View>
          
          <View style={styles.flightDuration}>
            <View style={styles.flightDurationLine} />
            <Text style={styles.flightDurationText}>{formatDuration(foundFlight.duration)}</Text>
          </View>
          
          <View style={styles.flightSegment}>
            <Text style={styles.flightTime}>{arrivalTime}</Text>
            <Text style={styles.flightAirport}>{foundFlight.arrival?.airport || 'N/A'}</Text>
          </View>
        </View>
        
        {airlineCode && (
          <View style={styles.flightAirlineContainer}>
            {airlineLogoUrl && (
              <Image
                source={{ uri: airlineLogoUrl }}
                style={styles.flightAirlineLogo}
                resizeMode="contain"
              />
            )}
            <Text style={styles.flightAirline}>
              {getAirlineName(airlineCode)} {foundFlight.flightNumber}
            </Text>
          </View>
        )}
        
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSaveFlight}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>Add to Trip</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <MaterialIcons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Flight</Text>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearAll}
            accessibilityLabel="Clear all"
            accessibilityRole="button"
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Flight Number */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Flight Number</Text>
            </View>
            <View style={styles.searchInputContainer}>
              <MaterialIcons name="flight" size={25} color="rgba(0, 0, 0, 0.5)" />
              <TextInput
                style={styles.searchInput}
                placeholder="UA381"
                placeholderTextColor="rgba(0, 0, 0, 0.5)"
                value={flightNumber}
                onChangeText={(text) => {
                  setFlightNumber(text.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                  setFoundFlight(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Origin */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>From</Text>
            </View>
            <View style={styles.searchInputContainer}>
              <MaterialIcons name="flight-takeoff" size={25} color="rgba(0, 0, 0, 0.5)" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search origin airport"
                placeholderTextColor="rgba(0, 0, 0, 0.5)"
                value={originQuery}
                onChangeText={handleOriginQueryChange}
                onFocus={() => setShowOriginResults(true)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {originQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setOriginQuery('');
                    setOrigin(null);
                    setShowOriginResults(false);
                  }}
                  style={styles.clearSearchButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="close" size={20} color="rgba(0, 0, 0, 0.5)" />
                </TouchableOpacity>
              )}
            </View>
            {showOriginResults && (
              <View style={styles.resultsContainer}>
                {originSearchLoading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                )}
                {!originSearchLoading && originResults.length > 0 && (
                  originResults.map(airport => renderAirportResult(airport, handleOriginSelect))
                )}
                {!originSearchLoading && originQuery.length >= 2 && originResults.length === 0 && (
                  <View style={styles.locationEmptyContainer}>
                    <Text style={styles.locationEmptyText}>No airports found</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Destination */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>To</Text>
            </View>
            <View style={styles.searchInputContainer}>
              <MaterialIcons name="flight-land" size={25} color="rgba(0, 0, 0, 0.5)" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search destination airport"
                placeholderTextColor="rgba(0, 0, 0, 0.5)"
                value={destinationQuery}
                onChangeText={handleDestinationQueryChange}
                onFocus={() => setShowDestinationResults(true)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {destinationQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setDestinationQuery('');
                    setDestination(null);
                    setShowDestinationResults(false);
                  }}
                  style={styles.clearSearchButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="close" size={20} color="rgba(0, 0, 0, 0.5)" />
                </TouchableOpacity>
              )}
            </View>
            {showDestinationResults && (
              <View style={styles.resultsContainer}>
                {destinationSearchLoading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                )}
                {!destinationSearchLoading && destinationResults.length > 0 && (
                  destinationResults.map(airport => renderAirportResult(airport, handleDestinationSelect))
                )}
                {!destinationSearchLoading && destinationQuery.length >= 2 && destinationResults.length === 0 && (
                  <View style={styles.locationEmptyContainer}>
                    <Text style={styles.locationEmptyText}>No airports found</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Date */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => {
                setShowCalendar(!showCalendar);
              }}
              activeOpacity={0.7}
            >
              <View>
                <Text style={styles.cardLabel}>Date</Text>
                <Text style={styles.cardValue}>{formatDisplayDate(date)}</Text>
              </View>
              <MaterialIcons
                name={showCalendar ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>
            {showCalendar && (
              <View style={styles.calendarContainer}>
                <Calendar
                  onDayPress={handleDayPress}
                  markedDates={selectedDates}
                  minDate={new Date().toISOString().split('T')[0]}
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

          {/* Lookup Button */}
          <TouchableOpacity
            style={[
              styles.lookupButton,
              (!flightNumber || !origin || !destination || !date || lookingUp) && styles.lookupButtonDisabled
            ]}
            onPress={handleLookupFlight}
            disabled={!flightNumber || !origin || !destination || !date || lookingUp}
          >
            {lookingUp ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.lookupButtonText}>Look up Flight</Text>
            )}
          </TouchableOpacity>

          {/* Found Flight Card */}
          {renderFlightCard()}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  closeButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  clearButton: {
    padding: spacing.xs,
  },
  clearButtonText: {
    ...typography.body,
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  cardLabel: {
    ...typography.label,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  cardValue: {
    ...typography.body,
    color: colors.text.primary,
    fontFamily: typography.fontFamily,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    fontFamily: typography.fontFamily,
    marginLeft: spacing.sm,
  },
  clearSearchButton: {
    padding: spacing.xs,
  },
  resultsContainer: {
    marginTop: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  loadingContainer: {
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
  airportResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  airportResultText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  airportCode: {
    ...typography.body,
    color: colors.text.primary,
    fontFamily: typography.fontFamily,
  },
  airportCity: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  calendarContainer: {
    padding: spacing.md,
  },
  lookupButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  lookupButtonDisabled: {
    backgroundColor: colors.interactive.disabled,
    opacity: 0.5,
  },
  lookupButtonText: {
    ...typography.button,
    color: colors.onPrimary,
  },
  flightCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadows.small,
  },
  flightCardHeader: {
    marginBottom: spacing.md,
  },
  flightCardTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  flightRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  flightSegment: {
    flex: 1,
    alignItems: 'center',
  },
  flightTime: {
    ...typography.h3,
    color: colors.text.primary,
    fontFamily: typography.fontFamily,
    marginBottom: spacing.xs,
  },
  flightAirport: {
    ...typography.body,
    color: colors.text.secondary,
  },
  flightDuration: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  flightDurationLine: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  flightDurationText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  flightAirlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  flightAirlineLogo: {
    width: 40,
    height: 40,
    marginRight: spacing.sm,
  },
  flightAirline: {
    ...typography.body,
    color: colors.text.primary,
    fontFamily: typography.fontFamily,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.onPrimary,
  },
});

export default AddFlightModal;

