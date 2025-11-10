import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Image,
  Linking,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { MaterialIcons } from '@expo/vector-icons';
import { debounce } from 'lodash';
import ApiService from '../services/api';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const FlightSearchTab = ({ onClose, dateFrom, dateTo }) => {
  // Search form state
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [departureDate, setDepartureDate] = useState(dateFrom || null);
  const [returnDate, setReturnDate] = useState(dateTo || null);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [nonStop, setNonStop] = useState(false);
  const [adults, setAdults] = useState(1);
  
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
  const [showDepartureCalendar, setShowDepartureCalendar] = useState(false);
  const [showReturnCalendar, setShowReturnCalendar] = useState(false);
  const [selectedDates, setSelectedDates] = useState({});
  
  // Flight results state
  const [flightResults, setFlightResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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
        Alert.alert('Error', 'Failed to search airports. Please try again.');
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
        Alert.alert('Error', 'Failed to search airports. Please try again.');
        setDestinationResults([]);
      } finally {
        setDestinationSearchLoading(false);
      }
    }, 300),
    []
  );

  // Handle origin query change
  useEffect(() => {
    if (originQuery) {
      setShowOriginResults(true);
      debouncedOriginSearch(originQuery);
    } else {
      setOriginResults([]);
      setShowOriginResults(false);
    }
  }, [originQuery, debouncedOriginSearch]);

  // Handle destination query change
  useEffect(() => {
    if (destinationQuery) {
      setShowDestinationResults(true);
      debouncedDestinationSearch(destinationQuery);
    } else {
      setDestinationResults([]);
      setShowDestinationResults(false);
    }
  }, [destinationQuery, debouncedDestinationSearch]);

  // Format date for display
  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Select date';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Format date for API (YYYY-MM-DD)
  const formatDateForAPI = (dateString) => {
    if (!dateString) return null;
    return dateString.split('T')[0];
  };

  // Handle date selection
  const onDayPress = (day, type) => {
    const selectedDate = day.dateString;
    
    if (type === 'departure') {
      setDepartureDate(selectedDate);
      setShowDepartureCalendar(false);
      
      // If return date is before new departure date, clear it
      if (returnDate && selectedDate > returnDate) {
        setReturnDate(null);
      }
    } else if (type === 'return') {
      if (!departureDate || selectedDate >= departureDate) {
        setReturnDate(selectedDate);
        setShowReturnCalendar(false);
      } else {
        Alert.alert('Invalid Date', 'Return date must be after departure date');
      }
    }
  };

  // Handle airport selection
  const handleOriginSelect = (airport) => {
    setOrigin(airport);
    setOriginQuery(`${airport.code} - ${airport.name}`);
    setShowOriginResults(false);
  };

  const handleDestinationSelect = (airport) => {
    setDestination(airport);
    setDestinationQuery(`${airport.code} - ${airport.name}`);
    setShowDestinationResults(false);
  };

  // Handle flight search
  const clearAll = () => {
    setOrigin(null);
    setOriginQuery('');
    setDestination(null);
    setDestinationQuery('');
    setDepartureDate(null);
    setReturnDate(null);
    setIsRoundTrip(false);
    setNonStop(false);
    setAdults(1);
    setShowDepartureCalendar(false);
    setShowReturnCalendar(false);
    setShowOriginResults(false);
    setShowDestinationResults(false);
    setFlightResults([]);
    setHasSearched(false);
  };

  const handleSearch = async () => {
    if (!origin || !destination || !departureDate) {
      Alert.alert('Missing Information', 'Please select origin, destination, and departure date');
      return;
    }

    if (isRoundTrip && !returnDate) {
      Alert.alert('Missing Information', 'Please select a return date for round trip');
      return;
    }

    try {
      setSearching(true);
      setHasSearched(true);
      
      const searchParams = {
        origin: origin.code,
        destination: destination.code,
        departureDate: formatDateForAPI(departureDate),
        returnDate: isRoundTrip ? formatDateForAPI(returnDate) : undefined,
        adults,
        max: 20,
        currency: 'USD',
        nonStop,
      };

      const response = await ApiService.searchFlights(searchParams);
      
      if (response.success && response.data) {
        setFlightResults(response.data);
      } else {
        setFlightResults([]);
        Alert.alert('No Results', 'No flights found for your search criteria');
      }
    } catch (error) {
      console.error('Error searching flights:', error);
      Alert.alert('Error', error.message || 'Failed to search flights. Please try again.');
      setFlightResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Render airport result item - match LocationSearchModal locationResultItem styling
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

  // Get airline logo URL - try multiple CDN sources
  const getAirlineLogoUrl = (airlineCode) => {
    if (!airlineCode) return null;
    const code = airlineCode.toUpperCase();
    
    // Try Google's CDN first (most reliable)
    return `https://www.gstatic.com/flights/airline_logos/70px/${code}.png`;
    
    // Fallback options (if needed):
    // `https://logos.skyscnr.com/images/airlines/favicon/${code}.png`
    // `https://content.skyscnr.com/airline-logos/${code}.png`
  };

  // Get full airline name from code
  const getAirlineName = (airlineCode) => {
    if (!airlineCode) return 'Unknown Airline';
    
    const code = airlineCode.toUpperCase();
    
    // Common airline code to name mapping
    const airlineNames = {
      'AA': 'American Airlines',
      'DL': 'Delta Air Lines',
      'UA': 'United Airlines',
      'WN': 'Southwest Airlines',
      'AS': 'Alaska Airlines',
      'B6': 'JetBlue Airways',
      'F9': 'Frontier Airlines',
      'NK': 'Spirit Airlines',
      'HA': 'Hawaiian Airlines',
      'VS': 'Virgin Atlantic',
      'BA': 'British Airways',
      'AF': 'Air France',
      'LH': 'Lufthansa',
      'KL': 'KLM Royal Dutch Airlines',
      'IB': 'Iberia',
      'AZ': 'Alitalia',
      'LX': 'Swiss International Air Lines',
      'OS': 'Austrian Airlines',
      'SN': 'Brussels Airlines',
      'TP': 'TAP Air Portugal',
      'EI': 'Aer Lingus',
      'FI': 'Icelandair',
      'SK': 'Scandinavian Airlines',
      'AY': 'Finnair',
      'LO': 'LOT Polish Airlines',
      'OK': 'Czech Airlines',
      'TK': 'Turkish Airlines',
      'SU': 'Aeroflot',
      'EK': 'Emirates',
      'QR': 'Qatar Airways',
      'EY': 'Etihad Airways',
      'SV': 'Saudi Arabian Airlines',
      'MS': 'EgyptAir',
      'RJ': 'Royal Jordanian',
      'GF': 'Gulf Air',
      'QF': 'Qantas',
      'NZ': 'Air New Zealand',
      'JL': 'Japan Airlines',
      'NH': 'All Nippon Airways',
      'KE': 'Korean Air',
      'OZ': 'Asiana Airlines',
      'CI': 'China Airlines',
      'BR': 'EVA Air',
      'CX': 'Cathay Pacific',
      'SQ': 'Singapore Airlines',
      'TG': 'Thai Airways',
      'MH': 'Malaysia Airlines',
      'GA': 'Garuda Indonesia',
      'PR': 'Philippine Airlines',
      'VN': 'Vietnam Airlines',
      'CA': 'Air China',
      'MU': 'China Eastern Airlines',
      'CZ': 'China Southern Airlines',
      'AC': 'Air Canada',
      'WS': 'WestJet',
      'AM': 'Aeroméxico',
      'LA': 'LATAM Airlines',
      'AV': 'Avianca',
      'CM': 'Copa Airlines',
      'AR': 'Aerolíneas Argentinas',
      'JJ': 'LATAM Brasil',
      'G3': 'Gol Transportes Aéreos',
      'AD': 'Azul Brazilian Airlines',
      'SA': 'South African Airways',
      'ET': 'Ethiopian Airlines',
      'KQ': 'Kenya Airways',
      'WB': 'RwandAir',
      'UL': 'SriLankan Airlines',
      'AI': 'Air India',
      '9W': 'Jet Airways',
      '6E': 'IndiGo',
      'SG': 'SpiceJet',
    };
    
    return airlineNames[code] || airlineCode;
  };

  // Render flight result item
  const renderFlightResult = ({ item }) => {
    const formatTime = (dateTime) => {
      if (!dateTime) return '';
      // Handle both ISO datetime strings and already-formatted HH:MM
      if (dateTime.includes('T')) {
        // ISO format: extract time part
        const time = dateTime.split('T')[1]?.substring(0, 5);
        return time || '';
      }
      // Already in HH:MM format
      return dateTime.substring(0, 5);
    };

    const formatDuration = (minutes) => {
      if (!minutes) return '';
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    };

    const airlineCode = item.airline?.code;
    const airlineLogoUrl = getAirlineLogoUrl(airlineCode);

    const departureTime = formatTime(item.departure?.time || item.departure?.date);
    const arrivalTime = formatTime(item.arrival?.time || item.arrival?.date);

    // Generate booking URL - use provided URL or construct airline-specific booking page
    const getBookingUrl = () => {
      if (item.bookingUrl) {
        return item.bookingUrl;
      }
      
      const origin = item.origin?.code || item.departure?.airport;
      const destination = item.destination?.code || item.arrival?.airport;
      const date = item.departure?.date?.split('T')[0] || item.departure?.date;
      const airlineCode = item.airline?.code;
      
      if (!origin || !destination || !date) {
        return null;
      }
      
      // Try to construct airline-specific booking URLs for major airlines
      // Note: Deep linking support varies by airline and may change over time
      // These URLs attempt to pre-fill search parameters where supported
      const airlineBookingUrls = {
        // US Airlines - generally good deep linking support
        'AA': `https://www.aa.com/booking/find-flights?searchType=roundTrip&segments[0].origin=${origin}&segments[0].destination=${destination}&segments[0].departureDate=${date}`,
        'DL': `https://www.delta.com/flight-search/search?originCity=${origin}&destinationCity=${destination}&departureDate=${date}`,
        'UA': `https://www.united.com/en/us/flight-search/book-a-flight/results/roundtrip/${origin}/${destination}/${date}`,
        'WN': `https://www.southwest.com/air/booking/select.html?adultPassengersCount=1&departureDate=${date}&departureTimeOfDay=ALL_DAY&destinationAirportCode=${destination}&fareType=USD&originationAirportCode=${origin}&passengerType=ADULT&returnDate=&returnTimeOfDay=ALL_DAY&tripType=oneway`,
        'B6': `https://www.jetblue.com/booking/flights?from=${origin}&to=${destination}&depart=${date}`,
        'AS': `https://www.alaskaair.com/booking/flight/search?origin=${origin}&destination=${destination}&departureDate=${date}`,
        
        // European Airlines - mixed support
        'VS': `https://www.virgin-atlantic.com/us/en/flight-search.html?origin=${origin}&destination=${destination}&departureDate=${date}`,
        'BA': `https://www.britishairways.com/travel/home/public/en_us/#/search?origin=${origin}&destination=${destination}&departureDate=${date}`,
        'AF': `https://wwws.airfrance.us/search/flight?departureDate=${date}&departureLocation=${origin}&arrivalLocation=${destination}`,
        'LH': `https://www.lufthansa.com/us/en/flight-search?origin=${origin}&destination=${destination}&departureDate=${date}`,
        'KL': `https://www.klm.com/en/us/search/flights?origin=${origin}&destination=${destination}&departureDate=${date}`,
        
        // Middle Eastern Airlines - good support
        'EK': `https://www.emirates.com/us/english/plan-book/flight-search/?departureDate=${date}&departureAirport=${origin}&arrivalAirport=${destination}`,
        'QR': `https://www.qatarairways.com/en-us/search-results.html?departureDate=${date}&from=${origin}&to=${destination}`,
        'EY': `https://www.etihad.com/en-us/book/flight?departureDate=${date}&from=${origin}&to=${destination}`,
        
        // Asia Pacific - limited deep linking
        'QF': `https://www.qantas.com/us/en/flight-search.html?departureDate=${date}&origin=${origin}&destination=${destination}`,
        'JL': `https://www.jal.co.jp/en/en/`,
        'NH': `https://www.ana.co.jp/en/us/`,
        'SQ': `https://www.singaporeair.com/en_US/us/home#/book/bookflight`,
        'CX': `https://www.cathaypacific.com/cx/en_US/flights.html`,
        
        // Canadian Airlines
        'AC': `https://www.aircanada.com/ca/en/aco/home.html#/faredriven`,
        'WS': `https://www.westjet.com/en-us/flights`,
      };
      
      // If we have a specific airline booking URL, use it
      if (airlineCode && airlineBookingUrls[airlineCode.toUpperCase()]) {
        return airlineBookingUrls[airlineCode.toUpperCase()];
      }
      
      // Fallback to Google Flights with specific flight details in search
      const airlineName = getAirlineName(airlineCode);
      const query = encodeURIComponent(`${airlineName} ${origin} to ${destination} ${date}`);
      return `https://www.google.com/travel/flights?q=${query}`;
    };

    const handleFlightPress = async () => {
      const bookingUrl = getBookingUrl();
      
      if (bookingUrl) {
        try {
          const canOpen = await Linking.canOpenURL(bookingUrl);
          if (canOpen) {
            await Linking.openURL(bookingUrl);
          } else {
            Alert.alert('Error', 'Unable to open booking link');
          }
        } catch (error) {
          console.error('Error opening booking URL:', error);
          Alert.alert('Error', 'Failed to open booking link');
        }
      } else {
        Alert.alert(
          'Booking Unavailable',
          'Direct booking is not available for this flight. Please visit the airline\'s website to book.',
          [{ text: 'OK' }]
        );
      }
    };

    return (
      <TouchableOpacity 
        style={styles.flightResultCard}
        onPress={handleFlightPress}
        activeOpacity={0.7}
      >
        <View style={styles.flightResultHeader}>
          <View style={styles.flightPrice}>
            <Text style={styles.flightPriceAmount}>{item.price?.formatted || `$${item.price?.amount || 0}`}</Text>
          </View>
          <View style={styles.flightStops}>
            <Text style={styles.flightStopsText}>
              {item.stops === 0 ? 'Nonstop' : `${item.stops} stop${item.stops > 1 ? 's' : ''}`}
            </Text>
          </View>
        </View>
        
        <View style={styles.flightRoute}>
          <View style={styles.flightSegment}>
            <Text style={styles.flightTime}>{departureTime || '--:--'}</Text>
            <Text style={styles.flightAirport}>{item.departure?.airport || 'N/A'}</Text>
          </View>
          
          <View style={styles.flightDuration}>
            <View style={styles.flightDurationLine} />
            <Text style={styles.flightDurationText}>{formatDuration(item.duration)}</Text>
          </View>
          
          <View style={styles.flightSegment}>
            <Text style={styles.flightTime}>{arrivalTime || '--:--'}</Text>
            <Text style={styles.flightAirport}>{item.arrival?.airport || 'N/A'}</Text>
          </View>
        </View>
        
        {item.airline && (
          <View style={styles.flightAirlineContainer}>
            {airlineLogoUrl && (
              <Image
                source={{ uri: airlineLogoUrl }}
                style={styles.flightAirlineLogo}
                resizeMode="contain"
              />
            )}
            <Text style={styles.flightAirline}>
              {getAirlineName(item.airline?.code || item.airline?.name)}
            </Text>
          </View>
        )}
        
        {/* Booking indicator */}
        <View style={styles.bookingIndicator}>
          <MaterialIcons name="open-in-new" size={16} color={colors.text.secondary} />
          <Text style={styles.bookingText}>Tap to book</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
      style={styles.keyboardAvoidingView}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.form}>
          {/* Origin */}
          <View style={styles.section}>
            <View style={styles.searchInputContainer}>
              <MaterialIcons name="flight-takeoff" size={25} color="rgba(0, 0, 0, 0.5)" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search origin airport"
                placeholderTextColor="rgba(0, 0, 0, 0.5)"
                value={originQuery}
                onChangeText={setOriginQuery}
                onFocus={() => setShowOriginResults(true)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {originQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setOriginQuery('');
                    setShowOriginResults(false);
                    setOriginResults([]);
                    setOrigin(null);
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
          <View style={styles.section}>
            <View style={styles.searchInputContainer}>
              <MaterialIcons name="flight-land" size={25} color="rgba(0, 0, 0, 0.5)" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search destination airport"
                placeholderTextColor="rgba(0, 0, 0, 0.5)"
                value={destinationQuery}
                onChangeText={setDestinationQuery}
                onFocus={() => setShowDestinationResults(true)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {destinationQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setDestinationQuery('');
                    setShowDestinationResults(false);
                    setDestinationResults([]);
                    setDestination(null);
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

          {/* Round Trip Toggle */}
          <View style={styles.section}>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Round Trip</Text>
              <Switch
                value={isRoundTrip}
                onValueChange={setIsRoundTrip}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>
          </View>

          {/* Departure Date */}
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardHeader}
              onPress={() => {
                setShowDepartureCalendar(!showDepartureCalendar);
                setShowReturnCalendar(false);
              }}
              activeOpacity={0.7}
              accessibilityLabel={departureDate 
                ? `Departure date: ${formatDisplayDate(departureDate)}`
                : 'Select departure date'}
              accessibilityRole="button"
            >
              <View>
                <Text style={styles.cardLabel}>Departure</Text>
                <Text style={styles.cardValue}>
                  {departureDate ? formatDisplayDate(departureDate) : 'Add date'}
                </Text>
              </View>
              <MaterialIcons
                name={showDepartureCalendar ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>
            {showDepartureCalendar && (
              <View style={styles.calendarContainer}>
                <Calendar
                  onDayPress={(day) => onDayPress(day, 'departure')}
                  markedDates={departureDate ? {
                    [departureDate]: { selected: true, selectedColor: colors.primary }
                  } : {}}
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

          {/* Return Date (if round trip) */}
          {isRoundTrip && (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => {
                  setShowReturnCalendar(!showReturnCalendar);
                  setShowDepartureCalendar(false);
                }}
                activeOpacity={0.7}
                accessibilityLabel={returnDate 
                  ? `Return date: ${formatDisplayDate(returnDate)}`
                  : 'Select return date'}
                accessibilityRole="button"
              >
                <View>
                  <Text style={styles.cardLabel}>Return</Text>
                  <Text style={styles.cardValue}>
                    {returnDate ? formatDisplayDate(returnDate) : 'Add date'}
                  </Text>
                </View>
                <MaterialIcons
                  name={showReturnCalendar ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                  size={24}
                  color={colors.text.primary}
                />
              </TouchableOpacity>
              {showReturnCalendar && (
                <View style={styles.calendarContainer}>
                  <Calendar
                    onDayPress={(day) => onDayPress(day, 'return')}
                    markedDates={returnDate ? {
                      [returnDate]: { selected: true, selectedColor: colors.primary }
                    } : {}}
                    minDate={departureDate || new Date().toISOString().split('T')[0]}
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
          )}

          {/* Nonstop Toggle */}
          <View style={styles.section}>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Nonstop flights only</Text>
              <Switch
                value={nonStop}
                onValueChange={setNonStop}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>
          </View>

          {/* Passengers */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Passengers</Text>
            <View style={styles.passengerContainer}>
              <TouchableOpacity
                style={styles.passengerButton}
                onPress={() => setAdults(Math.max(1, adults - 1))}
                disabled={adults <= 1}
              >
                <MaterialIcons name="remove" size={20} color={adults <= 1 ? colors.text.light : colors.primary} />
              </TouchableOpacity>
              <Text style={styles.passengerCount}>{adults}</Text>
              <TouchableOpacity
                style={styles.passengerButton}
                onPress={() => setAdults(adults + 1)}
              >
                <MaterialIcons name="add" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearAll}
              accessibilityLabel="Clear all search filters"
              accessibilityRole="button"
            >
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.enterButton,
                (!origin || !destination || !departureDate || (isRoundTrip && !returnDate) || searching) && styles.enterButtonDisabled
              ]}
              onPress={handleSearch}
              disabled={searching || !origin || !destination || !departureDate || (isRoundTrip && !returnDate)}
              accessibilityLabel="Search for flights"
              accessibilityRole="button"
            >
              {searching ? (
                <ActivityIndicator size="small" color="rgba(0, 0, 0, 0.5)" />
              ) : (
                <Text style={styles.enterButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Flight Results */}
          {hasSearched && (
            <View style={styles.resultsSection}>
              <Text style={styles.resultsTitle}>
                {flightResults.length > 0 
                  ? `${flightResults.length} flight${flightResults.length > 1 ? 's' : ''} found`
                  : 'No flights found'}
              </Text>
              {flightResults.length > 0 && (
                <FlatList
                  data={flightResults}
                  renderItem={renderFlightResult}
                  keyExtractor={(item, index) => item.id || `flight-${index}`}
                  scrollEnabled={false}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  form: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl + spacing.lg,
    gap: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
    color: colors.text.primary,
  },
  // Match LocationSearchModal searchInputContainer exactly
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 49,
    gap: spacing.sm,
  },
  // Match LocationSearchModal searchInput exactly
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    padding: 0,
    margin: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  clearSearchButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  // Match LocationSearchModal locationResultsContainer exactly
  resultsContainer: {
    marginTop: spacing.sm,
    maxHeight: 200,
  },
  loadingContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  // Match LocationSearchModal locationResultItem exactly
  airportResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.card,
    gap: spacing.xl + spacing.sm, // 36px gap from Figma
  },
  airportResultText: {
    flex: 1,
    gap: 7, // 7px gap from Figma
  },
  airportCode: {
    ...typography.caption,
    color: colors.text.primary,
  },
  airportName: {
    ...typography.caption,
    color: colors.text.primary,
  },
  airportCity: {
    ...typography.caption,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  locationEmptyContainer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  locationEmptyText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleLabel: {
    ...typography.body,
    color: colors.text.primary,
  },
  // Match LocationSearchModal card styling exactly
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: borderRadius.card, // 14px from design tokens
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  cardLabel: {
    ...typography.caption,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  cardValue: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  // Match LocationSearchModal calendarContainer exactly
  calendarContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  passengerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerButton: {
    padding: spacing.sm,
  },
  passengerCount: {
    ...typography.h3,
    marginHorizontal: spacing.lg,
    color: colors.text.primary,
  },
  // Match LocationSearchModal actionButtons exactly
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg + spacing.xs + 7, // 55px from Figma
    paddingBottom: spacing.lg,
    gap: spacing.sm + spacing.xs,
  },
  clearButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 49,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    maxWidth: 160,
  },
  clearButtonText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.text.primary,
  },
  enterButton: {
    backgroundColor: '#B2E4CC', // Light green from Figma
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 49,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    maxWidth: 160,
  },
  enterButtonDisabled: {
    opacity: 0.5,
  },
  enterButtonText: {
    ...typography.caption,
    fontWeight: '700',
    color: 'rgba(0, 0, 0, 0.5)',
  },
  resultsSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resultsTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
    color: colors.text.primary,
  },
  flightResultCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  flightResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  flightPrice: {
    flex: 1,
  },
  flightPriceAmount: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.text.primary,
  },
  flightStops: {
    backgroundColor: colors.cardGrey,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.xs,
  },
  flightStopsText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  flightRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  flightSegment: {
    flex: 1,
  },
  flightTime: {
    ...typography.h3,
    fontWeight: '600',
    color: colors.text.primary,
  },
  flightAirport: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  flightDuration: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.sm,
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
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  flightAirlineLogo: {
    width: 32,
    height: 32,
    backgroundColor: 'transparent',
  },
  flightAirline: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  bookingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  bookingText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
  },
});

export default FlightSearchTab;

