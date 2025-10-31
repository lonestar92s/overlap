import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from 'react-native-elements';
import ApiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const AccountScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [prefs, setPrefs] = useState({ 
    favoriteLeagues: [], 
    favoriteTeams: [], 
    favoriteVenues: [] 
  });
  
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

  const handleViewAttendedMatches = () => {
    navigation.navigate('MemoriesTab');
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const p = await ApiService.getPreferences();
        if (mounted) {
          setPrefs({
            favoriteLeagues: p.favoriteLeagues || [],
            favoriteTeams: p.favoriteTeams || [],
            favoriteVenues: p.favoriteVenues || []
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
              <Text style={styles.favoriteItemText}>
                {l.name || `League ${l.id}`}{l.country ? ` (${l.country})` : ''}
              </Text>
              <Button 
                title="Remove" 
                type="clear" 
                titleStyle={styles.removeButtonText}
                onPress={async () => {
                  try {
                    await ApiService.removeFavoriteLeague(l.id);
                    await refreshPreferences();
                  } catch (e) {
                    // ignore
                  }
                }} 
              />
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
              <Text style={styles.favoriteItemText}>
                {ft.teamId?.name || `Team ${ft.teamId}`}
              </Text>
              <Button 
                title="Remove" 
                type="clear" 
                titleStyle={styles.removeButtonText}
                onPress={async () => {
                  try {
                    const mongoId = ft.teamId?._id || ft.teamId;
                    await ApiService.removeFavoriteTeamByMongoId(String(mongoId));
                    await refreshPreferences();
                  } catch (e) {
                    // ignore
                  }
                }} 
              />
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
              <Button 
                title="Remove" 
                type="clear" 
                titleStyle={styles.removeButtonText}
                onPress={async () => {
                  try {
                    await ApiService.removeFavoriteVenue(v.venueId);
                    await refreshPreferences();
                  } catch (e) {
                    // ignore
                  }
                }} 
              />
            </View>
          ))
        )}
      </>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="account-circle" size={80} color="#1976d2" />
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      
      <View style={styles.content}>
        <Button
          title="View Match Memories"
          onPress={handleViewAttendedMatches}
          buttonStyle={styles.attendedMatchesButton}
          titleStyle={styles.attendedMatchesButtonTitle}
          icon={<MaterialIcons name="memory" size={20} color="#fff" />}
        />
        {/* Favorites */}
        {loadingPrefs ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#1976d2" />
          </View>
        ) : (
          <>
            {renderFavoriteLeagues()}
            {renderFavoriteTeams()}
            {renderFavoriteVenues()}
          </>
        )}
        <Button
          title="Logout"
          onPress={handleLogout}
          buttonStyle={styles.logoutButton}
          titleStyle={styles.logoutButtonTitle}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  email: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  attendedMatchesButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 30,
    marginBottom: 16,
  },
  attendedMatchesButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 24,
    marginBottom: 8,
  },
  favoriteItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  favoriteItemText: {
    color: '#333',
    flex: 1,
  },
  emptyText: {
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  removeButtonText: {
    color: '#c00',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 30,
    marginTop: 24,
  },
  logoutButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AccountScreen;

