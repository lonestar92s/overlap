// Profile Screen Wireframe - Wanderlog Pattern
// This is a code-based wireframe following the Wanderlog design pattern
// Uses designTokens.js for consistent styling

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows, iconSizes } from '../styles/designTokens';
import { useAuth } from '../contexts/AuthContext';
import { useItineraries } from '../contexts/ItineraryContext';

const ProfileScreenWireframe = ({ navigation }) => {
  const { user } = useAuth();
  const { itineraries } = useItineraries();
  const [activeTab, setActiveTab] = useState('trips');

  // Extract username from email for display
  const username = user?.email?.split('@')[0] || 'user';
  const displayName = user?.name || user?.email?.split('@')[0] || 'User Name';

  const tabs = [
    { id: 'trips', label: 'Trips' },
    { id: 'memories', label: 'Memories' },
    { id: 'attended', label: 'Attended' },
  ];

  const renderProfileHeader = () => (
    <View style={styles.profileHeader}>
      {/* Avatar with edit icon */}
      <TouchableOpacity 
        style={styles.avatarContainer}
        onPress={() => {/* Handle avatar edit */}}
        accessibilityLabel="Edit profile picture"
        accessibilityRole="button"
      >
        <View style={styles.avatar}>
          <MaterialIcons name="account-circle" size={80} color={colors.text.light} />
        </View>
        <View style={styles.editIconContainer}>
          <MaterialIcons name="edit" size={iconSizes.sm} color={colors.text.primary} />
        </View>
      </TouchableOpacity>

      {/* User Info */}
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{displayName}</Text>
        <Text style={styles.userHandle}>@{username}</Text>
      </View>

      {/* Top Right Actions */}
      <View style={styles.headerActions}>
        <TouchableOpacity 
          style={styles.moreButton}
          onPress={() => {/* Handle more options */}}
          accessibilityLabel="More options"
          accessibilityRole="button"
        >
          <MaterialIcons name="more-horiz" size={iconSizes.md} color={colors.text.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.shareButton}
          onPress={() => {/* Handle share */}}
          accessibilityLabel="Share profile"
          accessibilityRole="button"
        >
          <MaterialIcons name="arrow-forward" size={iconSizes.sm} color={colors.text.primary} />
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
            accessibilityLabel={`View ${tab.label}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.id }}
          >
            <Text style={[
              styles.tabText,
              activeTab === tab.id && styles.activeTabText
            ]}>
              {tab.label}
            </Text>
            {activeTab === tab.id && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity 
        style={styles.sortButton}
        onPress={() => {/* Handle sort */}}
        accessibilityLabel="Sort content"
        accessibilityRole="button"
      >
        <MaterialIcons 
          name="swap-vert" 
          size={iconSizes.sm} 
          color={colors.text.secondary} 
        />
        <Text style={styles.sortButtonText}>Sort</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTripCard = (trip, index) => {
    const matchCount = trip.matches?.length || 0;
    const firstMatch = trip.matches?.[0];
    const startDate = trip.startDate ? new Date(trip.startDate) : null;
    const endDate = trip.endDate ? new Date(trip.endDate) : null;
    
    // Format date range
    let dateRange = 'Dates TBD';
    if (startDate && endDate) {
      const start = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateRange = `${start} – ${end}`;
    }

    return (
      <TouchableOpacity
        key={trip.id || index}
        style={styles.tripCard}
        onPress={() => navigation.navigate('TripOverview', { tripId: trip.id })}
        accessibilityLabel={`Trip to ${trip.destination || trip.name}`}
        accessibilityRole="button"
      >
        {/* Trip Image/Thumbnail */}
        <View style={styles.tripImageContainer}>
          {firstMatch?.fixture?.venue?.image ? (
            <Image 
              source={{ uri: firstMatch.fixture.venue.image }} 
              style={styles.tripImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.tripImagePlaceholder}>
              <MaterialIcons name="sports-soccer" size={iconSizes.xl} color={colors.text.light} />
            </View>
          )}
        </View>

        {/* Trip Info */}
        <View style={styles.tripInfo}>
          <View style={styles.tripHeader}>
            <Text style={styles.tripTitle} numberOfLines={1}>
              {trip.name || `Trip to ${trip.destination || 'Unknown'}`}
            </Text>
            <TouchableOpacity 
              style={styles.tripMoreButton}
              onPress={(e) => {
                e.stopPropagation();
                // Handle trip options
              }}
              accessibilityLabel="Trip options"
              accessibilityRole="button"
            >
              <MaterialIcons name="more-horiz" size={iconSizes.sm} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.tripDetails}>
            <View style={styles.tripDetailRow}>
              <MaterialIcons name="calendar-today" size={iconSizes.xs} color={colors.text.light} />
              <Text style={styles.tripDetailText}>
                {dateRange} • {matchCount} {matchCount === 1 ? 'match' : 'matches'}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'trips':
        if (itineraries.length === 0) {
          return (
            <View style={styles.emptyState}>
              <MaterialIcons name="flight-takeoff" size={iconSizes.xl * 2} color={colors.text.light} />
              <Text style={styles.emptyStateText}>No trips yet</Text>
              <Text style={styles.emptyStateSubtext}>Start planning your next football adventure</Text>
            </View>
          );
        }
        return (
          <View style={styles.contentList}>
            {itineraries.map((trip, index) => renderTripCard(trip, index))}
          </View>
        );
      
      case 'memories':
        return (
          <View style={styles.emptyState}>
            <MaterialIcons name="photo-library" size={iconSizes.xl * 2} color={colors.text.light} />
            <Text style={styles.emptyStateText}>No memories yet</Text>
            <Text style={styles.emptyStateSubtext}>Your match memories will appear here</Text>
          </View>
        );
      
      case 'attended':
        return (
          <View style={styles.emptyState}>
            <MaterialIcons name="check-circle" size={iconSizes.xl * 2} color={colors.text.light} />
            <Text style={styles.emptyStateText}>No attended matches yet</Text>
            <Text style={styles.emptyStateSubtext}>Mark matches as attended to see them here</Text>
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {renderProfileHeader()}
        {renderTabs()}
        {renderContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  scrollView: {
    flex: 1,
  },
  // Profile Header
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.cardGrey,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    ...typography.h2,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  userHandle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  moreButton: {
    padding: spacing.xs,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardGrey,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  shareButtonText: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: '500',
  },
  
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  tab: {
    paddingBottom: spacing.sm,
    position: 'relative',
  },
  activeTab: {
    // Active styling handled by text and indicator
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '400',
  },
  activeTabText: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.secondary, // Orange accent like Wanderlog
    borderRadius: 1,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sortButtonText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  
  // Content
  contentList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  tripCard: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.small,
  },
  tripImageContainer: {
    width: 100,
    height: 100,
    backgroundColor: colors.cardGrey,
  },
  tripImage: {
    width: '100%',
    height: '100%',
  },
  tripImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cardGrey,
  },
  tripInfo: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  tripTitle: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  tripMoreButton: {
    padding: spacing.xs,
  },
  tripDetails: {
    marginTop: spacing.xs,
  },
  tripDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tripDetailText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  emptyStateText: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyStateSubtext: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

export default ProfileScreenWireframe;

