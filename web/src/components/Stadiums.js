import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  CircularProgress,
  Button,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  Stadium as StadiumIcon,
  LocationOn as LocationOnIcon,
  Clear as ClearIcon,
  CheckCircle as CheckCircleIcon,
  People as PeopleIcon,
  Sports as SportsIcon,
  EmojiEvents as EmojiEventsIcon,
  Add as AddIcon
} from '@mui/icons-material';
import useVisitedStadiums from '../hooks/useVisitedStadiums';

const Stadiums = () => {
  const [stadiums, setStadiums] = useState([]);
  const [filteredStadiums, setFilteredStadiums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('');
  const [countries, setCountries] = useState([]);
  const [leagues, setLeagues] = useState([]);
  
  const { visitedStadiums, isStadiumVisited, handleStadiumClick } = useVisitedStadiums();

  useEffect(() => {
    fetchStadiums();
  }, []);

  useEffect(() => {
    filterStadiums();
  }, [stadiums, searchTerm, selectedCountry, selectedLeague]);

  const fetchStadiums = async () => {
    try {
      // For now, we'll create a mock list since we don't have a venues endpoint yet
      const mockStadiums = generateMockStadiums();
      setStadiums(mockStadiums);
      
      // Extract unique countries and leagues
      const uniqueCountries = [...new Set(mockStadiums.map(s => s.country))].sort();
      const uniqueLeagues = [...new Set(mockStadiums.map(s => s.league))].sort();
      setCountries(uniqueCountries);
      setLeagues(uniqueLeagues);
    } catch (error) {
      console.error('Error fetching stadiums:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMockStadiums = () => {
    return [
      {
        id: 'emirates-stadium',
        name: 'Emirates Stadium',
        city: 'London',
        country: 'England',
        league: 'Premier League',
        team: 'Arsenal FC',
        capacity: 60704
      },
      {
        id: 'old-trafford',
        name: 'Old Trafford',
        city: 'Manchester',
        country: 'England',
        league: 'Premier League',
        team: 'Manchester United FC',
        capacity: 74879
      },
      {
        id: 'camp-nou',
        name: 'Spotify Camp Nou',
        city: 'Barcelona',
        country: 'Spain',
        league: 'La Liga',
        team: 'FC Barcelona',
        capacity: 99354
      },
      {
        id: 'santiago-bernabeu',
        name: 'Santiago Bernabéu',
        city: 'Madrid',
        country: 'Spain',
        league: 'La Liga',
        team: 'Real Madrid CF',
        capacity: 81044
      },
      {
        id: 'allianz-arena',
        name: 'Allianz Arena',
        city: 'Munich',
        country: 'Germany',
        league: 'Bundesliga',
        team: 'FC Bayern München',
        capacity: 75024
      },
      {
        id: 'san-siro',
        name: 'San Siro',
        city: 'Milan',
        country: 'Italy',
        league: 'Serie A',
        team: 'AC Milan / Inter Milan',
        capacity: 75923
      }
    ];
  };

  const filterStadiums = () => {
    let filtered = stadiums;

    if (searchTerm) {
      filtered = filtered.filter(stadium => 
        stadium.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stadium.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stadium.team.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCountry) {
      filtered = filtered.filter(stadium => stadium.country === selectedCountry);
    }

    if (selectedLeague) {
      filtered = filtered.filter(stadium => stadium.league === selectedLeague);
    }

    setFilteredStadiums(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCountry('');
    setSelectedLeague('');
  };

  const handleStadiumVisit = (stadium) => {
    // Create a mock match object for the stadium click handler
    const mockMatch = {
      fixture: {
        venue: {
          id: stadium.id,
          name: stadium.name,
          city: stadium.city,
          country: stadium.country
        }
      }
    };
    
    handleStadiumClick(mockMatch);
  };

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1200, margin: '0 auto', padding: 3, mt: 10 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto', padding: { xs: 2, sm: 3 }, mt: { xs: 8, sm: 10 } }}>
      <Paper elevation={3} sx={{ padding: { xs: 3, sm: 4 } }}>
        <Typography variant="h4" component="h1" mb={3} sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
          Football Stadiums
        </Typography>

        {/* Search and Filter Controls */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2, 
          mb: 3,
          alignItems: { xs: 'stretch', sm: 'center' }
        }}>
          <TextField
            placeholder="Search stadiums..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 120 } }}>
            <InputLabel>Country</InputLabel>
            <Select
              value={selectedCountry}
              label="Country"
              onChange={(e) => setSelectedCountry(e.target.value)}
            >
              <MenuItem value="">All Countries</MenuItem>
              {countries.map((country) => (
                <MenuItem key={country} value={country}>
                  {country}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 120 } }}>
            <InputLabel>League</InputLabel>
            <Select
              value={selectedLeague}
              label="League"
              onChange={(e) => setSelectedLeague(e.target.value)}
            >
              <MenuItem value="">All Leagues</MenuItem>
              {leagues.map((league) => (
                <MenuItem key={league} value={league}>
                  {league}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing {filteredStadiums.length} of {stadiums.length} stadiums
        </Typography>

        {/* Stadiums Grid */}
        <Grid container spacing={{ xs: 2, sm: 3 }}>
          {filteredStadiums.map((stadium) => {
            // Create mock match object for the visited check
            const mockMatch = {
              fixture: {
                venue: {
                  id: stadium.id,
                  name: stadium.name,
                  city: stadium.city,
                  country: stadium.country
                }
              }
            };
            const visited = isStadiumVisited(mockMatch);
            
            return (
              <Grid item xs={12} sm={6} md={4} key={stadium.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    border: visited ? '2px solid #4CAF50' : '1px solid #e0e0e0',
                    cursor: 'pointer',
                    '&:hover': {
                      boxShadow: 3,
                      transform: { xs: 'none', sm: 'translateY(-2px)' }
                    },
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => handleStadiumVisit(stadium)}
                >
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      mb: 2 
                    }}>
                      <Box sx={{ flex: 1, pr: 1 }}>
                        <Typography 
                          variant="h6" 
                          component="h3" 
                          gutterBottom
                          sx={{ 
                            fontSize: { xs: '1rem', sm: '1.25rem' },
                            lineHeight: 1.2
                          }}
                        >
                          {stadium.name}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                        >
                          {stadium.city}, {stadium.country}
                        </Typography>
                      </Box>
                      
                      {visited && (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label="Visited"
                          color="success"
                          size="small"
                          sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                        />
                      )}
                    </Box>
                    
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PeopleIcon fontSize="small" color="action" />
                        <Typography 
                          variant="body2" 
                          color="text.secondary"
                          sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                        >
                          Capacity: {stadium.capacity?.toLocaleString() || 'Unknown'}
                        </Typography>
                      </Box>
                      
                      {stadium.teams && stadium.teams.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SportsIcon fontSize="small" color="action" />
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                          >
                            Home to: {stadium.teams.join(', ')}
                          </Typography>
                        </Box>
                      )}
                      
                      {stadium.league && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <EmojiEventsIcon fontSize="small" color="action" />
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                          >
                            {stadium.league}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                    
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Button
                        variant={visited ? "outlined" : "contained"}
                        color={visited ? "success" : "primary"}
                        size="small"
                        startIcon={visited ? <CheckCircleIcon /> : <AddIcon />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStadiumVisit(stadium);
                        }}
                        sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                      >
                        {visited ? 'Visited' : 'Mark as Visited'}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
        
        {filteredStadiums.length === 0 && (
          <Box sx={{ textAlign: 'center', py: { xs: 6, sm: 8 } }}>
            <StadiumIcon sx={{ fontSize: { xs: 60, sm: 80 }, color: 'grey.300', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
              No stadiums found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
              Try adjusting your search or filter criteria.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default Stadiums; 