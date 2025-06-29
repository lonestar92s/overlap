import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Button,
  Chip,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ImageList,
  ImageListItem,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Fab,
  Paper,
  Divider,
  Avatar,
  Stack
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Photo as PhotoIcon,
  PhotoCamera as PhotoCameraIcon,
  Stadium as StadiumIcon,
  CalendarToday as CalendarIcon,
  SportsSoccer as SoccerIcon,
  LocationOn as LocationIcon,
  Filter as FilterIcon,
  Close as CloseIcon,
  ArrowBackIos as ArrowBackIcon,
  ArrowForwardIos as ArrowForwardIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import AddAttendedMatch from './AddAttendedMatch';
import { formatAttendedMatchDate } from '../utils/timezone';

// Media Carousel Component for displaying multiple photos/videos
const MediaCarousel = ({ photos, onPhotoClick }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  if (!photos || photos.length === 0) return null;

  const currentMedia = photos[currentIndex];
  const mediaUrl = `http://localhost:3001${currentMedia.filename || currentMedia}`;
  const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl);

  return (
    <Box sx={{ position: 'relative', height: 200, overflow: 'hidden' }}>
      {isVideo ? (
        <video
          src={mediaUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            cursor: 'pointer'
          }}
          onClick={onPhotoClick}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
          muted
          loop
          onMouseEnter={(e) => e.target.play()}
          onMouseLeave={(e) => e.target.pause()}
        />
      ) : (
        <Box
          component="img"
          src={mediaUrl}
          alt={`Match media ${currentIndex + 1}`}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            cursor: 'pointer'
          }}
          onClick={onPhotoClick}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      )}

      {/* Navigation arrows - only show if more than 1 photo */}
      {photos.length > 1 && (
        <>
          <IconButton
            onClick={handlePrevious}
            sx={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'rgba(0, 0, 0, 0.6)',
              color: 'white',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.8)'
              },
              width: 32,
              height: 32
            }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          
          <IconButton
            onClick={handleNext}
            sx={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'rgba(0, 0, 0, 0.6)',
              color: 'white',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.8)'
              },
              width: 32,
              height: 32
            }}
          >
            <ArrowForwardIcon fontSize="small" />
          </IconButton>

          {/* Photo indicator dots */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 0.5,
              bgcolor: 'rgba(0, 0, 0, 0.6)',
              borderRadius: 2,
              px: 1,
              py: 0.5
            }}
          >
            {photos.map((_, index) => (
              <Box
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: index === currentIndex ? 'white' : 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
              />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

const AttendedMatches = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    competition: '',
    year: '',
    venue: '',
    country: ''
  });
  const [stats, setStats] = useState({
    totalMatches: 0,
    uniqueStadiums: 0,
    uniqueCountries: 0,
    competitions: []
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [matchToEdit, setMatchToEdit] = useState(null);

  useEffect(() => {
    fetchAttendedMatches();
  }, []);

  const fetchAttendedMatches = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/matches/attended', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setMatches(data.data);
        calculateStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching attended matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (matchList) => {
    const uniqueStadiums = new Set();
    const uniqueCountries = new Set();
    const competitions = new Set();

    matchList.forEach(match => {
      if (match.venue?.name) uniqueStadiums.add(match.venue.name);
      if (match.venue?.country) uniqueCountries.add(match.venue.country);
      if (match.competition) competitions.add(match.competition);
    });

    setStats({
      totalMatches: matchList.length,
      uniqueStadiums: uniqueStadiums.size,
      uniqueCountries: uniqueCountries.size,
      competitions: Array.from(competitions)
    });
  };

  const handleAddMatch = (newMatch) => {
    const updatedMatches = [newMatch, ...matches];
    setMatches(updatedMatches);
    calculateStats(updatedMatches);
  };

  const handleDeleteClick = (match) => {
    setMatchToDelete(match);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!matchToDelete) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/matches/attended/${matchToDelete._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const updatedMatches = matches.filter(match => match._id !== matchToDelete._id);
        setMatches(updatedMatches);
        calculateStats(updatedMatches);
      }
    } catch (error) {
      console.error('Error deleting match:', error);
    } finally {
      setDeleteDialogOpen(false);
      setMatchToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setMatchToDelete(null);
  };

  const handleEditClick = (match) => {
    setMatchToEdit(match);
    setEditDialogOpen(true);
  };

  const handleEditSave = async (updatedMatch) => {
    try {
      const token = localStorage.getItem('token');
      
      // Check if we have new photos to upload
      if (updatedMatch.newPhotos && updatedMatch.newPhotos.length > 0) {
        // Use FormData for photo uploads
        const formData = new FormData();
        
        // Add text fields
        formData.append('userScore', updatedMatch.userScore || '');
        formData.append('userNotes', updatedMatch.userNotes || '');
        formData.append('venue', JSON.stringify(updatedMatch.venue));
        formData.append('competition', updatedMatch.competition || '');
        formData.append('date', updatedMatch.date);
        formData.append('existingPhotos', JSON.stringify(updatedMatch.photos || []));
        
        // Add new photo files
        updatedMatch.newPhotos.forEach(photo => {
          formData.append('photos', photo.file);
        });

        const response = await fetch(`http://localhost:3001/api/matches/attended/${updatedMatch._id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          const updatedMatches = matches.map(match => 
            match._id === updatedMatch._id ? data.data : match
          );
          setMatches(updatedMatches);
          calculateStats(updatedMatches);
          setEditDialogOpen(false);
          setMatchToEdit(null);
        }
      } else {
        // No new photos, use regular JSON update
        const response = await fetch(`http://localhost:3001/api/matches/attended/${updatedMatch._id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userScore: updatedMatch.userScore,
            userNotes: updatedMatch.userNotes,
            venue: updatedMatch.venue,
            competition: updatedMatch.competition,
            date: updatedMatch.date,
            photos: updatedMatch.photos // Include updated existing photos list
          })
        });

        if (response.ok) {
          const data = await response.json();
          const updatedMatches = matches.map(match => 
            match._id === updatedMatch._id ? data.data : match
          );
          setMatches(updatedMatches);
          calculateStats(updatedMatches);
          setEditDialogOpen(false);
          setMatchToEdit(null);
        }
      }
    } catch (error) {
      console.error('Error updating match:', error);
    }
  };

  const handleEditCancel = () => {
    setEditDialogOpen(false);
    setMatchToEdit(null);
  };

  const applyFilters = () => {
    return matches.filter(match => {
      if (filters.competition && match.competition !== filters.competition) return false;
      if (filters.year && new Date(match.date).getFullYear().toString() !== filters.year) return false;
      if (filters.venue && match.venue?.name !== filters.venue) return false;
      if (filters.country && match.venue?.country !== filters.country) return false;
      return true;
    });
  };

  const filteredMatches = applyFilters();

  const getUniqueValues = (field) => {
    const values = new Set();
    matches.forEach(match => {
      if (field === 'year') {
        values.add(new Date(match.date).getFullYear().toString());
      } else if (field === 'venue') {
        if (match.venue?.name) values.add(match.venue.name);
      } else if (field === 'country') {
        if (match.venue?.country) values.add(match.venue.country);
      } else if (field === 'competition') {
        if (match.competition) values.add(match.competition);
      }
    });
    return Array.from(values).sort();
  };

  const clearFilters = () => {
    setFilters({
      competition: '',
      year: '',
      venue: '',
      country: ''
    });
    setFilterDialogOpen(false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Typography>Loading your attended matches...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, mt: '64px' }}> {/* Add margin top to account for fixed header */}
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', sm: 'center' }, 
        mb: 3,
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 2, sm: 0 }
      }}>
        <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
          Memories
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' } }}>
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setFilterDialogOpen(true)}
            sx={{ flex: { xs: 1, sm: 'none' } }}
          >
            Filter
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
            sx={{ flex: { xs: 1, sm: 'none' } }}
          >
            Add Match
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={6} md={3}>
          <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
            <SoccerIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" component="div" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
              {stats.totalMatches}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
              Total Matches
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
            <StadiumIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'secondary.main', mb: 1 }} />
            <Typography variant="h4" component="div" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
              {stats.uniqueStadiums}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
              Unique Stadiums
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
            <LocationIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'success.main', mb: 1 }} />
            <Typography variant="h4" component="div" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
              {stats.uniqueCountries}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
              Countries Visited
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Paper sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
            <CalendarIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'warning.main', mb: 1 }} />
            <Typography variant="h4" component="div" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
              {stats.competitions.length}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
              Competitions
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Matches List */}
      {filteredMatches.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: { xs: 6, sm: 8 } }}>
          <StadiumIcon sx={{ fontSize: { xs: 60, sm: 80 }, color: 'grey.300', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
            {matches.length === 0 ? "No matches added yet" : "No matches match your filters"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
            {matches.length === 0 
              ? "Start building your football memory collection!"
              : "Try adjusting your filters or clearing them."
            }
          </Typography>
          {matches.length === 0 ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
              sx={{ px: { xs: 3, sm: 4 } }}
            >
              Add Your First Match
            </Button>
          ) : (
            <Button variant="outlined" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={{ xs: 2, sm: 3 }}>
          {filteredMatches.map((match) => (
            <Grid item xs={12} sm={6} lg={4} key={match._id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {match.photos && match.photos.length > 0 && (
                  <MediaCarousel 
                    photos={match.photos}
                    onPhotoClick={() => {
                      setSelectedMatch(match);
                      setPhotoDialogOpen(true);
                    }}
                  />
                )}
                
                <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flexGrow: 1, pr: 1 }}>
                      <Typography 
                        variant="h6" 
                        component="div" 
                        gutterBottom
                        sx={{ 
                          fontSize: { xs: '1rem', sm: '1.25rem' },
                          lineHeight: 1.2
                        }}
                      >
                        {match.homeTeam.name} vs {match.awayTeam.name}
                      </Typography>
                      
                      {match.userScore && (
                        <Chip 
                          label={match.userScore} 
                          size="small" 
                          color="primary" 
                          sx={{ mb: 1, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                        />
                      )}
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleEditClick(match)}
                        color="primary"
                        sx={{ p: { xs: 0.5, sm: 1 } }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(match)}
                        color="error"
                        sx={{ p: { xs: 0.5, sm: 1 } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StadiumIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        {match.venue?.name || 'Unknown Stadium'}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocationIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        {match.venue?.city && match.venue?.country 
                          ? `${match.venue.city}, ${match.venue.country}`
                          : 'Unknown Location'
                        }
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        {formatAttendedMatchDate(match.date, match.venue)}
                      </Typography>
                    </Box>
                  </Stack>

                  <Box sx={{ mt: 2 }}>
                    <Chip 
                      label={match.competition} 
                      size="small" 
                      variant="outlined"
                    />
                    {match.photos && match.photos.length > 0 && (
                      <Chip 
                        label={`${match.photos.length} media file${match.photos.length > 1 ? 's' : ''}`}
                        size="small" 
                        variant="outlined"
                        icon={<PhotoIcon />}
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Box>

                  {match.userNotes && (
                    <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
                      "{match.userNotes}"
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add Match Dialog */}
      <AddAttendedMatch
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSave={handleAddMatch}
      />

      {/* Media Dialog */}
      <Dialog
        open={photoDialogOpen}
        onClose={() => setPhotoDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {selectedMatch && `${selectedMatch.homeTeam.name} vs ${selectedMatch.awayTeam.name}`}
            <IconButton onClick={() => setPhotoDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedMatch && selectedMatch.photos && selectedMatch.photos.length > 0 && (
            <ImageList variant="masonry" cols={3} gap={8}>
              {selectedMatch.photos.map((photo, index) => {
                const mediaUrl = `http://localhost:3001${photo.filename || photo}`;
                const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl);
                
                return (
                  <ImageListItem key={index}>
                    {isVideo ? (
                      <video
                        src={mediaUrl}
                        controls
                        style={{ borderRadius: 8, maxWidth: '100%' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <img
                        src={mediaUrl}
                        alt={`Match media ${index + 1}`}
                        loading="lazy"
                        style={{ borderRadius: 8 }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                  </ImageListItem>
                );
              })}
            </ImageList>
          )}
        </DialogContent>
      </Dialog>

      {/* Filter Dialog */}
      <Dialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Filter Matches</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Competition</InputLabel>
              <Select
                value={filters.competition}
                onChange={(e) => setFilters(prev => ({ ...prev, competition: e.target.value }))}
                label="Competition"
              >
                <MenuItem value="">All Competitions</MenuItem>
                {getUniqueValues('competition').map(comp => (
                  <MenuItem key={comp} value={comp}>{comp}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Year</InputLabel>
              <Select
                value={filters.year}
                onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
                label="Year"
              >
                <MenuItem value="">All Years</MenuItem>
                {getUniqueValues('year').map(year => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Stadium</InputLabel>
              <Select
                value={filters.venue}
                onChange={(e) => setFilters(prev => ({ ...prev, venue: e.target.value }))}
                label="Stadium"
              >
                <MenuItem value="">All Stadiums</MenuItem>
                {getUniqueValues('venue').map(venue => (
                  <MenuItem key={venue} value={venue}>{venue}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Country</InputLabel>
              <Select
                value={filters.country}
                onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
                label="Country"
              >
                <MenuItem value="">All Countries</MenuItem>
                {getUniqueValues('country').map(country => (
                  <MenuItem key={country} value={country}>{country}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={clearFilters}>Clear All</Button>
          <Button onClick={() => setFilterDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => setFilterDialogOpen(false)} variant="contained">
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Match Dialog */}
      <EditMatchDialog
        open={editDialogOpen}
        match={matchToEdit}
        onSave={handleEditSave}
        onCancel={handleEditCancel}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteIcon color="error" />
            Delete Match
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to delete this match?
          </Typography>
          {matchToDelete && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                {matchToDelete.homeTeam.name} vs {matchToDelete.awayTeam.name}
              </Typography>
              {matchToDelete.venue?.name && (
                <Typography variant="body2" color="text.secondary">
                  {matchToDelete.venue.name}
                </Typography>
              )}
              {matchToDelete.date && (
                <Typography variant="body2" color="text.secondary">
                  {formatAttendedMatchDate(matchToDelete.date, matchToDelete.venue)}
                </Typography>
              )}
              {matchToDelete.photos && matchToDelete.photos.length > 0 && (
                <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                  ⚠️ This will also delete {matchToDelete.photos.length} photo{matchToDelete.photos.length > 1 ? 's' : ''}
                </Typography>
              )}
            </Box>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            variant="contained" 
            color="error"
            startIcon={<DeleteIcon />}
          >
            Delete Match
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Edit Match Dialog Component
const EditMatchDialog = ({ open, match, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    venue: { name: '', city: '', country: '' },
    competition: '',
    date: null,
    userScore: '',
    userNotes: ''
  });
  const [newPhotos, setNewPhotos] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);

  useEffect(() => {
    if (match) {
      setFormData({
        venue: match.venue || { name: '', city: '', country: '' },
        competition: match.competition || '',
        date: match.date ? new Date(match.date) : null,
        userScore: match.userScore || '',
        userNotes: match.userNotes || ''
      });
      setExistingPhotos(match.photos || []);
      setNewPhotos([]);
    }
  }, [match]);

  const handleSave = () => {
    if (match) {
      onSave({
        ...match,
        ...formData,
        photos: existingPhotos,
        newPhotos: newPhotos
      });
    }
  };

  const handlePhotoUpload = (event) => {
    const files = Array.from(event.target.files);
    const currentTotalPhotos = existingPhotos.length + newPhotos.length;
    const maxPhotos = 10;
    const availableSlots = maxPhotos - currentTotalPhotos;
    
    if (availableSlots <= 0) {
      alert(`You can only have up to ${maxPhotos} photos/videos per match.`);
      return;
    }
    
    const filesToProcess = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      alert(`Only adding ${availableSlots} file(s). You can have a maximum of ${maxPhotos} photos/videos per match.`);
    }
    
    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setNewPhotos(prev => [...prev, {
          file: file,
          preview: e.target.result,
          name: file.name
        }]);
      };
      reader.readAsDataURL(file);
    });
    
    // Clear the input so the same files can be selected again if needed
    event.target.value = '';
  };

  const removeExistingPhoto = (index) => {
    setExistingPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const removeNewPhoto = (index) => {
    setNewPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleVenueChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      venue: {
        ...prev.venue,
        [field]: value
      }
    }));
  };

  if (!match) return null;

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon color="primary" />
          Edit Match
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {/* Match Info (Read-only) */}
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
              {match.homeTeam.name} vs {match.awayTeam.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This match information cannot be changed
            </Typography>
          </Box>

          {/* Editable Fields */}
          <TextField
            label="Stadium"
            value={formData.venue.name}
            onChange={(e) => handleVenueChange('name', e.target.value)}
            fullWidth
            placeholder="e.g., Emirates Stadium"
          />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="City"
              value={formData.venue.city}
              onChange={(e) => handleVenueChange('city', e.target.value)}
              fullWidth
              placeholder="e.g., London"
            />
            <TextField
              label="Country"
              value={formData.venue.country}
              onChange={(e) => handleVenueChange('country', e.target.value)}
              fullWidth
              placeholder="e.g., England"
            />
          </Box>

          <TextField
            label="Competition"
            value={formData.competition}
            onChange={(e) => handleFieldChange('competition', e.target.value)}
            fullWidth
            placeholder="e.g., Premier League, Champions League"
          />

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Match Date"
              value={formData.date}
              onChange={(date) => handleFieldChange('date', date)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </LocalizationProvider>

          <TextField
            label="Score"
            placeholder="2-1 or Arsenal 2-1 Chelsea"
            value={formData.userScore}
            onChange={(e) => handleFieldChange('userScore', e.target.value)}
            fullWidth
          />
          
          <TextField
            label="Notes"
            placeholder="Amazing atmosphere, first time at this stadium..."
            value={formData.userNotes}
            onChange={(e) => handleFieldChange('userNotes', e.target.value)}
            multiline
            rows={3}
            fullWidth
          />

          {/* Media Upload Section */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Photos & Videos
            </Typography>
            
            {/* Existing Photos */}
            {existingPhotos.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Current Media
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {existingPhotos.map((photo, index) => {
                    const mediaUrl = `http://localhost:3001${photo.filename || photo}`;
                    const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(mediaUrl);
                    return (
                      <Box key={index} sx={{ position: 'relative' }}>
                        {isVideo ? (
                          <video
                            src={mediaUrl}
                            style={{
                              width: 80,
                              height: 80,
                              objectFit: 'cover',
                              borderRadius: 4,
                              border: '1px solid #ddd'
                            }}
                            muted
                            loop
                            onMouseEnter={(e) => e.target.play()}
                            onMouseLeave={(e) => e.target.pause()}
                            onError={(e) => {
                              console.error('Error loading video:', mediaUrl);
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <img
                            src={mediaUrl}
                            alt={`Match media ${index + 1}`}
                            style={{
                              width: 80,
                              height: 80,
                              objectFit: 'cover',
                              borderRadius: 4,
                              border: '1px solid #ddd'
                            }}
                            onError={(e) => {
                              console.error('Error loading image:', mediaUrl);
                              e.target.style.display = 'none';
                            }}
                          />
                        )}
                        <IconButton
                          size="small"
                          onClick={() => removeExistingPhoto(index)}
                          sx={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            bgcolor: 'error.main',
                            color: 'white',
                            '&:hover': { bgcolor: 'error.dark' },
                            width: 20,
                            height: 20
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* New Photos */}
            {newPhotos.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  New Media to Add
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {newPhotos.map((photo, index) => {
                    const isVideo = photo.file.type.startsWith('video/');
                    return (
                      <Box key={index} sx={{ position: 'relative' }}>
                        {isVideo ? (
                          <video
                            src={photo.preview}
                            style={{
                              width: 80,
                              height: 80,
                              objectFit: 'cover',
                              borderRadius: 4,
                              border: '2px solid #1976d2'
                            }}
                            muted
                            loop
                            onMouseEnter={(e) => e.target.play()}
                            onMouseLeave={(e) => e.target.pause()}
                          />
                        ) : (
                          <img
                            src={photo.preview}
                            alt={`New media ${index + 1}`}
                            style={{
                              width: 80,
                              height: 80,
                              objectFit: 'cover',
                              borderRadius: 4,
                              border: '2px solid #1976d2'
                            }}
                          />
                        )}
                        <IconButton
                          size="small"
                          onClick={() => removeNewPhoto(index)}
                          sx={{
                            position: 'absolute',
                            top: -8,
                            right: -8,
                            bgcolor: 'error.main',
                            color: 'white',
                            '&:hover': { bgcolor: 'error.dark' },
                            width: 20,
                            height: 20
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* Upload Button */}
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {existingPhotos.length + newPhotos.length} of 10 photos/videos
                </Typography>
                {(existingPhotos.length + newPhotos.length) >= 10 && (
                  <Typography variant="body2" color="warning.main">
                    Maximum reached
                  </Typography>
                )}
              </Box>
              <Button
                variant="outlined"
                component="label"
                startIcon={<PhotoCameraIcon />}
                disabled={(existingPhotos.length + newPhotos.length) >= 10}
                fullWidth
              >
                {(existingPhotos.length + newPhotos.length) >= 10 
                  ? 'Maximum Photos Reached' 
                  : 'Add Photos & Videos'
                }
                <input
                  type="file"
                  hidden
                  multiple
                  accept="image/*,video/*"
                  onChange={handlePhotoUpload}
                />
              </Button>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          startIcon={<EditIcon />}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AttendedMatches; 