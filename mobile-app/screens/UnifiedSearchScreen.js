import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Image, ActivityIndicator, SafeAreaView, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { debounce } from 'lodash';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/api';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';

const RECENT_SEARCHES_KEY = 'unifiedSearchRecentSearches';
const MAX_RECENT_SEARCHES = 5;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const UnifiedSearchScreen = () => {
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState({ leagues: [], teams: [], venues: [] });
  const [relatedVenues, setRelatedVenues] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [suggestedItems, setSuggestedItems] = useState([]);
  const [favLeagues, setFavLeagues] = useState(new Set());
  const [favTeamApiIds, setFavTeamApiIds] = useState(new Set());
  const [favVenues, setFavVenues] = useState(new Set());

  const performSearch = useCallback(
    debounce(async (text) => {
      if (!text || text.trim().length < 2) {
        setResults({ leagues: [], teams: [], venues: [] });
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await ApiService.searchUnified(text.trim());
        if (data && data.success) {
          setResults(data.results || { leagues: [], teams: [], venues: [] });
          // Compute related venues for strong team match
          const q = text.trim().toLowerCase();
          const exactTeam = (data.results?.teams || []).find(t => (t.name || '').toLowerCase() === q);
          if (exactTeam && exactTeam.relatedVenue && exactTeam.relatedVenue.name) {
            const alreadyListed = (data.results?.venues || []).some(v => (v.name || '').toLowerCase() === exactTeam.relatedVenue.name.toLowerCase());
            if (!alreadyListed) {
              setRelatedVenues([{ name: exactTeam.relatedVenue.name, city: exactTeam.relatedVenue.city, country: exactTeam.relatedVenue.country }]);
            } else {
              setRelatedVenues([]);
            }
          } else {
            setRelatedVenues([]);
          }
        } else {
          setResults({ leagues: [], teams: [], venues: [] });
          setRelatedVenues([]);
        }
      } catch (e) {
        setError('Search failed');
        setResults({ leagues: [], teams: [], venues: [] });
        setRelatedVenues([]);
      } finally {
        setLoading(false);
      }
    }, 350),
    []
  );

  useEffect(() => {
    setIsTyping(query.trim().length > 0);
    setLoading(query.trim().length >= 2);
    performSearch(query);
  }, [query, performSearch]);

  // Load recent searches on mount
  useEffect(() => {
    loadRecentSearches();
    loadSuggestedItems();
  }, []);

  // Load recent searches from storage
  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error);
    }
  };

  // Save search to recent searches
  const saveToRecentSearches = async (item) => {
    try {
      const newSearch = {
        ...item,
        timestamp: Date.now(),
      };
      
      const updated = [
        newSearch,
        ...recentSearches.filter(s => 
          s.id !== newSearch.id || s.type !== newSearch.type
        )
      ].slice(0, MAX_RECENT_SEARCHES);
      
      setRecentSearches(updated);
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save recent search:', error);
    }
  };

  // Load suggested items (from favorites or popular)
  const loadSuggestedItems = async () => {
    try {
      const prefs = await ApiService.getPreferences();
      const suggested = [];
      
      // Add favorite teams
      if (prefs.favoriteTeams && prefs.favoriteTeams.length > 0) {
        const teams = prefs.favoriteTeams.slice(0, 3).map(ft => ({
          type: 'team',
          id: ft.teamId?.apiId || ft.teamId,
          name: ft.teamId?.name || 'Team',
          country: ft.teamId?.country || '',
          badge: ft.teamId?.badge,
        }));
        suggested.push(...teams);
      }
      
      // Add favorite leagues
      if (prefs.favoriteLeagues && prefs.favoriteLeagues.length > 0) {
        const leagues = prefs.favoriteLeagues.slice(0, 2).map(fl => ({
          type: 'league',
          id: fl,
          name: fl.name || 'League',
          country: fl.country || '',
          badge: fl.badge,
        }));
        suggested.push(...leagues);
      }
      
      setSuggestedItems(suggested);
    } catch (error) {
      // Ignore if user is not authenticated
      console.log('Could not load suggested items:', error);
    }
  };

  // Load preferences on mount to show stars
  useEffect(() => {
    (async () => {
      try {
        const prefs = await ApiService.getPreferences();
        const leagues = new Set((prefs.favoriteLeagues || []).map(String));
        // favoriteTeams is populated in backend; map to external apiId if available
        const teams = new Set(
          (prefs.favoriteTeams || [])
            .map(ft => ft.teamId && (ft.teamId.apiId || ft.teamId))
            .filter(Boolean)
            .map(String)
        );
        const venues = new Set((prefs.favoriteVenues || []).map(v => String(v.venueId)));
        setFavLeagues(leagues);
        setFavTeamApiIds(teams);
        setFavVenues(venues);
      } catch (e) {
        // Ignore; user might be unauthenticated
      }
    })();
  }, []);

  // Helpers to determine star state
  const isLeagueFav = (league) => favLeagues.has(String(league.id));
  const isVenueFav = (venue) => favVenues.has(String(venue.id));
  // For teams, unified search returns external id; we only know Mongo id set. Star best-effort after first add
  const isTeamFav = (team) => favTeamApiIds.has(String(team.id));

  const toggleLeague = async (league) => {
    const id = String(league.id);
    const next = new Set(favLeagues);
    const currently = next.has(id);
    // Optimistic
    if (currently) next.delete(id); else next.add(id);
    setFavLeagues(next);
    try {
      if (currently) await ApiService.removeFavoriteLeague(id);
      else await ApiService.addFavoriteLeague(id);
    } catch (e) {
      // Revert on error
      const revert = new Set(favLeagues);
      setFavLeagues(revert);
    }
  };

  const toggleTeam = async (team) => {
    const id = String(team.id);
    const currently = favTeamApiIds.has(id);
    // Optimistic add/remove of visual state; server only supports add via apiId for now
    const next = new Set(favTeamApiIds);
    if (currently) {
      // We don't have an API to remove by apiId yet; just keep it selected and return
      return;
    } else {
      next.add(id);
      setFavTeamApiIds(next);
      try {
        await ApiService.addFavoriteTeamByApiId(id);
      } catch (e) {
        // Revert on error
        const revert = new Set(favTeamApiIds);
        setFavTeamApiIds(revert);
      }
    }
  };

  const toggleVenue = async (venue) => {
    const id = String(venue.id);
    const next = new Set(favVenues);
    const currently = next.has(id);
    if (currently) next.delete(id); else next.add(id);
    setFavVenues(next);
    try {
      if (currently) await ApiService.removeFavoriteVenue(id);
      else await ApiService.addFavoriteVenue(id);
    } catch (e) {
      const revert = new Set(favVenues);
      setFavVenues(revert);
    }
  };

  // Handle item selection
  const handleItemSelect = async (item) => {
    await saveToRecentSearches(item);
    // Navigate or handle selection based on item type
    // You can add navigation logic here
  };

  // Handle search input focus
  const handleSearchFocus = () => {
    setIsTyping(true);
  };

  // Handle back button
  const handleBack = () => {
    if (query.trim().length > 0) {
      setQuery('');
      setIsTyping(false);
    } else {
      navigation.goBack();
    }
  };

  // Clear all recent searches
  const handleClearAll = async () => {
    try {
      setRecentSearches([]);
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (error) {
      console.error('Failed to clear recent searches:', error);
    }
  };

  // Render search input
  const renderSearchInput = () => (
    <TouchableOpacity
      style={styles.searchButton}
      onPress={handleSearchFocus}
      activeOpacity={0.8}
    >
      {isTyping ? (
        <View style={styles.searchButtonContent}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <TextInput
            style={[styles.searchInput, { marginLeft: spacing.md }]}
            placeholder="Search leagues, teams, or venues"
            placeholderTextColor={colors.text.light}
            value={query}
            onChangeText={setQuery}
            autoFocus={true}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      ) : (
        <View style={styles.searchButtonContent}>
          <MaterialIcons name="search" size={20} color={colors.text.light} style={{ transform: [{ rotate: '90deg' }] }} />
          <Text style={[styles.searchPlaceholder, { marginLeft: spacing.md }]}>Search leagues, teams, or venues</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Render recent search item
  const renderRecentSearchItem = (item) => {
    const getIcon = () => {
      if (item.type === 'venue') {
        return <MaterialIcons name="stadium" size={40} color={colors.text.primary} />;
      }
      if (item.badge) {
        return <Image source={{ uri: item.badge }} style={styles.itemIcon} />;
      }
      return <View style={styles.itemIconPlaceholder} />;
    };

    const getSubtitle = () => {
      if (item.type === 'league') {
        return item.country || 'League';
      }
      if (item.type === 'team') {
        return item.city ? `${item.city}, ${item.country || ''}` : item.country || 'Team';
      }
      if (item.type === 'venue') {
        return item.city ? `${item.city}, ${item.country || ''}` : item.country || 'Venue';
      }
      return '';
    };

    return (
      <TouchableOpacity
        key={`${item.type}-${item.id}`}
        style={styles.searchItemCard}
        onPress={() => handleItemSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemIconContainer}>
          {getIcon()}
        </View>
        <View style={styles.itemTextContainer}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <Text style={styles.itemSubtitle}>{getSubtitle()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Render suggested item
  const renderSuggestedItem = (item) => {
    const getIcon = () => {
      if (item.badge) {
        return <Image source={{ uri: item.badge }} style={styles.itemIcon} />;
      }
      return <View style={styles.itemIconPlaceholder} />;
    };

    return (
      <TouchableOpacity
        key={`${item.type}-${item.id}`}
        style={styles.searchItemCard}
        onPress={() => handleItemSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemIconContainer}>
          {getIcon()}
        </View>
        <View style={styles.itemTextContainer}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <Text style={styles.itemSubtitle}>{item.country || ''}</Text>
        </View>
      </TouchableOpacity>
    );
  };


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Main Search Container */}
      <View style={styles.mainContainer}>
        <View style={styles.containerContent}>
          {renderSearchInput()}
          
          <ScrollView 
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
          {/* Recent Searches Section - Only show when not typing */}
          {!isTyping && recentSearches.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Recent searches</Text>
              <View style={styles.itemsContainer}>
                {recentSearches.map((item) => renderRecentSearchItem(item))}
              </View>
            </View>
          )}

          {/* Suggested Teams Section - Only show when not typing */}
          {!isTyping && suggestedItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Suggested Teams</Text>
              <View style={styles.itemsContainer}>
                {suggestedItems.map((item) => renderSuggestedItem(item))}
              </View>
            </View>
          )}

          {/* Search Results (when typing) */}
          {isTyping && query.trim().length >= 2 && (
            <>
              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
              
              {!loading && results.leagues.length === 0 && results.teams.length === 0 && results.venues.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No results found</Text>
                </View>
              )}

              {results.leagues.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>Leagues</Text>
                  <View style={styles.itemsContainer}>
                    {results.leagues.map((item) => (
                      <TouchableOpacity
                        key={`league-${item.id}`}
                        style={styles.searchItemCard}
                        onPress={() => handleItemSelect({ ...item, type: 'league' })}
                        activeOpacity={0.7}
                      >
                        <View style={styles.itemIconContainer}>
                          {item.badge ? (
                            <Image source={{ uri: item.badge }} style={styles.itemIcon} />
                          ) : (
                            <View style={styles.itemIconPlaceholder} />
                          )}
                        </View>
                        <View style={styles.itemTextContainer}>
                          <Text style={styles.itemTitle}>{item.name}</Text>
                          <Text style={styles.itemSubtitle}>{item.country || 'League'}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {results.teams.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>Teams</Text>
                  <View style={styles.itemsContainer}>
                    {results.teams.map((item) => (
                      <TouchableOpacity
                        key={`team-${item.id}`}
                        style={styles.searchItemCard}
                        onPress={() => handleItemSelect({ ...item, type: 'team' })}
                        activeOpacity={0.7}
                      >
                        <View style={styles.itemIconContainer}>
                          {item.badge ? (
                            <Image source={{ uri: item.badge }} style={styles.itemIcon} />
                          ) : (
                            <View style={styles.itemIconPlaceholder} />
                          )}
                        </View>
                        <View style={styles.itemTextContainer}>
                          <Text style={styles.itemTitle}>{item.name}</Text>
                          <Text style={styles.itemSubtitle}>
                            {item.city ? `${item.city}, ${item.country || ''}` : item.country || 'Team'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {results.venues.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionHeader}>Venues</Text>
                  <View style={styles.itemsContainer}>
                    {results.venues.map((item) => (
                      <TouchableOpacity
                        key={`venue-${item.id}`}
                        style={styles.searchItemCard}
                        onPress={() => handleItemSelect({ ...item, type: 'venue' })}
                        activeOpacity={0.7}
                      >
                        <View style={styles.itemIconContainer}>
                          <MaterialIcons name="stadium" size={40} color={colors.text.primary} />
                        </View>
                        <View style={styles.itemTextContainer}>
                          <Text style={styles.itemTitle}>{item.name}</Text>
                          <Text style={styles.itemSubtitle}>
                            {item.city ? `${item.city}, ${item.country || ''}` : item.country || 'Venue'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
          </ScrollView>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={styles.clearButton}
          onPress={handleClearAll}
        >
          <Text style={styles.clearButtonText}>Clear All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.searchActionButton}>
          <Text style={styles.searchActionText}>Search</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card, // White background from Figma
  },
  mainContainer: {
    position: 'absolute',
    top: 55,
    left: (SCREEN_WIDTH - 439) / 2, // Center 439px width container
    width: 439,
    height: 563,
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: 14, // From Figma (not borderRadius.md)
    backgroundColor: colors.card,
  },
  containerContent: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    alignItems: 'center',
    overflow: 'hidden', // Ensure content doesn't overflow container
  },
  searchButton: {
    height: 49,
    width: '100%',
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.text.primary,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  searchButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    padding: 0,
  },
  searchPlaceholder: {
    ...typography.body,
    color: colors.text.light,
  },
  scrollContent: {
    flex: 1,
    width: '100%',
  },
  scrollContentContainer: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  section: {
    width: 338, // From Figma
    alignItems: 'flex-start', // Left align items
    marginBottom: spacing.lg, // 24px gap from Figma
  },
  sectionHeader: {
    ...typography.caption,
    color: colors.text.light,
    width: '100%',
    marginBottom: spacing.sm + 3, // 11px gap from Figma
    textAlign: 'left',
  },
  itemsContainer: {
    width: '100%',
    alignItems: 'flex-start', // Left align items
  },
  searchItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14, // From Figma (not borderRadius.md)
    width: '100%',
    marginBottom: spacing.sm + 3, // 11px gap from Figma
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
  itemTextContainer: {
    flex: 1,
    marginLeft: spacing.xl * 2.25, // 36px gap from Figma
  },
  itemTitle: {
    ...typography.caption,
    color: colors.text.primary,
  },
  itemSubtitle: {
    ...typography.caption,
    color: colors.text.light,
    marginTop: 7, // 7px gap from Figma
  },
  loadingContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  actionContainer: {
    position: 'absolute',
    top: 640, // Moved up since filter buttons are removed
    left: 46,
    width: 330,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearButton: {
    backgroundColor: '#F06161', // Red from Figma
    borderWidth: 1,
    borderColor: colors.text.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  clearButtonText: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.text.primary,
  },
  searchActionButton: {
    padding: spacing.xs,
  },
  searchActionText: {
    ...typography.caption,
    color: colors.text.primary,
  },
});

export default UnifiedSearchScreen;


