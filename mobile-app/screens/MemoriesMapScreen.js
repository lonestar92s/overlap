import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import ApiService from '../services/api';
import { colors, spacing, typography, borderRadius, shadows, iconSizes } from '../styles/designTokens';

const toLatLng = (coordinates) => {
  if (!coordinates) return null;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }
  if (typeof coordinates === 'object') {
    const lat = Number(coordinates.lat ?? coordinates.latitude);
    const lng = Number(coordinates.lng ?? coordinates.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
};

const regionFromPoints = (points) => {
  if (!points.length) return null;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 2.5, 0.2),
    longitudeDelta: Math.max((maxLng - minLng) * 2.5, 0.2),
  };
};

/**
 * Map of memories or visited stadiums.
 * route.params.mode: 'memories' (default) | 'stadiums'
 */
const MemoriesMapScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const mode = route.params?.mode === 'stadiums' ? 'stadiums' : 'memories';
  const isStadiums = mode === 'stadiums';

  const [loading, setLoading] = useState(true);
  const [mapRegion, setMapRegion] = useState(null);
  const [memories, setMemories] = useState([]);
  const [stadiums, setStadiums] = useState([]);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [selectedStadium, setSelectedStadium] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ApiService.getMemories();
      if (!response.success) return;

      if (isStadiums) {
        const withCoords = (response.visitedStadiums || [])
          .map((s) => ({ ...s, latLng: toLatLng(s.coordinates) }))
          .filter((s) => s.latLng);
        setStadiums(withCoords);
        setMapRegion(regionFromPoints(withCoords.map((s) => s.latLng)));
      } else {
        const withCoords = (response.data || [])
          .map((memory) => {
            const venueCoords = toLatLng(memory.venue?.coordinates);
            const photoCoords = toLatLng(
              memory.photos?.find((p) => p.coordinates)?.coordinates
            );
            const latLng = venueCoords || photoCoords;
            return latLng ? { ...memory, latLng } : null;
          })
          .filter(Boolean);
        setMemories(withCoords);
        setMapRegion(regionFromPoints(withCoords.map((m) => m.latLng)));
      }
    } catch (error) {
      console.error('Error loading map data:', error);
      Alert.alert('Error', 'Failed to load map');
    } finally {
      setLoading(false);
    }
  }, [isStadiums]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pinCount = isStadiums ? stadiums.length : memories.length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {isStadiums ? 'Loading stadiums…' : 'Loading memories…'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <MaterialIcons name="arrow-back" size={iconSizes.md} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isStadiums ? 'Visited Stadiums' : 'Memories Map'}
        </Text>
        <View style={styles.headerButton} />
      </View>

      <MapView
        style={styles.map}
        region={mapRegion || undefined}
        initialRegion={
          mapRegion || {
            latitude: 51.5074,
            longitude: -0.1278,
            latitudeDelta: 10,
            longitudeDelta: 10,
          }
        }
        onRegionChangeComplete={setMapRegion}
        showsUserLocation
        showsMyLocationButton
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      >
        {isStadiums
          ? stadiums.map((stadium, index) => (
              <Marker
                key={`stadium-${stadium.venueName}-${stadium.city}-${index}`}
                coordinate={stadium.latLng}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedStadium(stadium);
                  setSelectedMemory(null);
                }}
                title={stadium.venueName}
                description={[stadium.city, stadium.country].filter(Boolean).join(', ')}
              >
                <View style={styles.markerContainer}>
                  <MaterialIcons name="stadium" size={22} color={colors.primary} />
                </View>
              </Marker>
            ))
          : memories.map((memory, index) => (
              <Marker
                key={`memory-${memory._id || memory.matchId}-${index}`}
                coordinate={memory.latLng}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedMemory(memory);
                  setSelectedStadium(null);
                }}
              >
                <View style={styles.markerContainer}>
                  <MaterialIcons name="sports-soccer" size={22} color={colors.primary} />
                </View>
              </Marker>
            ))}
      </MapView>

      {selectedStadium && (
        <View style={styles.cardOverlay}>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardClose}
              onPress={() => setSelectedStadium(null)}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <MaterialIcons name="close" size={iconSizes.md} color={colors.text.secondary} />
            </TouchableOpacity>
            <MaterialIcons name="stadium" size={32} color={colors.primary} />
            <Text style={styles.cardTitle}>{selectedStadium.venueName}</Text>
            <Text style={styles.cardSubtitle}>
              {[selectedStadium.city, selectedStadium.country].filter(Boolean).join(', ') || '—'}
            </Text>
            <Text style={styles.cardMeta}>
              {selectedStadium.visitCount} visit{selectedStadium.visitCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      )}

      {selectedMemory && (
        <View style={styles.cardOverlay}>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardClose}
              onPress={() => setSelectedMemory(null)}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <MaterialIcons name="close" size={iconSizes.md} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.cardTitle}>
              {selectedMemory.homeTeam?.name || 'Unknown'} vs {selectedMemory.awayTeam?.name || 'Unknown'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {selectedMemory.venue?.name || 'Unknown venue'}
            </Text>
            <Text style={styles.cardMeta}>
              {selectedMemory.date
                ? new Date(selectedMemory.date).toLocaleDateString()
                : ''}
              {selectedMemory.competition ? ` · ${selectedMemory.competition}` : ''}
            </Text>
            {(selectedMemory.userScore || selectedMemory.apiMatchData?.officialScore) && (
              <Text style={styles.cardScore}>
                {selectedMemory.apiMatchData?.officialScore || selectedMemory.userScore}
              </Text>
            )}
          </View>
        </View>
      )}

      {pinCount === 0 && (
        <View style={styles.emptyState}>
          <MaterialIcons
            name={isStadiums ? 'stadium' : 'map'}
            size={72}
            color={colors.text.light}
          />
          <Text style={styles.emptyTitle}>
            {isStadiums ? 'No stadiums on the map yet' : 'No memories on the map yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {isStadiums
              ? 'Pick a stadium from search when adding a memory (or add a photo with GPS) to place it here.'
              : 'Add memories with a known stadium or a photo with location to see them here.'}
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('AddMemory')}
            accessibilityRole="button"
          >
            <Text style={styles.emptyButtonText}>Add Memory</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.text.primary,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: spacing.sm,
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadows.small,
  },
  cardOverlay: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.medium,
  },
  cardClose: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    padding: spacing.xs,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  cardSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  cardMeta: {
    ...typography.bodySmall,
    color: colors.text.light,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  cardScore: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
    marginTop: spacing.sm,
  },
  emptyState: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  emptyButtonText: {
    ...typography.button,
    color: colors.onPrimary,
  },
});

export default MemoriesMapScreen;
