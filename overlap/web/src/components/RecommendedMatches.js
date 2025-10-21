import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemButton
} from '@mui/material';
import {
  Recommend as RecommendIcon,
  Add as AddIcon,
  Close as CloseIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  Stadium as StadiumIcon,
  TrendingUp as TrendingUpIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { formatMatchDateTime } from '../utils/timezone';
import { recommendationAPI } from '../utils/api';
import TeamLogo from './TeamLogo';

const RecommendedMatches = ({ tripId, onMatchAdded }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [alternativeDatesOpen, setAlternativeDatesOpen] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);

  useEffect(() => {
    if (tripId) {
      fetchRecommendations();
    }
  }, [tripId]);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError('');
    
    try {
      const data = await recommendationAPI.getRecommendations(tripId);
      if (data.success) {
        setRecommendations(data.recommendations || []);
        
        // Track that user viewed recommendations
        data.recommendations?.forEach(rec => {
          trackRecommendation(rec.matchId, 'viewed', tripId, rec.recommendedForDate, rec.score, rec.reason);
        });
      } else {
        setError('Failed to load recommendations');
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const trackRecommendation = async (matchId, action, tripId, recommendedDate, score, reason) => {
    try {
      await recommendationAPI.trackRecommendation(matchId, action, tripId, recommendedDate, score, reason);
    } catch (err) {
      console.error('Error tracking recommendation:', err);
    }
  };

  const handleAddToTrip = async (recommendation) => {
    try {
      // Track that user saved the recommendation
      await trackRecommendation(
        recommendation.matchId, 
        'saved', 
        tripId, 
        recommendation.recommendedForDate, 
        recommendation.score, 
        recommendation.reason
      );

      // Call the parent callback to add match to trip
      if (onMatchAdded) {
        await onMatchAdded(recommendation.match);
      }

      // Remove the recommendation from the list
      setRecommendations(prev => prev.filter(rec => rec.matchId !== recommendation.matchId));
      
    } catch (err) {
      console.error('Error adding match to trip:', err);
      setError('Failed to add match to trip');
    }
  };

  const handleDismiss = async (recommendation) => {
    try {
      // Track that user dismissed the recommendation
      await trackRecommendation(
        recommendation.matchId, 
        'dismissed', 
        tripId, 
        recommendation.recommendedForDate, 
        recommendation.score, 
        recommendation.reason
      );

      // Remove the recommendation from the list
      setRecommendations(prev => prev.filter(rec => rec.matchId !== recommendation.matchId));
      
    } catch (err) {
      console.error('Error dismissing recommendation:', err);
    }
  };

  const handleShowAlternativeDates = (recommendation) => {
    setSelectedRecommendation(recommendation);
    setAlternativeDatesOpen(true);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'default';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Fair';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Loading recommendations...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <RecommendIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          No recommendations available
        </Typography>
        <Typography variant="body2" color="text.secondary">
          We'll suggest matches based on your saved matches when they're available.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <RecommendIcon sx={{ mr: 1, color: '#FF385C' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Recommended Matches to Check Out on Your Trip
        </Typography>
        <Chip 
          label={`${recommendations.length} recommendation${recommendations.length !== 1 ? 's' : ''}`}
          size="small"
          color="primary"
          sx={{ ml: 2 }}
        />
      </Box>

      {recommendations.map((recommendation, index) => (
        <Card key={recommendation.matchId} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TeamLogo 
                    teamName={recommendation.match.teams.home.name}
                    logo={recommendation.match.teams.home.logo}
                    size={24}
                  />
                  <Typography variant="h6" sx={{ mx: 1, fontWeight: 600 }}>
                    {recommendation.match.teams.home.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mx: 1 }}>
                    vs
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {recommendation.match.teams.away.name}
                  </Typography>
                  <TeamLogo 
                    teamName={recommendation.match.teams.away.name}
                    logo={recommendation.match.teams.away.logo}
                    size={24}
                    sx={{ ml: 1 }}
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <StadiumIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
                  <Typography variant="body2" color="text.secondary">
                    {recommendation.match.fixture.venue.name}, {recommendation.match.fixture.venue.city}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TimeIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
                  <Typography variant="body2" color="text.secondary">
                    {formatMatchDateTime(recommendation.match.fixture.date)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <LocationIcon sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />
                  <Typography variant="body2" color="text.secondary">
                    {recommendation.proximity}
                  </Typography>
                </Box>

                <Typography variant="body2" color="primary" sx={{ fontStyle: 'italic' }}>
                  💡 {recommendation.reason}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', ml: 2 }}>
                <Chip
                  label={getScoreLabel(recommendation.score)}
                  size="small"
                  color={getScoreColor(recommendation.score)}
                  sx={{ mb: 1 }}
                />
                <Typography variant="caption" color="text.secondary">
                  Score: {recommendation.score}
                </Typography>
              </Box>
            </Box>

            {recommendation.alternativeDates && recommendation.alternativeDates.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Button
                  size="small"
                  startIcon={<CalendarIcon />}
                  onClick={() => handleShowAlternativeDates(recommendation)}
                  sx={{ textTransform: 'none' }}
                >
                  View Alternative Dates ({recommendation.alternativeDates.length})
                </Button>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleAddToTrip(recommendation)}
                sx={{ 
                  backgroundColor: '#FF385C',
                  '&:hover': { backgroundColor: '#E31C5F' }
                }}
              >
                Add to Trip
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleDismiss(recommendation)}
                sx={{ textTransform: 'none' }}
              >
                Not Interested
              </Button>
            </Box>
          </CardContent>
        </Card>
      ))}

      {/* Alternative Dates Dialog */}
      <Dialog open={alternativeDatesOpen} onClose={() => setAlternativeDatesOpen(false)}>
        <DialogTitle>
          Alternative Dates for {selectedRecommendation?.match.teams.home.name} vs {selectedRecommendation?.match.teams.away.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Here are alternative dates when this match might be available:
          </Typography>
          <List>
            {selectedRecommendation?.alternativeDates.map((date, index) => (
              <ListItem key={index}>
                <ListItemButton>
                  <ListItemText
                    primary={format(new Date(date), 'EEEE, MMMM d, yyyy')}
                    secondary="Check availability for this date"
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlternativeDatesOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RecommendedMatches;

