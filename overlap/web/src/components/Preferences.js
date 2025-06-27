import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Button,
  Box,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import TeamSearch from './TeamSearch';

const Preferences = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [preferences, setPreferences] = useState({
    favoriteTeams: [],
    favoriteLeagues: []
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view your preferences');
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
        setPreferences({
          favoriteTeams: data.preferences?.favoriteTeams || [],
          favoriteLeagues: data.preferences?.favoriteLeagues || []
        });
      } else {
        setError('Failed to load preferences data');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:3001/api/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });

      if (response.ok) {
        setMessage('Preferences updated successfully!');
        setEditing(false);
        fetchUserData(); // Refresh data
      } else {
        setError('Failed to update preferences');
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
      setPreferences({
        favoriteTeams: user.preferences?.favoriteTeams || [],
        favoriteLeagues: user.preferences?.favoriteLeagues || []
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
            My Preferences
          </Typography>
          {!editing ? (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEditing(true)}
            >
              Edit Preferences
            </Button>
          ) : (
            <Box>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSavePreferences}
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
          {/* Favorite Teams */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Favorite Teams
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
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
            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Favorite Leagues
            </Typography>
            <Divider sx={{ mb: 2 }} />
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
        </Grid>
      </Paper>
    </Box>
  );
};

export default Preferences; 