import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, ScrollView, TouchableOpacity, SafeAreaView, FlatList, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from 'react-native-elements';
import ApiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, typography, borderRadius, shadows, iconSizes } from '../styles/designTokens';
import { normalizeIds } from '../utils/idNormalizer';

const AccountScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [prefs, setPrefs] = useState({ 
    favoriteLeagues: [], 
    favoriteTeams: [], 
    favoriteVenues: [] 
  });
  const [completedTrips, setCompletedTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout }
      ]
    );
  };


  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await ApiService.getPreferences();
        if (mounted) {
          setPrefs({
            favoriteLeagues: p.favoriteLeagues || [],
            favoriteLeaguesExpanded: p.favoriteLeaguesExpanded || [],
            favoriteTeams: p.favoriteTeams || [],
            favoriteVenues: p.favoriteVenues || [],
            favoriteVenuesExpanded: p.favoriteVenuesExpanded || []
          });
        }
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoadingPrefs(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const refreshPreferences = async () => {
    try {
      const p = await ApiService.getPreferences();
      setPrefs({
        favoriteLeagues: p.favoriteLeagues || [],
        favoriteLeaguesExpanded: p.favoriteLeaguesExpanded || [],
        favoriteTeams: p.favoriteTeams || [],
        favoriteVenues: p.favoriteVenues || [],
        favoriteVenuesExpanded: p.favoriteVenuesExpanded || []
      });
    } catch (e) {
      // ignore
    }
  };

  // Load completed trips for Past Trips tab
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingTrips(true);
        const response = await ApiService.getTrips('completed');
        if (mounted && response.success && response.trips) {
          const normalizedTrips = normalizeIds(response.trips);
          setCompletedTrips(normalizedTrips);
        }
      } catch (e) {
        console.error('Error loading completed trips:', e);
        if (mounted) setCompletedTrips([]);
      } finally {
        if (mounted) setLoadingTrips(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const renderSectionHeader = (title) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  const renderFavoriteLeagues = () => {
    return (
      <>
        {renderSectionHeader('Favorite Leagues')}
        {(prefs.favoriteLeaguesExpanded || prefs.favoriteLeagues || []).length === 0 ? (
          <Text style={styles.emptyText}>No favorite leagues yet</Text>
        ) : (
          (prefs.favoriteLeaguesExpanded || []).map((l) => (
            <View key={`fav-league-${l.id}`} style={styles.favoriteItem}>
              <View style={styles.favoriteItemContent}>
                <View style={styles.itemIconContainer}>
                  {l.badge || l.logo || l.emblem ? (
                    <Image 
                      source={{ uri: l.badge || l.logo || l.emblem }} 
                      style={styles.itemIcon}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.itemIconPlaceholder} />
                  )}
                </View>
                <Text style={styles.favoriteItemText}>
                  {l.name || `League ${l.id}`}{l.country ? ` (${l.country})` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.starButton}
                onPress={async () => {
                  try {
                    await ApiService.removeFavoriteLeague(l.id);
                    await refreshPreferences();
                  } catch (e) {
                    // ignore
                  }
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Remove from favorites"
                accessibilityRole="button"
              >
                <MaterialIcons
                  name="star"
                  size={20}
                  color="#FFD700"
                />
              </TouchableOpacity>
            </View>
          ))
        )}
      </>
    );
  };

  const renderFavoriteTeams = () => {
    return (
      <>
        {renderSectionHeader('Favorite Teams')}
        {(prefs.favoriteTeams || []).length === 0 ? (
          <Text style={styles.emptyText}>No favorite teams yet</Text>
        ) : (
          (prefs.favoriteTeams || []).map((ft) => (
            <View key={`fav-team-${ft.teamId?._id || ft.teamId}`} style={styles.favoriteItem}>
              <View style={styles.favoriteItemContent}>
                <View style={styles.itemIconContainer}>
                  {ft.teamId?.badge || ft.teamId?.logo ? (
                    <Image 
                      source={{ uri: ft.teamId.badge || ft.teamId.logo }} 
                      style={styles.itemIcon}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.itemIconPlaceholder} />
                  )}
                </View>
                <Text style={styles.favoriteItemText}>
                  {ft.teamId?.name || `Team ${ft.teamId}`}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.starButton}
                onPress={async () => {
                  try {
                    const mongoId = ft.teamId?._id || ft.teamId;
                    await ApiService.removeFavoriteTeamByMongoId(String(mongoId));
                    await refreshPreferences();
                  } catch (e) {
                    // ignore
                  }
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Remove from favorites"
                accessibilityRole="button"
              >
                <MaterialIcons
                  name="star"
                  size={20}
                  color="#FFD700"
                />
              </TouchableOpacity>
            </View>
          ))
        )}
      </>
    );
  };

  const renderFavoriteVenues = () => {
    return (
      <>
        {renderSectionHeader('Favorite Venues')}
        {(prefs.favoriteVenuesExpanded || prefs.favoriteVenues || []).length === 0 ? (
          <Text style={styles.emptyText}>No favorite venues yet</Text>
        ) : (
          (prefs.favoriteVenuesExpanded || []).map((v) => (
            <View key={`fav-venue-${v.venueId}`} style={styles.favoriteItem}>
              <Text style={styles.favoriteItemText}>
                {v.name || `Venue ${v.venueId}`}
                {v.city || v.country ? ` (${[v.city, v.country].filter(Boolean).join(', ')})` : ''}
              </Text>
              <TouchableOpacity
                style={styles.starButton}
                onPress={async () => {
                  try {
                    await ApiService.removeFavoriteVenue(v.venueId);
                    await refreshPreferences();
                  } catch (e) {
                    // ignore
                  }
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Remove from favorites"
                accessibilityRole="button"
              >
                <MaterialIcons
                  name="star"
                  size={20}
                  color="#FFD700"
                />
              </TouchableOpacity>
            </View>
          ))
        )}
      </>
    );
  };

  // Extract username from email for display
  const username = user?.email?.split('@')[0] || 'user';
  const displayName = user?.name || user?.email?.split('@')[0] || 'User Name';
  
  const tabs = [
    { id: 'trips', label: 'Past Trips' },
    { id: 'favorites', label: 'Favorites' },
  ];
  
  // Tab state - default to first tab
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  const handleMoreOptions = () => {
    Alert.alert(
      'Options',
      'More options',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Settings', onPress: () => {/* Navigate to settings */} },
        { text: 'Help', onPress: () => {/* Navigate to help */} },
      ]
    );
  };

  const handleEditAvatar = () => {
    // TODO: Implement avatar editing
    Alert.alert('Edit Avatar', 'Avatar editing coming soon');
  };

  const handleTripPress = (trip) => {
    navigation.navigate('TripsTab', {
      screen: 'TripOverview',
      params: { itineraryId: trip.id || trip._id }
    });
  };

  const renderTripItem = ({ item }) => {
    const matchCount = item.matches?.length || 0;
    return (
      <TouchableOpacity
        style={styles.tripCard}
        onPress={() => handleTripPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.tripContent}>
          <View style={styles.tripHeader}>
            <View style={styles.tripInfo}>
              <Text style={styles.tripName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.tripDescription}>{item.description}</Text>
              ) : null}
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.text.light} />
          </View>
          
          {matchCount > 0 && (
            <View style={styles.tripStats}>
              <MaterialIcons name="sports-soccer" size={16} color={colors.text.secondary} />
              <Text style={styles.matchCountText}>{matchCount} {matchCount === 1 ? 'match' : 'matches'}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header - Wanderlog Pattern */}
        <View style={styles.profileHeader}>
        {/* Avatar with edit icon */}
        <TouchableOpacity 
          style={styles.avatarContainer}
          onPress={handleEditAvatar}
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
            onPress={handleMoreOptions}
            accessibilityLabel="More options"
            accessibilityRole="button"
          >
            <MaterialIcons name="more-horiz" size={iconSizes.md} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Tab Navigation - Wanderlog Pattern */}
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
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {activeTab === 'favorites' && (
          <>
        {loadingPrefs ? (
          <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <>
            {renderFavoriteLeagues()}
            {renderFavoriteTeams()}
            {renderFavoriteVenues()}
          </>
        )}
          </>
        )}
        
        {activeTab === 'trips' && (
          <>
            {loadingTrips ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : completedTrips.length > 0 ? (
              <FlatList
                data={completedTrips}
                renderItem={renderTripItem}
                keyExtractor={(item) => item.id || item._id}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.tripsListContainer}
              />
            ) : (
              <View style={styles.emptyState}>
                <MaterialIcons name="flight-takeoff" size={iconSizes.xl * 2} color={colors.text.light} />
                <Text style={styles.emptyStateText}>No past trips yet</Text>
                <Text style={styles.emptyStateSubtext}>Your completed trips will appear here</Text>
              </View>
            )}
          </>
        )}
        
        {/* Logout button - visible on all tabs */}
        <Button
          title="Logout"
          onPress={handleLogout}
          buttonStyle={styles.logoutButton}
          titleStyle={styles.logoutButtonTitle}
          containerStyle={{ marginTop: spacing.lg }}
        />
      </View>
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
  // Profile Header - Wanderlog Pattern
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg, // SafeAreaView handles safe area, this is additional spacing
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
    justifyContent: 'center',
  },
  moreButton: {
    padding: spacing.xs,
  },
  
  // Tab Navigation - Wanderlog Pattern
  tabsContainer: {
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
  
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  sectionHeader: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  favoriteItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  favoriteItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.xs,
  },
  itemIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.borderLight,
  },
  favoriteItemText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  starButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  logoutButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  logoutButtonTitle: {
    ...typography.button,
    color: colors.card,
  },
  
  // Empty States
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
    minHeight: 400,
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
    marginBottom: spacing.md,
  },
  
  // Past Trips Styles
  tripsListContainer: {
    paddingBottom: spacing.md,
  },
  tripCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    ...shadows.small,
    overflow: 'hidden',
  },
  tripContent: {
    padding: spacing.md,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  tripInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  tripName: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  tripDescription: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  tripStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  matchCountText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
});

export default AccountScreen;

