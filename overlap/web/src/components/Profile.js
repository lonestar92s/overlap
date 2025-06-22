import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Avatar,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Chip,
  Card,
  CardContent,
  IconButton
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PhotoCamera as PhotoCameraIcon,
  Delete as DeleteIcon,
  Stadium as StadiumIcon,
  AccessTime as AccessTimeIcon,
  LocationOn as LocationOnIcon
} from '@mui/icons-material';
import TeamSearch from './TeamSearch';
import { format } from 'date-fns';

// Component for displaying saved matches
const WantToGoSection = () => {
  const [savedMatches, setSavedMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSavedMatches();
  }, []);

  const fetchSavedMatches = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/preferences/saved-matches', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSavedMatches(data.savedMatches);
      }
    } catch (error) {
      console.error('Error fetching saved matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeSavedMatch = async (matchId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`http://localhost:3001/api/preferences/saved-matches/${matchId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSavedMatches(prev => prev.filter(match => match.matchId !== matchId));
      }
    } catch (error) {
      console.error('Error removing saved match:', error);
    }
  };

  if (loading) {
    return (
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          Want to Go
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress size={24} />
        </Box>
      </Grid>
    );
  }

  return (
    <Grid item xs={12}>
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Want to Go
      </Typography>
      <Divider sx={{ mb: 2 }} />
      
      {savedMatches.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          No saved matches yet. Heart matches while searching to add them here!
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {savedMatches
            .sort((a, b) => new Date(a.date) - new Date(b.date)) // Sort by date, soonest first
            .map((match) => {
              // Handle both old string format and new object format for team data
              const homeTeam = typeof match.homeTeam === 'string' 
                ? { name: match.homeTeam, logo: null }
                : match.homeTeam;
              const awayTeam = typeof match.awayTeam === 'string'
                ? { name: match.awayTeam, logo: null }
                : match.awayTeam;
              
              return (
                <Card key={match.matchId} elevation={1} sx={{ position: 'relative' }}>
                  <CardContent sx={{ pb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        {/* Team matchup with logos */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                            {homeTeam.logo && (
                              <Avatar 
                                src={homeTeam.logo} 
                                alt={homeTeam.name}
                                sx={{ width: 32, height: 32 }}
                              />
                            )}
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {homeTeam.name}
                            </Typography>
                          </Box>
                          
                          <Typography variant="h6" sx={{ color: '#666', fontWeight: 600, mx: 1 }}>
                            vs
                          </Typography>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, justifyContent: 'flex-end' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {awayTeam.name}
                            </Typography>
                            {awayTeam.logo && (
                              <Avatar 
                                src={awayTeam.logo} 
                                alt={awayTeam.name}
                                sx={{ width: 32, height: 32 }}
                              />
                            )}
                          </Box>
                        </Box>
                        
                        {/* League */}
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: '#666',
                            backgroundColor: '#f5f5f5',
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1,
                            fontWeight: 500,
                            display: 'inline-block',
                            mb: 1
                          }}
                        >
                          {match.league}
                        </Typography>
                        
                        {/* Date and Time */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <AccessTimeIcon sx={{ fontSize: 16, color: '#666' }} />
                          <Typography variant="body2" color="text.secondary">
                            {format(new Date(match.date), 'MMM dd, yyyy • HH:mm')}
                          </Typography>
                        </Box>
                        
                        {/* Venue */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LocationOnIcon sx={{ fontSize: 16, color: '#666' }} />
                          <Typography variant="body2" color="text.secondary">
                            {match.venue}
                          </Typography>
                        </Box>
                      </Box>
                      
                      {/* Remove button */}
                      <IconButton
                        size="small"
                        onClick={() => removeSavedMatch(match.matchId)}
                        sx={{
                          color: '#666',
                          '&:hover': {
                            color: '#FF385C',
                            backgroundColor: 'rgba(255, 56, 92, 0.04)'
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
        </Box>
      )}
    </Grid>
  );
};

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Form states
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    avatar: '',
    timezone: 'UTC'
  });

  const [preferences, setPreferences] = useState({
    defaultLocation: {
      city: '',
      country: '',
      coordinates: []
    },
    favoriteTeams: [],
    favoriteLeagues: [],
    defaultSearchRadius: 100,
    currency: 'USD',
    notifications: {
      email: true,
      matchReminders: false,
      priceAlerts: false
    }
  });

  const timezones = [
    'UTC', 'America/New_York', 'America/Los_Angeles', 'America/Chicago',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo',
    'Asia/Shanghai', 'Australia/Sydney'
  ];

  const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view your profile');
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:3001/api/preferences', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
        setProfile(data.profile || {
          firstName: '',
          lastName: '',
          avatar: '',
          timezone: 'UTC'
        });
        setPreferences(data.preferences || {
          defaultLocation: { city: '', country: '', coordinates: [] },
          favoriteTeams: [],
          favoriteLeagues: [],
          defaultSearchRadius: 100,
          currency: 'USD',
          notifications: {
            email: true,
            matchReminders: false,
            priceAlerts: false
          }
        });
      } else {
        setError('Failed to load profile data');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      
      // Save profile
      const profileResponse = await fetch('http://localhost:3001/api/preferences/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profile)
      });

      // Save preferences
      const preferencesResponse = await fetch('http://localhost:3001/api/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });

      if (profileResponse.ok && preferencesResponse.ok) {
        setMessage('Profile updated successfully!');
        setEditing(false);
        fetchUserData(); // Refresh data
      } else {
        setError('Failed to update profile');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setError('');
    setMessage('');
    // Reset form data
    if (user) {
      setProfile(user.profile || {
        firstName: '',
        lastName: '',
        avatar: '',
        timezone: 'UTC'
      });
      setPreferences(user.preferences || {
        defaultLocation: { city: '', country: '', coordinates: [] },
        favoriteTeams: [],
        favoriteLeagues: [],
        defaultSearchRadius: 100,
        currency: 'USD',
        notifications: {
          email: true,
          matchReminders: false,
          priceAlerts: false
        }
      });
    }
  };

  const handleTeamSelect = async (team) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/preferences/teams', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ teamId: team.id })
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(prev => ({
          ...prev,
          favoriteTeams: data.favoriteTeams
        }));
        setMessage('Team added to favorites!');
      } else {
        setError('Failed to add team to favorites');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    }
  };

  const removeFavoriteTeam = async (teamId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/preferences/teams/${teamId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(prev => ({
          ...prev,
          favoriteTeams: data.favoriteTeams
        }));
        setMessage('Team removed from favorites!');
      } else {
        setError('Failed to remove team from favorites');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    }
  };

  const removeFavoriteLeague = (leagueToRemove) => {
    setPreferences(prev => ({
      ...prev,
      favoriteLeagues: prev.favoriteLeagues.filter(league => league !== leagueToRemove)
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, margin: '0 auto', padding: 3, mt: 10 }}>
      <Paper elevation={3} sx={{ padding: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            My Profile
          </Typography>
          {!editing ? (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEditing(true)}
            >
              Edit Profile
            </Button>
          ) : (
            <Box>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveProfile}
                disabled={saving}
                sx={{ mr: 1 }}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
            </Box>
          )}
        </Box>

        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Grid container spacing={3}>
          {/* Profile Section */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Personal Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} md={3}>
            <Box display="flex" flexDirection="column" alignItems="center">
              <Avatar
                sx={{ width: 100, height: 100, mb: 2 }}
                src={profile.avatar}
              >
                {profile.firstName?.[0]}{profile.lastName?.[0]}
              </Avatar>
              {editing && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PhotoCameraIcon />}
                >
                  Change Photo
                </Button>
              )}
            </Box>
          </Grid>

          <Grid item xs={12} md={9}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={profile.firstName}
                  onChange={(e) => setProfile(prev => ({ ...prev, firstName: e.target.value }))}
                  disabled={!editing}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={profile.lastName}
                  onChange={(e) => setProfile(prev => ({ ...prev, lastName: e.target.value }))}
                  disabled={!editing}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth disabled={!editing}>
                  <InputLabel>Timezone</InputLabel>
                  <Select
                    value={profile.timezone}
                    onChange={(e) => setProfile(prev => ({ ...prev, timezone: e.target.value }))}
                    label="Timezone"
                  >
                    {timezones.map(tz => (
                      <MenuItem key={tz} value={tz}>{tz}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Grid>

          {/* Preferences Section */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Preferences
            </Typography>
            <Divider sx={{ mb: 2 }} />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Default City"
              value={preferences.defaultLocation.city}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                defaultLocation: { ...prev.defaultLocation, city: e.target.value }
              }))}
              disabled={!editing}
              sx={{ mb: 2 }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Default Country"
              value={preferences.defaultLocation.country}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                defaultLocation: { ...prev.defaultLocation, country: e.target.value }
              }))}
              disabled={!editing}
              sx={{ mb: 2 }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Search Radius (km)"
              type="number"
              value={preferences.defaultSearchRadius}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                defaultSearchRadius: parseInt(e.target.value) || 100
              }))}
              disabled={!editing}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth disabled={!editing}>
              <InputLabel>Currency</InputLabel>
              <Select
                value={preferences.currency}
                onChange={(e) => setPreferences(prev => ({ ...prev, currency: e.target.value }))}
                label="Currency"
              >
                {currencies.map(currency => (
                  <MenuItem key={currency} value={currency}>{currency}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Favorite Teams */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Favorite Teams
            </Typography>
            
            {/* Team Search - only show when editing */}
            {editing && (
              <Box sx={{ mb: 2 }}>
                <TeamSearch
                  onTeamSelect={handleTeamSelect}
                  placeholder="Search and add teams to your favorites..."
                  selectedTeams={preferences.favoriteTeams}
                />
              </Box>
            )}
            
            {/* Display favorite teams */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {preferences.favoriteTeams.map((favoriteTeam, index) => {
                // Handle both old string format and new object format
                const team = favoriteTeam.teamId || favoriteTeam;
                const teamName = typeof team === 'string' ? team : team.name;
                const teamId = typeof team === 'string' ? null : team._id;
                
                return (
                  <Chip
                    key={index}
                    label={teamName}
                    onDelete={editing ? () => removeFavoriteTeam(teamId || teamName) : undefined}
                    color="primary"
                    variant="outlined"
                    sx={{
                      '& .MuiChip-label': {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }
                    }}
                  />
                );
              })}
              {preferences.favoriteTeams.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  {editing ? 'Search and add teams to your favorites above' : 'No favorite teams selected'}
                </Typography>
              )}
            </Box>
          </Grid>

          {/* Favorite Leagues */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Favorite Leagues
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {preferences.favoriteLeagues.map((league, index) => (
                <Chip
                  key={index}
                  label={league}
                  onDelete={editing ? () => removeFavoriteLeague(league) : undefined}
                  color="secondary"
                  variant="outlined"
                />
              ))}
              {preferences.favoriteLeagues.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No favorite leagues selected
                </Typography>
              )}
            </Box>
          </Grid>

          {/* Notification Settings */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Notification Settings
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.notifications.email}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, email: e.target.checked }
                  }))}
                  disabled={!editing}
                />
              }
              label="Email Notifications"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.notifications.matchReminders}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, matchReminders: e.target.checked }
                  }))}
                  disabled={!editing}
                />
              }
              label="Match Reminders"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.notifications.priceAlerts}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    notifications: { ...prev.notifications, priceAlerts: e.target.checked }
                  }))}
                  disabled={!editing}
                />
              }
              label="Price Alerts"
            />
          </Grid>

          {/* Want to Go - Saved Matches */}
          <WantToGoSection />
        </Grid>
      </Paper>
    </Box>
  );
};

export default Profile; 