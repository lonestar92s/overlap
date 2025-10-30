import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Image, ActivityIndicator, SafeAreaView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { debounce } from 'lodash';
import ApiService from '../services/api';

const UnifiedSearchScreen = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState({ leagues: [], teams: [], venues: [] });
  const [favLeagues, setFavLeagues] = useState(new Set());
  const [favTeamsMongoIds, setFavTeamsMongoIds] = useState(new Set());
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
        } else {
          setResults({ leagues: [], teams: [], venues: [] });
        }
      } catch (e) {
        setError('Search failed');
        setResults({ leagues: [], teams: [], venues: [] });
      } finally {
        setLoading(false);
      }
    }, 350),
    []
  );

  useEffect(() => {
    setLoading(query.trim().length >= 2);
    performSearch(query);
  }, [query, performSearch]);

  // Load preferences on mount to show stars
  useEffect(() => {
    (async () => {
      try {
        const prefs = await ApiService.getPreferences();
        const leagues = new Set((prefs.favoriteLeagues || []).map(String));
        const teams = new Set((prefs.favoriteTeams || []).map(ft => ft.teamId)); // Mongo ObjectIds
        const venues = new Set((prefs.favoriteVenues || []).map(v => String(v.venueId)));
        setFavLeagues(leagues);
        setFavTeamsMongoIds(teams);
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
  const isTeamFav = () => false;

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
    // We only have team external id; use addFavoriteTeamByApiId for add. For removal, we need mongo id; skip remove until fetched
    try {
      await ApiService.addFavoriteTeamByApiId(team.id);
      // We can’t instantly map mongo id; simply no-op star persistence until refresh
    } catch (e) {
      // ignore
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

  const renderSectionHeader = (title) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const renderLeagueItem = ({ item }) => (
    <View style={styles.resultRow}>
      {/* League badge (if provided) */}
      {item.badge ? (
        <Image source={{ uri: item.badge }} style={styles.badge} />
      ) : (
        <View style={styles.badgePlaceholder} />
      )}
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle}>{item.name}</Text>
        <Text style={styles.resultSubtitle}>{item.country}</Text>
      </View>
      <TouchableOpacity onPress={() => toggleLeague(item)}>
        <MaterialIcons name={isLeagueFav(item) ? 'star' : 'star-border'} size={22} color={isLeagueFav(item) ? '#FFD54F' : '#888'} />
      </TouchableOpacity>
    </View>
  );

  const renderTeamItem = ({ item }) => (
    <View style={styles.resultRow}>
      {/* Team logo (if provided) */}
      {item.badge ? (
        <Image source={{ uri: item.badge }} style={styles.badge} />
      ) : (
        <View style={styles.badgePlaceholder} />
      )}
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle}>{item.name}</Text>
        <Text style={styles.resultSubtitle}>
          {item.city ? `${item.city}, ` : ''}{item.country}
        </Text>
      </View>
      <TouchableOpacity onPress={() => toggleTeam(item)}>
        <MaterialIcons name={isTeamFav(item) ? 'star' : 'star-border'} size={22} color={'#888'} />
      </TouchableOpacity>
    </View>
  );

  const renderVenueItem = ({ item }) => (
    <View style={styles.resultRow}>
      {/* No image for venues as requested */}
      <View style={styles.badgePlaceholder} />
      <View style={styles.resultContent}>
        <Text style={styles.resultTitle}>{item.name}</Text>
        <Text style={styles.resultSubtitle}>
          {item.city ? `${item.city}, ` : ''}{item.country}
        </Text>
      </View>
      <TouchableOpacity onPress={() => toggleVenue(item)}>
        <MaterialIcons name={isVenueFav(item) ? 'star' : 'star-border'} size={22} color={isVenueFav(item) ? '#FFD54F' : '#888'} />
      </TouchableOpacity>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyState}>
      {loading ? (
        <ActivityIndicator size="small" color="#1976d2" />
      ) : (
        <Text style={styles.emptyText}>
          {query.trim().length < 2 ? 'Type at least 2 characters to search' : 'No results'}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search leagues, teams, or venues..."
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {error ? (
        <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
      ) : null}

      <FlatList
        ListHeaderComponent={
          <>
            {renderSectionHeader('Leagues')}
            <FlatList
              data={results.leagues}
              keyExtractor={(item, idx) => `league-${item.id || idx}`}
              renderItem={renderLeagueItem}
              ListEmptyComponent={results.leagues.length === 0 ? null : undefined}
            />
            {renderSectionHeader('Teams')}
            <FlatList
              data={results.teams}
              keyExtractor={(item, idx) => `team-${item.id || idx}`}
              renderItem={renderTeamItem}
              ListEmptyComponent={results.teams.length === 0 ? null : undefined}
            />
            {renderSectionHeader('Venues')}
            <FlatList
              data={results.venues}
              keyExtractor={(item, idx) => `venue-${item.id || idx}`}
              renderItem={renderVenueItem}
              ListEmptyComponent={results.venues.length === 0 ? null : undefined}
            />
          </>
        }
        data={[]}
        renderItem={() => null}
        ListEmptyComponent={<ListEmpty />}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  searchBar: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: '#fff' },
  input: {
    backgroundColor: '#f2f2f2',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 16,
    color: '#222'
  },
  listContent: { paddingBottom: 20 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  sectionHeaderText: { fontSize: 14, fontWeight: '700', color: '#666' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  badge: { width: 32, height: 32, borderRadius: 6, marginRight: 12, backgroundColor: '#eee' },
  badgePlaceholder: { width: 32, height: 32, borderRadius: 6, marginRight: 12, backgroundColor: '#eee' },
  resultContent: { flex: 1 },
  resultTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  resultSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  emptyState: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#888' },
  errorBox: { paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { color: '#c00' }
});

export default UnifiedSearchScreen;


