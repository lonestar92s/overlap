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
  Card,
  CardContent,
  IconButton,
  Chip,
  CardActions
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  FavoriteBorder as FavoriteBorderIcon,
  AccessTime as AccessTimeIcon,
  LocationOn as LocationOnIcon,
  Stadium as StadiumIcon,
  FlightTakeoff as TripIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { formatMatchDateTime } from '../utils/timezone';
import useVisitedStadiums from '../hooks/useVisitedStadiums';
import TripModal from './TripModal';

// Component for displaying trips
const TripsSection = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tripModalOpen, setTripModalOpen] = useState(false);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

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
    } finally {
      setLoading(false);
    }
  };

  const deleteTrip = async (tripId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`http://localhost:3001/api/trips/${tripId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setTrips(prev => prev.filter(trip => trip._id !== tripId));
      }
    } catch (error) {
      console.error('Error deleting trip:', error);
    }
  };

  const removeMatchFromTrip = async (tripId, matchId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`http://localhost:3001/api/trips/${tripId}/matches/${matchId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTrips(prev => prev.map(trip => 
          trip._id === tripId ? data.trip : trip
        ));
      }
    } catch (error) {
      console.error('Error removing match from trip:', error);
    }
  };

  return (
    <>
      <Grid item xs={12}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            My Trips
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setTripModalOpen(true)}
            size="small"
          >
            Create Trip
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        
        {loading ? (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            {trips.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No trips yet. Create your first trip to organize matches you're interested in!
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {trips.map((trip) => (
                  <Grid item xs={12} md={6} key={trip._id}>
                    <Card sx={{ border: '1px solid #e0e0e0', height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <CardContent sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <TripIcon sx={{ mr: 1, color: '#FF385C', fontSize: 20 }} />
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {trip.name}
                          </Typography>
                        </Box>
                        
                        {trip.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {trip.description}
                          </Typography>
                        )}

                        <Box sx={{ mb: 2 }}>
                          <Chip 
                            label={`${trip.matches.length} match${trip.matches.length !== 1 ? 'es' : ''}`}
                            size="small" 
                            variant="outlined"
                            color="primary"
                          />
                          {trip.createdAt && (
                            <Chip 
                              label={`Created ${format(new Date(trip.createdAt), 'MMM d, yyyy')}`}
                              size="small" 
                              variant="outlined"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Box>

                        {trip.matches.length > 0 && (
                          <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                              Matches:
                            </Typography>
                            {trip.matches
                              .filter(match => {
                                const matchDate = new Date(match.date);
                                return !isNaN(matchDate.getTime());
                              })
                              .slice(0, 3) // Show first 3 matches
                              .map((match, index) => {
                                // Try to parse venue information for timezone conversion
                                // Note: Trip matches may not have full venue data with coordinates
                                const venue = match.venue ? 
                                  (typeof match.venue === 'string' ? { name: match.venue } : match.venue) : 
                                  null;
                                
                                const { date: formattedDate, time: formattedTime, timeZone } = 
                                  formatMatchDateTime(match.date, venue);
                              
                                return (
                                  <Box key={index} sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    py: 0.5,
                                    borderBottom: index < Math.min(trip.matches.length, 3) - 1 ? '1px solid #f0f0f0' : 'none'
                                  }}>
                                    <Box sx={{ flex: 1 }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <img 
                                          src={match.homeTeam.logo} 
                                          alt={match.homeTeam.name}
                                          style={{ 
                                            width: 16, 
                                            height: 16, 
                                            objectFit: 'contain'
                                          }}
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                          }}
                                        />
                                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                          {match.homeTeam.name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ mx: 0.5 }}>
                                          vs
                                        </Typography>
                                        <img 
                                          src={match.awayTeam.logo} 
                                          alt={match.awayTeam.name}
                                          style={{ 
                                            width: 16, 
                                            height: 16, 
                                            objectFit: 'contain'
                                          }}
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                          }}
                                        />
                                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                          {match.awayTeam.name}
                                        </Typography>
                                      </Box>
                                      <Typography variant="caption" color="text.secondary">
                                        {formattedDate} at {formattedTime} {timeZone}
                                      </Typography>
                                    </Box>
                                    <IconButton
                                      size="small"
                                      onClick={() => removeMatchFromTrip(trip._id, match.matchId)}
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
                                );
                              })}
                            {trip.matches.length > 3 && (
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                +{trip.matches.length - 3} more match{trip.matches.length - 3 !== 1 ? 'es' : ''}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </CardContent>
                      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => {
                            // TODO: Add edit trip functionality
                            console.log('Edit trip:', trip._id);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => deleteTrip(trip._id)}
                        >
                          Delete
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}
      </Grid>

      <TripModal
        open={tripModalOpen}
        onClose={() => {
          setTripModalOpen(false);
          fetchTrips(); // Refresh trips after modal closes
        }}
        match={null} // No specific match when creating from trips page
        onMatchAddedToTrip={() => {}} // No-op since no specific match context
      />
    </>
  );
};

// Component for displaying saved matches (legacy)
const MatchesInterestedInSection = () => {
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

  return (
    <Grid item xs={12}>
      <Typography variant="h6" gutterBottom>
        Individual Matches (Legacy)
      </Typography>
      <Divider sx={{ mb: 2 }} />
      
      {loading ? (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          {savedMatches.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No saved matches yet. Heart matches you're interested in to see them here!
            </Typography>
          ) : (
            <Box>
              {savedMatches
                .filter(match => {
                  const matchDate = new Date(match.date);
                  return !isNaN(matchDate.getTime());
                })
                .map((match) => {
                  // Try to parse venue information for timezone conversion
                  const venue = match.venue ? 
                    (typeof match.venue === 'string' ? { name: match.venue } : match.venue) : 
                    null;
                  
                  const { fullDate: formattedDate, time: formattedTime, timeZone } = 
                    formatMatchDateTime(match.date, venue);
                
                return (
                  <Card key={match.matchId} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <FavoriteBorderIcon sx={{ mr: 1, color: '#FF385C', fontSize: 20 }} />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <img 
                                  src={match.homeTeam.logo} 
                                  alt={match.homeTeam.name}
                                  style={{ 
                                    width: 20, 
                                    height: 20, 
                                    objectFit: 'contain'
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                  {match.homeTeam.name}
                                </Typography>
                              </Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600, mx: 0.5 }}>
                                vs
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <img 
                                  src={match.awayTeam.logo} 
                                  alt={match.awayTeam.name}
                                  style={{ 
                                    width: 20, 
                                    height: 20, 
                                    objectFit: 'contain'
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                  {match.awayTeam.name}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <AccessTimeIcon sx={{ mr: 0.5, color: '#666', fontSize: 16 }} />
                              <Typography variant="body2" color="text.secondary">
                                {formattedDate} at {formattedTime} {timeZone}
                              </Typography>
                            </Box>
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <StadiumIcon sx={{ mr: 0.5, color: '#666', fontSize: 16 }} />
                            <Typography variant="body2" color="text.secondary">
                              {typeof match.venue === 'string' ? match.venue : match.venue?.name || 'Unknown Venue'}
                            </Typography>
                          </Box>
                        </Box>
                        
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
        </Box>
      )}
    </Grid>
  );
};

// Component for displaying visited stadiums
const VisitedStadiumsSection = () => {
  // Use shared visited stadiums hook
  const { visitedStadiums, loading, removeVisitedStadium } = useVisitedStadiums();

  return (
    <Grid item xs={12}>
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Stadiums I've Been To
      </Typography>
      <Divider sx={{ mb: 2 }} />
      
      {loading ? (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          {visitedStadiums.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No visited stadiums yet. Click the stadium icon on matches to mark stadiums you've been to!
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {visitedStadiums.map((stadium) => (
                <Card key={stadium.venueId} sx={{ minWidth: 250, border: '1px solid #e0e0e0' }}>
                  <CardContent sx={{ pb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <StadiumIcon sx={{ mr: 1, color: '#4CAF50', fontSize: 20 }} />
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {stadium.venueName}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <LocationOnIcon sx={{ mr: 0.5, color: '#666', fontSize: 16 }} />
                          <Typography variant="body2" color="text.secondary">
                            {stadium.city}, {stadium.country}
                          </Typography>
                        </Box>
                        
                        {stadium.visitedDate && (() => {
                          try {
                            const visitedDate = new Date(stadium.visitedDate);
                            if (!isNaN(visitedDate.getTime())) {
                              return (
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                  Visited: {format(visitedDate, 'MMM d, yyyy')}
                                </Typography>
                              );
                            }
                          } catch (error) {
                            console.error('Error formatting visited date:', error);
                          }
                          return null;
                        })()}
                      </Box>
                      
                      <IconButton
                        size="small"
                        onClick={() => removeVisitedStadium(stadium.venueId)}
                        sx={{
                          color: '#666',
                          '&:hover': {
                            color: '#f44336',
                            backgroundColor: 'rgba(244, 67, 54, 0.04)'
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Grid>
  );
};

const Trips = () => {
  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto', padding: { xs: 2, sm: 3 }, mt: { xs: 8, sm: 10 } }}>
      <Paper elevation={3} sx={{ padding: { xs: 3, sm: 4 } }}>
        <Typography variant="h4" component="h1" mb={3} sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
          My Trips
        </Typography>

        <Grid container spacing={{ xs: 2, sm: 3 }}>
          {/* Trips Section */}
          <TripsSection />
          
          {/* Divider */}
          <Grid item xs={12}>
            <Divider sx={{ my: { xs: 2, sm: 3 } }} />
          </Grid>
          
          {/* Legacy: Matches I'm Interested In */}
          <MatchesInterestedInSection />
          
          {/* Visited Stadiums */}
          <VisitedStadiumsSection />
        </Grid>
      </Paper>
    </Box>
  );
};

export default Trips; 