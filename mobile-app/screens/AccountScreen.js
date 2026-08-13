import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Image,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button } from 'react-native-elements';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, typography, borderRadius, shadows, iconSizes } from '../styles/designTokens';
import { normalizeIds } from '../utils/idNormalizer';
import { getLegalPageUrls } from '../config/legalUrls';

const TABS = [
  { id: 'trips', label: 'Past Trips' },
  { id: 'memories', label: 'Memories' },
  { id: 'favorites', label: 'Favorites' },
];

const AccountScreen = ({ navigation }) => {
  const { user, logout, refreshUser } = useAuth();
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState(TABS[0].id);

  const [prefs, setPrefs] = useState({ favoriteLeagues: [], favoriteTeams: [], favoriteVenues: [] });
  const [loadingPrefs, setLoadingPrefs] = useState(true);

  const [completedTrips, setCompletedTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);

  const [memories, setMemories] = useState([]);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [memoriesFetched, setMemoriesFetched] = useState(false);

  const username = user?.username || user?.email?.split('@')[0] || 'user';
  const displayName = user?.username || user?.email?.split('@')[0] || 'User';
  // Subscription tiers exist server-side but IAP/paywall is not shipped yet — hide marketing badges.

  // Load preferences
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
            favoriteVenuesExpanded: p.favoriteVenuesExpanded || [],
          });
        }
      } catch (_) {}
      finally { if (mounted) setLoadingPrefs(false); }
    })();
    return () => { mounted = false; };
  }, []);

  // Load completed trips
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await ApiService.getTrips('completed');
        if (mounted && response.success && response.trips) {
          setCompletedTrips(normalizeIds(response.trips));
        }
      } catch (_) {}
      finally { if (mounted) setLoadingTrips(false); }
    })();
    return () => { mounted = false; };
  }, []);

  // Load memories lazily when tab is first opened
  useEffect(() => {
    if (activeTab !== 'memories' || memoriesFetched) return;
    let mounted = true;
    (async () => {
      setLoadingMemories(true);
      try {
        const response = await ApiService.getMemories();
        if (mounted && response.success) {
          setMemories(response.data || []);
        }
      } catch (_) {}
      finally {
        if (mounted) {
          setLoadingMemories(false);
          setMemoriesFetched(true);
        }
      }
    })();
    return () => { mounted = false; };
  }, [activeTab, memoriesFetched]);

  const refreshPreferences = async () => {
    try {
      const p = await ApiService.getPreferences();
      setPrefs({
        favoriteLeagues: p.favoriteLeagues || [],
        favoriteLeaguesExpanded: p.favoriteLeaguesExpanded || [],
        favoriteTeams: p.favoriteTeams || [],
        favoriteVenues: p.favoriteVenues || [],
        favoriteVenuesExpanded: p.favoriteVenuesExpanded || [],
      });
    } catch (_) {}
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account, profile, trips, preferences, saved data, and device tokens. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'This permanently deletes your account and all associated personal data. You cannot undo this.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm delete',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleteBusy(true);
                    try {
                      const result = await ApiService.deleteAccount();
                      if (result.success) {
                        await logout();
                        Alert.alert('Account deleted', 'Your account and personal data have been removed.');
                      } else {
                        Alert.alert('Could not delete account', result.error || 'Please try again or contact support.');
                      }
                    } catch (e) {
                      Alert.alert('Error', e.message || 'Something went wrong.');
                    } finally {
                      setDeleteBusy(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      await ApiService.uploadAvatar({
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'avatar.jpg',
      });
      await refreshUser();
    } catch (err) {
      const message =
        err.status === 429
          ? err.retryAfterSeconds
            ? `Please wait ${err.retryAfterSeconds} seconds before trying again.`
            : err.message
          : err.message || 'Failed to update avatar.';
      Alert.alert('Error', message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemovePhoto = async () => {
    setUploadingAvatar(true);
    try {
      await ApiService.removeAvatar();
      await refreshUser();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to remove profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleEditAvatar = () => {
    const options = [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Change photo', onPress: handleChangePhoto },
    ];
    if (user?.profile?.avatar) {
      options.splice(1, 0, { text: 'Remove photo', style: 'destructive', onPress: handleRemovePhoto });
    }
    Alert.alert('Profile picture', 'Choose an option', options);
  };

  const openLegalDoc = async (which) => {
    const { termsUrl, privacyUrl } = getLegalPageUrls();
    const url = which === 'terms' ? termsUrl : privacyUrl;
    if (!url) {
      Alert.alert(
        'Legal',
        'Set EXPO_PUBLIC_WEB_APP_URL to your deployed web app (no trailing slash) so Terms and Privacy open in the browser.',
      );
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not open the link.');
    }
  };

  const handleMoreOptions = () => {
    Alert.alert('Options', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Settings',
        onPress: () => {
          Alert.alert('Settings', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Notification settings',
              onPress: () => Linking.openSettings(),
            },
            { text: 'Terms of Service', onPress: () => openLegalDoc('terms') },
            { text: 'Privacy Policy', onPress: () => openLegalDoc('privacy') },
          ]);
        },
      },
      {
        text: 'Help',
        onPress: () => {
          Alert.alert('Help', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Send feedback',
              onPress: () => navigation.navigate('Feedback', { type: 'general' }),
            },
            {
              text: 'Report a bug',
              onPress: () => navigation.navigate('Feedback', { type: 'bug' }),
            },
            { text: 'Terms of Service', onPress: () => openLegalDoc('terms') },
            { text: 'Privacy Policy', onPress: () => openLegalDoc('privacy') },
          ]);
        },
      },
    ]);
  };

  const handleTripPress = (trip) => {
    navigation.navigate('TripsTab');
    requestAnimationFrame(() => {
      navigation.navigate('TripsTab', {
        screen: 'TripOverview',
        params: { itineraryId: trip.id || trip._id, fromAccountTab: true },
      });
    });
  };

  // --- Render helpers ---

  const renderProfileHeader = () => (
    <View style={styles.profileHeader}>
      <TouchableOpacity
        style={styles.avatarContainer}
        onPress={handleEditAvatar}
        disabled={uploadingAvatar}
        accessibilityLabel="Edit profile picture"
        accessibilityRole="button"
      >
        <View style={styles.avatar}>
          {user?.profile?.avatar ? (
            <Image source={{ uri: user.profile.avatar }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <MaterialIcons name="account-circle" size={80} color={colors.text.light} />
          )}
          {uploadingAvatar && (
            <View style={styles.avatarLoadingOverlay}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </View>
        <View style={styles.editIconContainer}>
          <MaterialIcons name="edit" size={iconSizes.xs} color={colors.text.primary} />
        </View>
      </TouchableOpacity>

      <View style={styles.userInfo}>
        <Text style={styles.userName}>{displayName}</Text>
        <Text style={styles.userHandle}>@{username}</Text>
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.navigate('Feedback', { type: 'general' })}
          accessibilityLabel="Send feedback"
          accessibilityRole="button"
        >
          <MaterialIcons name="feedback" size={iconSizes.md} color={colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleMoreOptions}
          accessibilityLabel="More options"
          accessibilityRole="button"
        >
          <MaterialIcons name="more-horiz" size={iconSizes.md} color={colors.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      {TABS.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={styles.tab}
          onPress={() => setActiveTab(tab.id)}
          accessibilityLabel={`View ${tab.label}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === tab.id }}
        >
          <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
            {tab.label}
          </Text>
          {activeTab === tab.id && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTripCard = (trip, index) => {
    const matchCount = trip.matches?.length || 0;
    const coverImage = trip.matches?.[0]?.fixture?.venue?.image || trip.matches?.[0]?.venueData?.image || null;
    const startDate = trip.startDate ? new Date(trip.startDate) : null;
    const endDate = trip.endDate ? new Date(trip.endDate) : null;
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
        onPress={() => handleTripPress(trip)}
        activeOpacity={0.7}
        accessibilityLabel={`Trip: ${trip.name}`}
        accessibilityRole="button"
      >
        <View style={styles.tripImageContainer}>
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.tripImage} resizeMode="cover" />
          ) : (
            <View style={styles.tripImagePlaceholder}>
              <MaterialIcons name="sports-soccer" size={iconSizes.xl} color={colors.text.light} />
            </View>
          )}
        </View>
        <View style={styles.tripInfo}>
          <Text style={styles.tripName} numberOfLines={1}>{trip.name}</Text>
          {trip.description ? (
            <Text style={styles.tripDescription} numberOfLines={1}>{trip.description}</Text>
          ) : null}
          <View style={styles.tripMeta}>
            <MaterialIcons name="calendar-today" size={iconSizes.xs} color={colors.text.light} />
            <Text style={styles.tripMetaText}>
              {dateRange}
              {matchCount > 0 ? ` · ${matchCount} ${matchCount === 1 ? 'match' : 'matches'}` : ''}
            </Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={iconSizes.md} color={colors.text.light} />
      </TouchableOpacity>
    );
  };

  const renderMemoryItem = (memory, index) => {
    const photoUri = memory.photos?.[0]?.url || memory.photo || null;
    const matchTitle = memory.matchTitle || memory.match?.teams || 'Match memory';

    return (
      <TouchableOpacity
        key={memory._id || index}
        style={styles.memoryCard}
        onPress={() => navigation.navigate('MemoriesTab')}
        activeOpacity={0.8}
        accessibilityLabel={`Memory: ${matchTitle}`}
        accessibilityRole="button"
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.memoryPhoto} resizeMode="cover" />
        ) : (
          <View style={styles.memoryPhotoPlaceholder}>
            <MaterialIcons name="sports-soccer" size={iconSizes.md} color={colors.text.light} />
          </View>
        )}
        <Text style={styles.memoryLabel} numberOfLines={2}>{matchTitle}</Text>
      </TouchableOpacity>
    );
  };

  const renderFavoriteItem = ({ item, type }) => {
    let name = '';
    let logo = null;
    let onRemove = null;

    if (type === 'league') {
      name = item.name || `League ${item.id}`;
      if (item.country) name += ` (${item.country})`;
      logo = item.badge || item.logo || item.emblem;
      onRemove = async () => {
        try { await ApiService.removeFavoriteLeague(item.id); await refreshPreferences(); } catch (_) {}
      };
    } else if (type === 'team') {
      name = item.teamId?.name || `Team ${item.teamId}`;
      logo = item.teamId?.badge || item.teamId?.logo;
      onRemove = async () => {
        try {
          const mongoId = item.teamId?._id || item.teamId;
          await ApiService.removeFavoriteTeamByMongoId(String(mongoId));
          await refreshPreferences();
        } catch (_) {}
      };
    } else if (type === 'venue') {
      name = item.name || `Venue ${item.venueId}`;
      if (item.city || item.country) name += ` (${[item.city, item.country].filter(Boolean).join(', ')})`;
      onRemove = async () => {
        try { await ApiService.removeFavoriteVenue(item.venueId); await refreshPreferences(); } catch (_) {}
      };
    }

    return (
      <View style={styles.favoriteItem}>
        <View style={styles.favoriteItemContent}>
          <View style={styles.itemIconContainer}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.itemIcon} resizeMode="contain" />
            ) : (
              <View style={styles.itemIconPlaceholder} />
            )}
          </View>
          <Text style={styles.favoriteItemText}>{name}</Text>
        </View>
        <TouchableOpacity
          style={styles.starButton}
          onPress={onRemove}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Remove from favorites"
          accessibilityRole="button"
        >
          <MaterialIcons name="star" size={iconSizes.md} color={colors.warning} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderTabContent = () => {
    if (activeTab === 'trips') {
      if (loadingTrips) {
        return <ActivityIndicator style={styles.loader} color={colors.primary} />;
      }
      if (completedTrips.length === 0) {
        return (
          <View style={styles.emptyState}>
            <MaterialIcons name="flight-takeoff" size={iconSizes.xl * 1.5} color={colors.text.light} />
            <Text style={styles.emptyStateText}>No past trips yet</Text>
            <Text style={styles.emptyStateSubtext}>Your completed trips will appear here</Text>
          </View>
        );
      }
      return (
        <View style={styles.tripsList}>
          {completedTrips.map((trip, index) => renderTripCard(trip, index))}
        </View>
      );
    }

    if (activeTab === 'memories') {
      if (loadingMemories) {
        return <ActivityIndicator style={styles.loader} color={colors.primary} />;
      }
      if (memories.length === 0) {
        return (
          <View style={styles.emptyState}>
            <MaterialIcons name="photo-library" size={iconSizes.xl * 1.5} color={colors.text.light} />
            <Text style={styles.emptyStateText}>No memories yet</Text>
            <Text style={styles.emptyStateSubtext}>Your match memories will appear here</Text>
          </View>
        );
      }
      return (
        <View>
          <View style={styles.memoriesGrid}>
            {memories.slice(0, 6).map((memory, index) => renderMemoryItem(memory, index))}
          </View>
          {memories.length > 6 && (
            <TouchableOpacity
              style={styles.seeAllButton}
              onPress={() => navigation.navigate('MemoriesTab')}
              accessibilityLabel="See all memories"
              accessibilityRole="button"
            >
              <Text style={styles.seeAllText}>See all {memories.length} memories</Text>
              <MaterialIcons name="chevron-right" size={iconSizes.sm} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      );
    }

    if (activeTab === 'favorites') {
      if (loadingPrefs) {
        return <ActivityIndicator style={styles.loader} color={colors.primary} />;
      }
      const leagues = prefs.favoriteLeaguesExpanded || [];
      const teams = prefs.favoriteTeams || [];
      const venues = prefs.favoriteVenuesExpanded || [];
      return (
        <View>
          <Text style={styles.sectionHeader}>Leagues</Text>
          {leagues.length === 0
            ? <Text style={styles.emptyText}>No favorite leagues yet</Text>
            : leagues.map((l, i) => (
              <View key={`league-${l.id || i}`}>{renderFavoriteItem({ item: l, type: 'league' })}</View>
            ))}

          <Text style={styles.sectionHeader}>Teams</Text>
          {teams.length === 0
            ? <Text style={styles.emptyText}>No favorite teams yet</Text>
            : teams.map((t, i) => (
              <View key={`team-${t.teamId?._id || t.teamId || i}`}>{renderFavoriteItem({ item: t, type: 'team' })}</View>
            ))}

          <Text style={styles.sectionHeader}>Venues</Text>
          {venues.length === 0
            ? <Text style={styles.emptyText}>No favorite venues yet</Text>
            : venues.map((v, i) => (
              <View key={`venue-${v.venueId || i}`}>{renderFavoriteItem({ item: v, type: 'venue' })}</View>
            ))}
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderProfileHeader()}
        {renderTabs()}
        <View style={styles.tabContent}>
          {renderTabContent()}
        </View>

        {/* Account actions — always visible below tab content */}
        <View style={styles.accountActions}>
          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => openLegalDoc('terms')} accessibilityRole="link">
              <Text style={styles.legalLink}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.legalSeparator}>·</Text>
            <TouchableOpacity onPress={() => openLegalDoc('privacy')} accessibilityRole="link">
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
          <Button
            title="Logout"
            onPress={handleLogout}
            buttonStyle={styles.logoutButton}
            titleStyle={styles.logoutButtonTitle}
          />
          <Button
            title="Delete my account"
            onPress={handleDeleteAccount}
            disabled={deleteBusy}
            loading={deleteBusy}
            type="clear"
            titleStyle={styles.deleteAccountTitle}
            buttonStyle={styles.deleteAccountButton}
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

  // Profile header
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
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
  avatarImage: {
    width: 80,
    height: 80,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconButton: {
    padding: spacing.xs,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tab: {
    paddingVertical: spacing.md,
    marginRight: spacing.lg,
    position: 'relative',
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
    backgroundColor: colors.secondary,
    borderRadius: 1,
  },

  // Tab content
  tabContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    minHeight: 300,
  },
  loader: {
    marginTop: spacing.xl,
  },

  // Trip cards
  tripsList: {
    gap: spacing.md,
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.small,
  },
  tripImageContainer: {
    width: 80,
    height: 80,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  tripName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  tripDescription: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  tripMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tripMetaText: {
    ...typography.caption,
    color: colors.text.light,
  },

  // Memories grid
  memoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  memoryCard: {
    width: '31%',
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: colors.cardGrey,
  },
  memoryPhoto: {
    width: '100%',
    aspectRatio: 1,
  },
  memoryPhotoPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.cardGrey,
  },
  memoryLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    padding: spacing.xs,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  seeAllText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },

  // Favorites
  sectionHeader: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  favoriteItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIconContainer: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.xs,
  },
  itemIconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.borderLight,
  },
  favoriteItemText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  starButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },

  // Empty states
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
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

  // Account actions
  accountActions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  legalLink: {
    ...typography.caption,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    ...typography.caption,
    color: colors.text.light,
  },
  logoutButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.sm,
  },
  logoutButtonTitle: {
    ...typography.button,
    color: colors.card,
  },
  deleteAccountButton: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.sm,
  },
  deleteAccountTitle: {
    ...typography.button,
    color: colors.error,
    textDecorationLine: 'underline',
  },
});

export default AccountScreen;
