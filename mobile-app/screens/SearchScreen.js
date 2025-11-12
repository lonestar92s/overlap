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
import PopularMatches from '../components/PopularMatches';
import LocationSearchModal from '../components/LocationSearchModal';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

// Popular destinations data (reused from SearchScreen.old.js)
const popularDestinations = [
  { 
    id: '1', 
    city: 'Madrid',
    country: 'Spain',
    image: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400&h=300&fit=crop'
  },
  { 
    id: '2', 
    city: 'Rome',
    country: 'Italy', 
    image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop'
  },
  { 
    id: '3', 
    city: 'Berlin',
    country: 'Germany',
    image: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=400&h=300&fit=crop'
  },
  { 
    id: '4', 
    city: 'Milan',
    country: 'Italy',
    image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&h=300&fit=crop'
  },
  { 
    id: '5', 
    city: 'Dortmund',
    country: 'Germany',
    image: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=400&h=300&fit=crop'
  },
];

const SearchScreen = ({ navigation }) => {
  const [showLocationSearchModal, setShowLocationSearchModal] = useState(false);

  const renderDestinationCard = ({ item }) => (
    <TouchableOpacity style={styles.destinationCard}>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hi Nico</Text>
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
        onClose={() => setShowLocationSearchModal(false)}
        navigation={navigation}
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
