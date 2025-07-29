import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Card,
  CardContent,
  IconButton,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemIcon,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Check as CheckIcon,
  FlightTakeoff as TripIcon,
  AccessTime as AccessTimeIcon,
  LocationOn as LocationIcon,
  Stadium as StadiumIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { formatMatchDateTime } from '../utils/timezone';
import TeamLogo from './TeamLogo';

const TripModal = ({ open, onClose, match, onMatchAddedToTrip }) => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (open) {
      fetchTrips();
    }
  }, [open]);

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/trips', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTrips(data.trips);
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
      setError('Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  const createTrip = async () => {
    if (!newTripName.trim()) {
      setError('Trip name is required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/trips', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newTripName.trim(),
          matches: match ? [{
            matchId: match.fixture.id.toString(),
            homeTeam: {
              name: match.teams.home.name,
              logo: match.teams.home.logo
            },
            awayTeam: {
              name: match.teams.away.name,
              logo: match.teams.away.logo
            },
            league: match.league.name,
            venue: `${match.fixture.venue.name}, ${match.fixture.venue.city}`,
            date: match.fixture.date
          }] : []
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTrips(prev => [...prev, data.trip]);
        setNewTripName('');
        setSuccess(`Trip "${data.trip.name}" created successfully!`);
        
        // Notify parent that match was added to trip
        if (match && onMatchAddedToTrip) {
          onMatchAddedToTrip(match.fixture.id);
        }
        
        // Close modal after a short delay
        setTimeout(() => {
          onClose();
          setSuccess('');
        }, 1500);
      } else {
        setError('Failed to create trip');
      }
    } catch (error) {
      console.error('Error creating trip:', error);
      setError('Failed to create trip');
    } finally {
      setCreating(false);
    }
  };

  const addMatchToTrip = async (tripId) => {
    if (!match) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/trips/${tripId}/matches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          matchId: match.fixture.id.toString(),
          homeTeam: {
            name: match.teams.home.name,
            logo: match.teams.home.logo
          },
          awayTeam: {
            name: match.teams.away.name,
            logo: match.teams.away.logo
          },
          league: match.league.name,
          venue: `${match.fixture.venue.name}, ${match.fixture.venue.city}`,
          date: match.fixture.date
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTrips(prev => prev.map(trip => 
          trip._id === tripId ? data.trip : trip
        ));
        setSuccess('Match added to trip!');
        
        // Notify parent that match was added to trip
        if (onMatchAddedToTrip) {
          onMatchAddedToTrip(match.fixture.id);
        }
        
        // Close modal after a short delay
        setTimeout(() => {
          onClose();
          setSuccess('');
        }, 1500);
      } else {
        setError('Failed to add match to trip');
      }
    } catch (error) {
      console.error('Error adding match to trip:', error);
      setError('Failed to add match to trip');
    }
  };

  const isMatchInTrip = (trip) => {
    if (!match) return false;
    return trip.matches.some(m => m.matchId === match.fixture.id.toString());
  };

  const handleClose = () => {
    setNewTripName('');
    setError('');
    setSuccess('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      disablePortal={false}
      sx={{
        zIndex: 10000, // Ensure modal appears above header nav
        '& .MuiBackdrop-root': {
          zIndex: 9999
        },
        '& .MuiDialog-paper': {
          zIndex: 10001,
          position: 'relative'
        },
        '& .MuiDialog-container': {
          zIndex: 10000
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TripIcon color="primary" />
            <Typography variant="h6">Save to Trip</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {match && (
          <Card sx={{ mb: 3, border: '1px solid #e0e0e0' }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TeamLogo 
                      src={match.teams.home.logo} 
                      alt={match.teams.home.name}
                      teamName={match.teams.home.name}
                      size={20}
                    />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {match.teams.home.name}
                    </Typography>
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mx: 0.5 }}>
                    vs
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TeamLogo 
                      src={match.teams.away.logo} 
                      alt={match.teams.away.name}
                      teamName={match.teams.away.name}
                      size={20}
                    />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {match.teams.away.name}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AccessTimeIcon sx={{ mr: 0.5, color: '#666', fontSize: 16 }} />
                  <Typography variant="body2" color="text.secondary">
                    {(() => {
                      const { fullDateTime, timeZone } = formatMatchDateTime(match.fixture.date, match.fixture.venue);
                      return `${fullDateTime} ${timeZone}`;
                    })()}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <StadiumIcon sx={{ mr: 0.5, color: '#666', fontSize: 16 }} />
                <Typography variant="body2" color="text.secondary">
                  {match.fixture.venue.name}, {match.fixture.venue.city}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Existing Trips */}
            {trips.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Add to existing trip
                </Typography>
                <List sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {trips.map((trip) => (
                    <ListItem key={trip._id} disablePadding>
                      <ListItemButton 
                        onClick={() => addMatchToTrip(trip._id)}
                        disabled={isMatchInTrip(trip)}
                        sx={{
                          border: '1px solid #e0e0e0',
                          borderRadius: 1,
                          mb: 1,
                          '&:hover': {
                            backgroundColor: '#f5f5f5'
                          }
                        }}
                      >
                        <ListItemIcon>
                          {isMatchInTrip(trip) ? (
                            <CheckIcon color="success" />
                          ) : (
                            <TripIcon color="action" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={trip.name}
                          secondary={`${trip.matches.length} match${trip.matches.length !== 1 ? 'es' : ''}`}
                        />
                        {isMatchInTrip(trip) && (
                          <Chip 
                            label="Added" 
                            size="small" 
                            color="success" 
                            variant="outlined"
                          />
                        )}
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Create New Trip */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Create new trip
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  placeholder="e.g., London 2025 boys trip"
                  value={newTripName}
                  onChange={(e) => setNewTripName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      createTrip();
                    }
                  }}
                  disabled={creating}
                />
                <Button
                  variant="contained"
                  onClick={createTrip}
                  disabled={creating || !newTripName.trim()}
                  startIcon={creating ? <CircularProgress size={16} /> : <AddIcon />}
                  sx={{ minWidth: 100 }}
                >
                  {creating ? 'Creating...' : 'Create'}
                </Button>
              </Box>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TripModal; 