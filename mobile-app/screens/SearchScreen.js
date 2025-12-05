import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import PopularMatches from '../components/PopularMatches';
import LocationSearchModal from '../components/LocationSearchModal';
import TripCountdownWidget from '../components/TripCountdownWidget';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

// Popular destinations data
const popularDestinations = [
  { 
    id: '1', 
    city: 'Madrid',
    country: 'Spain',
    lat: 40.4168,
    lon: -3.7038,
    image: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400&h=300&fit=crop'
  },
  { 
    id: '2', 
    city: 'Rome',
    country: 'Italy',
    lat: 41.9028,
    lon: 12.4964,
    image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop'
  },
  { 
    id: '3', 
    city: 'Berlin',
    country: 'Germany',
    lat: 52.5200,
    lon: 13.4050,
    image: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=400&h=300&fit=crop'
  },
  { 
    id: '4', 
    city: 'Milan',
    country: 'Italy',
    lat: 45.4642,
    lon: 9.1900,
    image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop'
  },
  { 
    id: '5', 
    city: 'Dortmund',
    country: 'Germany',
    lat: 51.5136,
    lon: 7.4653,
    image: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=400&h=300&fit=crop'
  },
];

const SearchScreen = ({ navigation }) => {
  const [showLocationSearchModal, setShowLocationSearchModal] = useState(false);
  const [initialLocation, setInitialLocation] = useState(null);

  const handleDestinationPress = (destination) => {
    // Convert destination to location object format expected by LocationSearchModal
    const location = {
      city: destination.city,
      country: destination.country,
      lat: destination.lat,
      lon: destination.lon,
      place_id: `${destination.city.toLowerCase()}-${destination.country.toLowerCase()}`,
    };
    setInitialLocation(location);
    setShowLocationSearchModal(true);
  };

  const handleModalClose = () => {
    setShowLocationSearchModal(false);
    // Clear initial location after a brief delay to allow modal to process it
    setTimeout(() => {
      setInitialLocation(null);
    }, 100);
  };

  const renderDestinationCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.destinationCard}
      onPress={() => handleDestinationPress(item)}
      activeOpacity={0.7}
    >
      <Image 
        source={{ uri: item.image }} 
        style={styles.cardImage}
        resizeMode="cover"
      />
      <View style={styles.cardContent}>
        <Text style={styles.cardCity}>{item.city}</Text>
        <Text style={styles.cardCountry}>{item.country}</Text>
      </View>
    </TouchableOpacity>
  );

  const handleMatchPress = (match) => {
    console.log('Match pressed:', match);
  };

  const handleTripPress = (trip) => {
    // Navigate to trip overview screen in TripsTab, ensuring TripsList is in the stack
    // so the back button goes to TripsList instead of SearchScreen
    // First navigate to TripsTab (which shows TripsList by default)
    navigation.navigate('TripsTab');
    // Then use requestAnimationFrame to ensure the tab switch completes
    // before navigating to TripOverview, which will push it on top of TripsList
    requestAnimationFrame(() => {
      navigation.navigate('TripsTab', {
        screen: 'TripOverview',
        params: { itineraryId: trip.id || trip._id }
      });
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.startLapButton}
          onPress={() => setShowLocationSearchModal(true)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="search" size={25} color="rgba(0, 0, 0, 0.5)" />
          <Text style={styles.startLapButtonText}>Start your lap</Text>
        </TouchableOpacity>

        <TripCountdownWidget onTripPress={handleTripPress} />

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

        <View style={styles.section}>
          <PopularMatches 
            onMatchPress={handleMatchPress}
          />
        </View>
      </ScrollView>

      <LocationSearchModal
        visible={showLocationSearchModal}
        onClose={handleModalClose}
        navigation={navigation}
        initialLocation={initialLocation}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  startLapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    height: 49,
    gap: spacing.sm,
  },
  startLapButtonText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h2,
    fontWeight: '600',
    marginBottom: spacing.md,
    marginLeft: spacing.lg,
    color: colors.text.primary,
  },
  horizontalList: {
    paddingHorizontal: spacing.lg,
  },
  destinationCard: {
    width: 150,
    marginRight: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardImage: {
    width: '100%',
    height: 120,
  },
  cardContent: {
    padding: spacing.md,
  },
  cardCity: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  cardCountry: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});

export default SearchScreen;
