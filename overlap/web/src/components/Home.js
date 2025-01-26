import React, { useState } from 'react';
import axios from 'axios';
import { 
    Container, 
    Paper, 
    Button, 
    Typography,
    Box,
    Grid,
    CircularProgress,
    IconButton
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
import Map from './Map';

const Home = () => {
    const [dates, setDates] = useState({
        departure: null,
        return: null
    });
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const today = startOfToday();

    const handleDepartureDateChange = (newValue) => {
        setDates(prev => {
            // If return date exists and is before the new departure date, clear it
            const newReturn = prev.return && isAfter(newValue, prev.return) ? null : prev.return;
            return {
                departure: newValue,
                return: newReturn
            };
        });
    };

    const handleReturnDateChange = (newValue) => {
        setDates(prev => ({
            ...prev,
            return: newValue
        }));
    };

    const handleLocationChange = (newValue) => {
        setSelectedLocation(newValue);
    };

    const handleSearch = async () => {
        if (dates.departure && dates.return) {
            setLoading(true);
            setError(null);
            const formattedDates = {
                departure: format(dates.departure, 'yyyy-MM-dd'),
                return: format(dates.return, 'yyyy-MM-dd')
            };
            
            try {
                const response = await axios.get(
                    `/v4/competitions/PL/matches?dateFrom=${formattedDates.departure}&dateTo=${formattedDates.return}`,
                    {
                        headers: {
                            'X-Auth-Token': '2a9e46d07879477e9e4b1506101a299f'
                        }
                    }
                );
                setMatches(response.data.matches || []);
            } catch (err) {
                setError('Failed to fetch matches. Please try again.');
                console.error('Error fetching matches:', err);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <Container maxWidth="lg">
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    py: 4,
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
                                        value={selectedLocation}
                                        onChange={handleLocationChange}
                                    />
                                </Box>
                                <Map />
                            </Grid>
                            <Grid item xs={12}>
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <DatePicker
                                                label="Departure Date"
                                                value={dates.departure}
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
                                                value={dates.return}
                                                onChange={handleReturnDateChange}
                                                minDate={dates.departure || today}
                                                disabled={!dates.departure}
                                                sx={{ width: '100%' }}
                                                slotProps={{
                                                    textField: {
                                                        helperText: dates.departure ? 'Select your return date' : 'Select departure date first'
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
                                    disabled={!dates.departure || !dates.return || loading}
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
                                    {loading ? <CircularProgress size={24} color="inherit" /> : 'Search Matches'}
                                </Button>
                            </Grid>
                        </Grid>
                    </Box>
                </Paper>

                {error && (
                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Typography color="error">{error}</Typography>
                    </Box>
                )}

                {!loading && matches.length === 0 && dates.departure && dates.return && !error && (
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
                                No Premier League matches are scheduled between {format(dates.departure, 'MMMM d')} and {format(dates.return, 'MMMM d, yyyy')}.
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

                {matches.length > 0 && (
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
                        <Matches matches={matches} />
                    </Box>
                )}
            </Box>
        </Container>
    );
};

export default Home; 