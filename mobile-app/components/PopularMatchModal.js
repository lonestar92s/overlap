import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const PopularMatchModal = ({ 
  visible, 
  matches, 
  currentMatchIndex, 
  onClose, 
  onNavigate 
}) => {
  // Debug logging to help troubleshoot data structure issues
  // console.log('PopularMatchModal received props:', {
  //   visible,
  //   matchesLength: matches?.length,
  //   currentMatchIndex,
  //   currentMatch: matches?.[currentMatchIndex]
  // });

  const currentMatch = matches?.[currentMatchIndex];
  const totalMatches = matches?.length || 0;

  // Add defensive programming to prevent rendering errors
  if (!visible) {
    return null;
  }

  if (!currentMatch || !Array.isArray(matches) || matches.length === 0) {
    console.log('PopularMatchModal: No valid data, returning null');
    return null;
  }

  // Additional safety check for required props
  if (typeof onClose !== 'function' || typeof onNavigate !== 'function') {
    console.log('PopularMatchModal: Missing required props, returning null');
    return null;
  }

  // Safely extract nested properties with fallbacks
  const fixture = currentMatch?.fixture || {};
  const teams = currentMatch?.teams || {};
  const league = currentMatch?.league || {};
  const venue = fixture?.venue || {};

  const formatMatchDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date TBD';
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Date TBD';
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'Time TBD';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Time TBD';
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      return 'Time TBD';
    }
  };

  const canNavigateLeft = currentMatchIndex > 0;
  const canNavigateRight = currentMatchIndex < totalMatches - 1;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Match Details</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Venue Map */}
          <View style={styles.venueMapContainer}>
            {venue.coordinates && venue.coordinates.length === 2 ? (
              <MapView
                style={styles.venueMap}
                provider={Platform.OS === 'ios' ? MapView.PROVIDER_DEFAULT : MapView.PROVIDER_GOOGLE}
                region={{
                  latitude: venue.coordinates[1], // latitude
                  longitude: venue.coordinates[0], // longitude
                  latitudeDelta: 0.01, // Small delta for close-up view
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                showsScale={false}
                showsBuildings={true}
                showsPointsOfInterest={true}
              >
                <Marker
                  coordinate={{
                    latitude: venue.coordinates[1],
                    longitude: venue.coordinates[0],
                  }}
                  title={venue.name || 'Stadium'}
                  description={venue.city || 'Match Venue'}
                  pinColor="#1976d2"
                />
              </MapView>
            ) : (
              <View style={styles.venueMapPlaceholder}>
                <Text style={styles.venueMapPlaceholderText}>🏟️</Text>
                <Text style={styles.venueMapPlaceholderSubtext}>Location not available</Text>
              </View>
            )}
          </View>

          {/* Match Info */}
          <View style={styles.matchInfo}>
            {/* Teams */}
            <View style={styles.teamsContainer}>
              <View style={styles.teamSection}>
                {teams.home?.logo ? (
                  <Image 
                    source={{ uri: teams.home.logo }} 
                    style={styles.teamLogo}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.teamLogo, { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 24 }}>⚽</Text>
                  </View>
                )}
                <Text style={styles.teamName}>{teams.home?.name || 'TBD'}</Text>
              </View>
              
              <View style={styles.vsContainer}>
                <Text style={styles.vsText}>VS</Text>
              </View>
              
              <View style={styles.teamSection}>
                {teams.away?.logo ? (
                  <Image 
                    source={{ uri: teams.away.logo }} 
                    style={styles.teamLogo}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.teamLogo, { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 24 }}>⚽</Text>
                  </View>
                )}
                <Text style={styles.teamName}>{teams.away?.name || 'TBD'}</Text>
              </View>
            </View>

            {/* Date & Time */}
            <View style={styles.dateTimeContainer}>
              <Text style={styles.dateTimeLabel}>Date & Time</Text>
              <Text style={styles.dateTimeText}>
                {formatMatchDate(fixture.date)}
              </Text>
              <Text style={styles.timeText}>
                Kickoff: {formatTime(fixture.date)}
              </Text>
            </View>

            {/* Venue */}
            <View style={styles.venueContainer}>
              <Text style={styles.venueLabel}>Venue</Text>
              <Text style={styles.venueName}>{venue.name || 'Venue TBD'}</Text>
              <Text style={styles.venueLocation}>
                {venue.city || 'City TBD'}{venue.city && venue.country ? ', ' : ''}{venue.country || ''}
              </Text>
            </View>

            {/* League */}
            <View style={styles.leagueContainer}>
              <Text style={styles.leagueLabel}>Competition</Text>
              <View style={styles.leagueInfo}>
                {league.logo ? (
                  <Image 
                    source={{ uri: league.logo }} 
                    style={styles.leagueLogo}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.leagueLogo, { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 12 }}>🏆</Text>
                  </View>
                )}
                <Text style={styles.leagueName}>{league.name || 'Unknown Competition'}</Text>
              </View>
            </View>

            {/* Status */}
            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={styles.statusText}>{fixture.status?.long || 'Status TBD'}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Navigation Footer */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.navButton, !canNavigateLeft && styles.navButtonDisabled]}
            onPress={() => canNavigateLeft && onNavigate(currentMatchIndex - 1)}
            disabled={!canNavigateLeft}
          >
            <Text style={[styles.navButtonText, !canNavigateLeft && styles.navButtonTextDisabled]}>
              ← Previous
            </Text>
          </TouchableOpacity>

          <Text style={styles.matchCounter}>
            {currentMatchIndex + 1} of {totalMatches}
          </Text>

          <TouchableOpacity 
            style={[styles.navButton, !canNavigateRight && styles.navButtonDisabled]}
            onPress={() => canNavigateRight && onNavigate(currentMatchIndex + 1)}
            disabled={!canNavigateRight}
          >
            <Text style={[styles.navButtonText, !canNavigateRight && styles.navButtonTextDisabled]}>
              Next →
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  venueMapContainer: {
    height: 200,
    overflow: 'hidden',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
  },
  venueMap: {
    width: '100%',
    height: '100%',
  },
  venueMapPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  venueMapPlaceholderText: {
    fontSize: 48,
    marginBottom: 8,
  },
  venueMapPlaceholderSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  matchInfo: {
    padding: 20,
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  teamSection: {
    alignItems: 'center',
    flex: 1,
  },
  teamLogo: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1a1a1a',
  },
  vsContainer: {
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1976d2',
  },
  dateTimeContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  dateTimeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  venueContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  venueLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  venueLocation: {
    fontSize: 14,
    color: '#666',
  },
  leagueContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  leagueLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  leagueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leagueLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  leagueName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  statusContainer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1976d2',
  },
  navButtonDisabled: {
    backgroundColor: '#f5f5f5',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  navButtonTextDisabled: {
    color: '#999',
  },
  matchCounter: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});

export default PopularMatchModal;
 