import React from 'react';
import axios from 'axios';
import { 
    Container, 
    Paper, 
    Button, 
    Typography,
    Box,
    Grid,
    CircularProgress
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { TuneRounded } from '@mui/icons-material';
import format from 'date-fns/format';
import startOfToday from 'date-fns/startOfToday';
import isAfter from 'date-fns/isAfter';
import Matches from './Matches';
import LocationAutocomplete from './LocationAutocomplete';
import HeaderNav from './HeaderNav';
// import Map from './Map'; // Keeping import commented for later use

const Home = ({ searchState, setSearchState }) => {
    const today = startOfToday();

    const handleDepartureDateChange = (newValue) => {
        setSearchState(prev => ({
            ...prev,
            dates: {
                departure: newValue,
                return: prev.dates.return && isAfter(newValue, prev.dates.return) ? null : prev.dates.return
            }
        }));
    };

    const handleReturnDateChange = (newValue) => {
        setSearchState(prev => ({
            ...prev,
            dates: {
                ...prev.dates,
                return: newValue
            }
        }));
    };

    const handleLocationChange = (newValue) => {
        setSearchState(prev => ({
            ...prev,
            location: newValue
        }));
    };

    const handleSearch = async () => {
        if (searchState.dates.departure && searchState.dates.return) {
            setSearchState(prev => ({ ...prev, loading: true, error: null }));
            const formattedDates = {
                departure: format(searchState.dates.departure, 'yyyy-MM-dd'),
                return: format(searchState.dates.return, 'yyyy-MM-dd')
            };
            
            // Log search parameters
            console.log('Performing search with:', {
                location: searchState.location ? {
                    city: searchState.location.city,
                    region: searchState.location.region,
                    country: searchState.location.country,
                    coordinates: [searchState.location.lon, searchState.location.lat]
                } : 'No location selected',
                dates: formattedDates
            });
            
            try {
                const response = await axios.get(
                    `/v4/competitions/PL/matches?dateFrom=${formattedDates.departure}&dateTo=${formattedDates.return}`,
                    {
                        headers: {
                            'X-Auth-Token': '2a9e46d07879477e9e4b1506101a299f'
                        }
                    }
                );
                setSearchState(prev => ({
                    ...prev,
                    matches: response.data.matches || [],
                    loading: false
                }));
            } catch (err) {
                setSearchState(prev => ({
                    ...prev,
                    error: 'Failed to fetch matches. Please try again.',
                    loading: false
                }));
                console.error('Error fetching matches:', err);
            }
        }
    };

    return (
        <>
            <HeaderNav onHomeClick={() => setSearchState(prev => ({
                ...prev,
                dates: {
                    departure: null,
                    return: null
                },
                location: null,
                matches: [],
                loading: false,
                error: null
            }))} />
            <Container maxWidth="lg">
                <Box
                    sx={{
                        minHeight: '100vh',
                        display: 'flex',
                        flexDirection: 'column',
                        py: 4,
                        mt: 8 // Add margin top to account for fixed header
                    }}
                >
                    <Paper 
                        elevation={3}
                        sx={{
                            p: 6,
                            width: '100%',
                            maxWidth: 800,
                            borderRadius: 4,
                            textAlign: 'center',
                            mx: 'auto'
                        }}
                    >
                        <Typography 
                            variant="h2" 
                            component="h1" 
                            gutterBottom
                            sx={{ 
                                fontWeight: 800,
                                mb: 4,
                                color: '#222222',
                                fontSize: { xs: '2.5rem', md: '3.5rem' }
                            }}
                        >
                            Overlap
                            <Typography
                                variant="h2"
                                component="span"
                                sx={{
                                    display: 'block',
                                    color: '#FF385C',
                                    fontSize: { xs: '2rem', md: '3rem' },
                                    fontWeight: 700
                                }}
                            >
                                Find Premier League matches during your trip
                            </Typography>
                        </Typography>

                        <Box sx={{ mt: 6 }}>
                            <Grid container spacing={3}>
                                <Grid item xs={12}>
                                    <Box sx={{ mb: 3 }}>
                                        <LocationAutocomplete
                                            value={searchState.location}
                                            onChange={handleLocationChange}
                                        />
                                    </Box>
                                    {/* Map component removed but kept in codebase for later */}
                                </Grid>
                                <Grid item xs={12}>
                                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} sm={6}>
                                                <DatePicker
                                                    label="Departure Date"
                                                    value={searchState.dates.departure}
                                                    onChange={handleDepartureDateChange}
                                                    minDate={today}
                                                    sx={{ width: '100%' }}
                                                    slotProps={{
                                                        textField: {
                                                            helperText: 'Select your departure date'
                                                        }
                                                    }}
                                                />
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <DatePicker
                                                    label="Return Date"
                                                    value={searchState.dates.return}
                                                    onChange={handleReturnDateChange}
                                                    minDate={searchState.dates.departure || today}
                                                    disabled={!searchState.dates.departure}
                                                    sx={{ width: '100%' }}
                                                    slotProps={{
                                                        textField: {
                                                            helperText: searchState.dates.departure ? 'Select your return date' : 'Select departure date first'
                                                        }
                                                    }}
                                                />
                                            </Grid>
                                        </Grid>
                                    </LocalizationProvider>
                                </Grid>
                                <Grid item xs={12}>
                                    <Button
                                        variant="contained"
                                        onClick={handleSearch}
                                        disabled={!searchState.dates.departure || !searchState.dates.return || searchState.loading}
                                        sx={{
                                            mt: 2,
                                            py: 1.5,
                                            px: 6,
                                            borderRadius: 2,
                                            backgroundColor: '#FF385C',
                                            '&:hover': {
                                                backgroundColor: '#E61E4D'
                                            }
                                        }}
                                    >
                                        {searchState.loading ? <CircularProgress size={24} color="inherit" /> : 'Search Matches'}
                                    </Button>
                                </Grid>
                            </Grid>
                        </Box>
                    </Paper>

                    {searchState.error && (
                        <Box sx={{ mt: 4, textAlign: 'center' }}>
                            <Typography color="error">{searchState.error}</Typography>
                        </Box>
                    )}

                    {!searchState.loading && searchState.matches.length === 0 && searchState.dates.departure && searchState.dates.return && !searchState.error && (
                        <Box sx={{ mt: 4, textAlign: 'center' }}>
                            <Paper 
                                elevation={1}
                                sx={{ 
                                    p: 4, 
                                    borderRadius: 2,
                                    backgroundColor: '#FFF8F9'
                                }}
                            >
                                <Typography 
                                    variant="h6"
                                    sx={{ 
                                        color: '#666',
                                        fontWeight: 500
                                    }}
                                >
                                    No Premier League matches are scheduled between {format(searchState.dates.departure, 'MMMM d')} and {format(searchState.dates.return, 'MMMM d, yyyy')}.
                                </Typography>
                                <Typography 
                                    sx={{ 
                                        mt: 1,
                                        color: '#888'
                                    }}
                                >
                                    Try selecting different dates to find matches.
                                </Typography>
                            </Paper>
                        </Box>
                    )}

                    {searchState.matches.length > 0 && (
                        <Box sx={{ mt: 4 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<TuneRounded />}
                                    sx={{
                                        borderColor: '#DDD',
                                        color: '#666',
                                        '&:hover': {
                                            borderColor: '#999',
                                            backgroundColor: '#F5F5F5'
                                        }
                                    }}
                                >
                                    Filters
                                </Button>
                            </Box>
                            <Matches matches={searchState.matches} />
                        </Box>
                    )}
                </Box>
            </Container>
        </>
    );
};

export default Home; 