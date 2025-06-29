import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Chip,
  IconButton,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  PhotoCamera as PhotoIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import TeamSearch from './TeamSearch';
import { formatMatchDateTime } from '../utils/timezone';

const AddAttendedMatch = ({ open, onClose, onSave }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [searchMode, setSearchMode] = useState('search'); // 'search' or 'manual'
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loading, setLoading] = useState(false);

  // Search form state
  const [searchForm, setSearchForm] = useState({
    homeTeam: null,
    awayTeam: null,
    dateFrom: null,
    dateTo: null
  });

  // Manual form state
  const [manualForm, setManualForm] = useState({
    homeTeam: { name: '', logo: '' },
    awayTeam: { name: '', logo: '' },
    venue: { name: '', city: '', country: '' },
    competition: '',
    date: null,
    userScore: '',
    userNotes: ''
  });

  // Photo state
  const [photos, setPhotos] = useState([]);

  const steps = ['Find Match', 'Match Details', 'Add Media'];

  const handleSearchMatches = async () => {
    if (!searchForm.homeTeam && !searchForm.awayTeam) {
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchForm.homeTeam) params.append('homeTeam', searchForm.homeTeam.name);
      if (searchForm.awayTeam) params.append('awayTeam', searchForm.awayTeam.name);
      if (searchForm.dateFrom) params.append('dateFrom', searchForm.dateFrom.toISOString().split('T')[0]);
      if (searchForm.dateTo) params.append('dateTo', searchForm.dateTo.toISOString().split('T')[0]);

      const response = await fetch(`http://localhost:3001/v4/matches/search?${params}`);
      const data = await response.json();

      if (data.success) {
        setSearchResults(data.data.matches);
        if (data.data.matches.length === 0) {
          // No matches found, suggest manual entry
          setSearchMode('manual');
        }
      }
    } catch (error) {
      console.error('Error searching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMatch = (match) => {
    setSelectedMatch({
      matchType: 'api',
      homeTeam: match.teams.home,
      awayTeam: match.teams.away,
      venue: match.fixture.venue || { name: '', city: '', country: '' },
      competition: match.league.name || '',
      date: match.fixture.date ? new Date(match.fixture.date) : null,
      userScore: match.goals.home !== null ? `${match.goals.home}-${match.goals.away}` : '',
      userNotes: '',
      apiMatchData: {
        fixtureId: match.fixture.id,
        officialScore: match.goals.home !== null ? `${match.goals.home}-${match.goals.away}` : '',
        status: match.fixture.status,
        leagueId: match.league.id
      }
    });
    setActiveStep(1);
  };

  const handleManualEntry = () => {
    // Pre-populate with search form data if available
    setSelectedMatch({
      matchType: 'manual',
      homeTeam: searchForm.homeTeam || manualForm.homeTeam,
      awayTeam: searchForm.awayTeam || manualForm.awayTeam,
      venue: manualForm.venue,
      competition: manualForm.competition,
      date: manualForm.date,
      userScore: manualForm.userScore,
      userNotes: manualForm.userNotes
    });
    setActiveStep(1);
  };

  const handlePhotoUpload = (event) => {
    const files = Array.from(event.target.files);
    const maxPhotos = 10;
    const availableSlots = maxPhotos - photos.length;
    
    if (availableSlots <= 0) {
      alert(`You can only have up to ${maxPhotos} photos/videos per match.`);
      return;
    }
    
    const filesToProcess = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      alert(`Only adding ${filesToProcess.length} file(s). You can have a maximum of ${maxPhotos} photos/videos per match.`);
    }
    
    setPhotos(prev => [...prev, ...filesToProcess]);
    
    // Clear the input so the same files can be selected again if needed
    event.target.value = '';
  };

  const handleRemovePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedMatch) return;

    const formData = new FormData();
    
    // Add match data
    formData.append('matchType', selectedMatch.matchType);
    formData.append('homeTeam', JSON.stringify(selectedMatch.homeTeam));
    formData.append('awayTeam', JSON.stringify(selectedMatch.awayTeam));
    formData.append('venue', JSON.stringify(selectedMatch.venue));
    formData.append('competition', selectedMatch.competition);
    
    // Handle date properly - only add if it exists
    if (selectedMatch.date) {
      formData.append('date', selectedMatch.date.toISOString());
    }
    
    formData.append('userScore', selectedMatch.userScore || '');
    formData.append('userNotes', selectedMatch.userNotes || '');
    
    if (selectedMatch.apiMatchData) {
      formData.append('apiMatchData', JSON.stringify(selectedMatch.apiMatchData));
    }

    // Add photos
    photos.forEach(photo => {
      formData.append('photos', photo);
    });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/matches/attended', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        onSave(data.data);
        handleClose();
      }
    } catch (error) {
      console.error('Error saving attended match:', error);
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    setSearchMode('search');
    setSearchResults([]);
    setSelectedMatch(null);
    setSearchForm({ homeTeam: null, awayTeam: null, dateFrom: null, dateTo: null });
    setManualForm({
      homeTeam: { name: '', logo: '' },
      awayTeam: { name: '', logo: '' },
      venue: { name: '', city: '', country: '' },
      competition: '',
      date: null,
      userScore: '',
      userNotes: ''
    });
    setPhotos([]);
    onClose();
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button
                variant={searchMode === 'search' ? 'contained' : 'outlined'}
                onClick={() => setSearchMode('search')}
                startIcon={<SearchIcon />}
              >
                Search Matches
              </Button>
              <Button
                variant={searchMode === 'manual' ? 'contained' : 'outlined'}
                onClick={() => setSearchMode('manual')}
                startIcon={<EditIcon />}
              >
                Manual Entry
              </Button>
            </Box>

            {searchMode === 'search' ? (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Search for Match
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      Home Team {searchForm.homeTeam && (
                        <Chip 
                          label={searchForm.homeTeam.name} 
                          size="small" 
                          color="primary" 
                          onDelete={() => setSearchForm(prev => ({ ...prev, homeTeam: null }))}
                          sx={{ ml: 1 }} 
                        />
                      )}
                    </Typography>
                    <TeamSearch
                      placeholder="Search for home team..."
                      onTeamSelect={(team) => setSearchForm(prev => ({ ...prev, homeTeam: team }))}
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      Away Team {searchForm.awayTeam && (
                        <Chip 
                          label={searchForm.awayTeam.name} 
                          size="small" 
                          color="secondary" 
                          onDelete={() => setSearchForm(prev => ({ ...prev, awayTeam: null }))}
                          sx={{ ml: 1 }} 
                        />
                      )}
                    </Typography>
                    <TeamSearch
                      placeholder="Search for away team..."
                      onTeamSelect={(team) => setSearchForm(prev => ({ ...prev, awayTeam: team }))}
                    />
                  </Box>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <DatePicker
                        label="Date From"
                        value={searchForm.dateFrom}
                        onChange={(date) => setSearchForm(prev => ({ ...prev, dateFrom: date }))}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                      <DatePicker
                        label="Date To"
                        value={searchForm.dateTo}
                        onChange={(date) => setSearchForm(prev => ({ ...prev, dateTo: date }))}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                    </Box>
                  </LocalizationProvider>
                  <Button
                    variant="contained"
                    onClick={handleSearchMatches}
                    disabled={!searchForm.homeTeam && !searchForm.awayTeam || loading}
                  >
                    {loading ? 'Searching...' : 'Search Matches'}
                  </Button>
                </Box>

                {searchResults.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Found {searchResults.length} matches
                    </Typography>
                    {searchResults.map((match, index) => (
                      <Card key={index} sx={{ mb: 2, cursor: 'pointer' }} onClick={() => handleSelectMatch(match)}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="subtitle1">
                                {match.teams.home.name} vs {match.teams.away.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {(() => {
                  const { fullDateTime, timeZone } = formatMatchDateTime(match.fixture.date, match.fixture.venue);
                  return `${match.fixture.venue.name} • ${fullDateTime} ${timeZone}`;
                })()}
                              </Typography>
                            </Box>
                            <Chip label={match.league.name} size="small" />
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}

                {searchResults.length === 0 && (searchForm.homeTeam || searchForm.awayTeam) && !loading && (
                  <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      No matches found. Try adjusting your search or use manual entry.
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Enter Match Details
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {(searchForm.homeTeam || searchForm.awayTeam) 
                    ? "Fill in any missing details from your search" 
                    : "At minimum, you need to specify the two teams"
                  }
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Home Team"
                      value={manualForm.homeTeam.name}
                      onChange={(e) => setManualForm(prev => ({
                        ...prev,
                        homeTeam: { ...prev.homeTeam, name: e.target.value }
                      }))}
                      fullWidth
                      placeholder={searchForm.homeTeam ? searchForm.homeTeam.name : "e.g., Arsenal"}
                    />
                    <TextField
                      label="Away Team"
                      value={manualForm.awayTeam.name}
                      onChange={(e) => setManualForm(prev => ({
                        ...prev,
                        awayTeam: { ...prev.awayTeam, name: e.target.value }
                      }))}
                      fullWidth
                      placeholder={searchForm.awayTeam ? searchForm.awayTeam.name : "e.g., Chelsea"}
                    />
                  </Box>
                  <TextField
                    label="Stadium (optional)"
                    value={manualForm.venue.name}
                    onChange={(e) => setManualForm(prev => ({
                      ...prev,
                      venue: { ...prev.venue, name: e.target.value }
                    }))}
                    fullWidth
                    placeholder="e.g., Emirates Stadium"
                  />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="City (optional)"
                      value={manualForm.venue.city}
                      onChange={(e) => setManualForm(prev => ({
                        ...prev,
                        venue: { ...prev.venue, city: e.target.value }
                      }))}
                      fullWidth
                      placeholder="e.g., London"
                    />
                    <TextField
                      label="Country (optional)"
                      value={manualForm.venue.country}
                      onChange={(e) => setManualForm(prev => ({
                        ...prev,
                        venue: { ...prev.venue, country: e.target.value }
                      }))}
                      fullWidth
                      placeholder="e.g., England"
                    />
                  </Box>
                  <TextField
                    label="Competition (optional)"
                    value={manualForm.competition}
                    onChange={(e) => setManualForm(prev => ({ ...prev, competition: e.target.value }))}
                    fullWidth
                    placeholder="e.g., Premier League"
                  />
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Match Date (optional)"
                      value={manualForm.date}
                      onChange={(date) => setManualForm(prev => ({ ...prev, date }))}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                  <Button
                    variant="contained"
                    onClick={handleManualEntry}
                    disabled={
                      (!manualForm.homeTeam.name && !searchForm.homeTeam) || 
                      (!manualForm.awayTeam.name && !searchForm.awayTeam)
                    }
                  >
                    Continue
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Match Details
            </Typography>
            {selectedMatch && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Required fields are marked with *
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Required Team Fields */}
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="Home Team *"
                      value={selectedMatch.homeTeam?.name || ''}
                      onChange={(e) => setSelectedMatch(prev => ({ 
                        ...prev, 
                        homeTeam: { ...prev.homeTeam, name: e.target.value }
                      }))}
                      required
                      fullWidth
                      error={!selectedMatch.homeTeam?.name}
                      helperText={!selectedMatch.homeTeam?.name ? "Home team is required" : ""}
                    />
                    <TextField
                      label="Away Team *"
                      value={selectedMatch.awayTeam?.name || ''}
                      onChange={(e) => setSelectedMatch(prev => ({ 
                        ...prev, 
                        awayTeam: { ...prev.awayTeam, name: e.target.value }
                      }))}
                      required
                      fullWidth
                      error={!selectedMatch.awayTeam?.name}
                      helperText={!selectedMatch.awayTeam?.name ? "Away team is required" : ""}
                    />
                  </Box>

                  {/* Optional Venue Fields */}
                  <TextField
                    label="Stadium (optional)"
                    value={selectedMatch.venue?.name || ''}
                    onChange={(e) => setSelectedMatch(prev => ({ 
                      ...prev, 
                      venue: { ...prev.venue, name: e.target.value }
                    }))}
                    fullWidth
                    placeholder="e.g., Emirates Stadium"
                  />
                  
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField
                      label="City (optional)"
                      value={selectedMatch.venue?.city || ''}
                      onChange={(e) => setSelectedMatch(prev => ({ 
                        ...prev, 
                        venue: { ...prev.venue, city: e.target.value }
                      }))}
                      fullWidth
                      placeholder="e.g., London"
                    />
                    <TextField
                      label="Country (optional)"
                      value={selectedMatch.venue?.country || ''}
                      onChange={(e) => setSelectedMatch(prev => ({ 
                        ...prev, 
                        venue: { ...prev.venue, country: e.target.value }
                      }))}
                      fullWidth
                      placeholder="e.g., England"
                    />
                  </Box>

                  {/* Optional Match Details */}
                  <TextField
                    label="Competition (optional)"
                    value={selectedMatch.competition || ''}
                    onChange={(e) => setSelectedMatch(prev => ({ ...prev, competition: e.target.value }))}
                    fullWidth
                    placeholder="e.g., Premier League, Champions League"
                  />

                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Match Date (optional)"
                      value={selectedMatch.date}
                      onChange={(date) => setSelectedMatch(prev => ({ ...prev, date }))}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>

                  <TextField
                    label="Score (optional)"
                    placeholder="2-1 or Arsenal 2-1 Chelsea"
                    value={selectedMatch.userScore || ''}
                    onChange={(e) => setSelectedMatch(prev => ({ ...prev, userScore: e.target.value }))}
                    fullWidth
                  />
                  
                  <TextField
                    label="Notes (optional)"
                    placeholder="Amazing atmosphere, first time at this stadium..."
                    value={selectedMatch.userNotes || ''}
                    onChange={(e) => setSelectedMatch(prev => ({ ...prev, userNotes: e.target.value }))}
                    multiline
                    rows={3}
                    fullWidth
                  />
                </Box>
              </Box>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Add Photos & Videos
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {photos.length} of 10 photos/videos
                </Typography>
                {photos.length >= 10 && (
                  <Typography variant="body2" color="warning.main">
                    Maximum reached
                  </Typography>
                )}
              </Box>
              <input
                accept="image/*,video/*"
                style={{ display: 'none' }}
                id="photo-upload"
                multiple
                type="file"
                onChange={handlePhotoUpload}
              />
              <label htmlFor="photo-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<PhotoIcon />}
                  disabled={photos.length >= 10}
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  {photos.length >= 10 ? 'Maximum Photos Reached' : 'Add Photos & Videos'}
                </Button>
              </label>

              {photos.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {photos.map((photo, index) => {
                    const isVideo = photo.type.startsWith('video/');
                    return (
                      <Box key={index} sx={{ position: 'relative' }}>
                        {isVideo ? (
                          <video
                            src={URL.createObjectURL(photo)}
                            style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8 }}
                            muted
                            loop
                            onMouseEnter={(e) => e.target.play()}
                            onMouseLeave={(e) => e.target.pause()}
                          />
                        ) : (
                          <img
                            src={URL.createObjectURL(photo)}
                            alt={`Media ${index + 1}`}
                            style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8 }}
                          />
                        )}
                        <IconButton
                          size="small"
                          sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'white' }}
                          onClick={() => handleRemovePhoto(index)}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>

            {selectedMatch && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Review Match Details
                  </Typography>
                  <Typography><strong>Match:</strong> {selectedMatch.homeTeam?.name || 'Unknown'} vs {selectedMatch.awayTeam?.name || 'Unknown'}</Typography>
                  {selectedMatch.venue?.name && <Typography><strong>Stadium:</strong> {selectedMatch.venue.name}</Typography>}
                  {(selectedMatch.venue?.city || selectedMatch.venue?.country) && (
                    <Typography><strong>Location:</strong> {[selectedMatch.venue?.city, selectedMatch.venue?.country].filter(Boolean).join(', ')}</Typography>
                  )}
                  {selectedMatch.competition && <Typography><strong>Competition:</strong> {selectedMatch.competition}</Typography>}
                  {selectedMatch.date && <Typography><strong>Date:</strong> {formatMatchDateTime(selectedMatch.date.toISOString(), selectedMatch.venue).fullDate}</Typography>}
                  {selectedMatch.userScore && <Typography><strong>Score:</strong> {selectedMatch.userScore}</Typography>}
                  {selectedMatch.userNotes && <Typography><strong>Notes:</strong> {selectedMatch.userNotes}</Typography>}
                  <Typography><strong>Media:</strong> {photos.length} file(s)</Typography>
                </CardContent>
              </Card>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      disablePortal={false}
      style={{ zIndex: 99999 }}
      BackdropProps={{
        style: { zIndex: 99998 }
      }}
      PaperProps={{
        style: { zIndex: 99999, position: 'relative' }
      }}
      sx={{
        zIndex: '99999 !important', // Ensure modal appears above header nav
        '& .MuiBackdrop-root': {
          zIndex: '99998 !important'
        },
        '& .MuiDialog-paper': {
          zIndex: '99999 !important',
          position: 'relative'
        },
        '& .MuiDialog-container': {
          zIndex: '99999 !important'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Add Match I've Been To
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {renderStepContent()}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {activeStep > 0 && (
          <Button onClick={() => setActiveStep(prev => prev - 1)}>
            Back
          </Button>
        )}
        {activeStep < steps.length - 1 && selectedMatch && (
          <Button 
            onClick={() => setActiveStep(prev => prev + 1)} 
            variant="contained"
            disabled={!selectedMatch.homeTeam?.name || !selectedMatch.awayTeam?.name}
          >
            Next
          </Button>
        )}
        {activeStep === steps.length - 1 && (
          <Button 
            onClick={handleSave} 
            variant="contained"
            disabled={!selectedMatch?.homeTeam?.name || !selectedMatch?.awayTeam?.name}
          >
            Save Match
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AddAttendedMatch; 