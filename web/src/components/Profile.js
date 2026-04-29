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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PhotoCamera as PhotoCameraIcon
} from '@mui/icons-material';
import { useAuth } from './Auth';
import { getBackendUrl } from '../utils/api';

const Profile = () => {
  const { logout } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

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

      const response = await fetch(`${getBackendUrl()}/api/preferences`, {
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
      const profileResponse = await fetch(`${getBackendUrl()}/api/preferences/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profile)
      });

      // Save preferences
      const preferencesResponse = await fetch(`${getBackendUrl()}/api/preferences`, {
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setError('Type DELETE in the box to confirm permanent account deletion.');
      return;
    }
    setDeletingAccount(true);
    setError('');
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/auth/me`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setDeleteDialogOpen(false);
        setDeleteConfirmText('');
        logout();
        return;
      }
      setError(data.error || 'Could not delete account. Try again or contact support.');
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setDeletingAccount(false);
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

          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Account
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary" paragraph>
              Permanently delete your account and associated personal data (profile, trips, preferences,
              device tokens, and linked records). This cannot be undone.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              onClick={() => {
                setDeleteConfirmText('');
                setDeleteDialogOpen(true);
              }}
            >
              Delete my account
            </Button>
          </Grid>

        </Grid>
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={() => !deletingAccount && setDeleteDialogOpen(false)}>
        <DialogTitle>Delete account?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This will permanently remove your account and personal information from our systems, including
            trips, saved matches, preferences, and push notification registration. Feedback you submitted may
            be kept in anonymized form without your name or email.
          </DialogContentText>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Type <strong>DELETE</strong> to confirm:
          </Typography>
          <TextField
            fullWidth
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE"
            disabled={deletingAccount}
            autoComplete="off"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deletingAccount}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteAccount}
            color="error"
            variant="contained"
            disabled={deletingAccount || deleteConfirmText !== 'DELETE'}
          >
            {deletingAccount ? 'Deleting…' : 'Delete forever'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Profile; 