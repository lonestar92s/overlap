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
} from 'react-native';

const PopularMatchModal = ({ 
  visible, 
  matches, 
  currentMatchIndex, 
  onClose, 
  onNavigate 
}) => {
  const currentMatch = matches[currentMatchIndex];
  const totalMatches = matches.length;

  const formatMatchDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const canNavigateLeft = currentMatchIndex > 0;
  const canNavigateRight = currentMatchIndex < totalMatches - 1;

  if (!currentMatch) {
    return null;
  }

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
          {/* Venue Image */}
          <View style={styles.venueImageContainer}>
            {currentMatch.fixture.venue.image ? (
              <Image 
                source={{ uri: currentMatch.fixture.venue.image }} 
                style={styles.venueImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.venueImagePlaceholder}>
                <Text style={styles.venueImagePlaceholderText}>🏟️</Text>
              </View>
            )}
          </View>

          {/* Match Info */}
          <View style={styles.matchInfo}>
            {/* Teams */}
            <View style={styles.teamsContainer}>
              <View style={styles.teamSection}>
                <Image 
                  source={{ uri: currentMatch.teams.home.logo }} 
                  style={styles.teamLogo}
                  resizeMode="contain"
                />
                <Text style={styles.teamName}>{currentMatch.teams.home.name}</Text>
              </View>
              
              <View style={styles.vsContainer}>
                <Text style={styles.vsText}>VS</Text>
              </View>
              
              <View style={styles.teamSection}>
                <Image 
                  source={{ uri: currentMatch.teams.away.logo }} 
                  style={styles.teamLogo}
                  resizeMode="contain"
                />
                <Text style={styles.teamName}>{currentMatch.teams.away.name}</Text>
              </View>
            </View>

            {/* Date & Time */}
            <View style={styles.dateTimeContainer}>
              <Text style={styles.dateTimeLabel}>Date & Time</Text>
              <Text style={styles.dateTimeText}>
                {formatMatchDate(currentMatch.fixture.date)}
              </Text>
              <Text style={styles.timeText}>
                Kickoff: {formatTime(currentMatch.fixture.date)}
              </Text>
            </View>

            {/* Venue */}
            <View style={styles.venueContainer}>
              <Text style={styles.venueLabel}>Venue</Text>
              <Text style={styles.venueName}>{currentMatch.fixture.venue.name}</Text>
              <Text style={styles.venueLocation}>
                {currentMatch.fixture.venue.city}, {currentMatch.fixture.venue.country}
              </Text>
            </View>

            {/* League */}
            <View style={styles.leagueContainer}>
              <Text style={styles.leagueLabel}>Competition</Text>
              <View style={styles.leagueInfo}>
                <Image 
                  source={{ uri: currentMatch.league.logo }} 
                  style={styles.leagueLogo}
                  resizeMode="contain"
                />
                <Text style={styles.leagueName}>{currentMatch.league.name}</Text>
              </View>
            </View>

            {/* Match Status */}
            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={styles.statusText}>{currentMatch.fixture.status.long}</Text>
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
  venueImageContainer: {
    height: 200,
    overflow: 'hidden',
  },
  venueImage: {
    width: '100%',
    height: '100%',
  },
  venueImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  venueImagePlaceholderText: {
    fontSize: 48,
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