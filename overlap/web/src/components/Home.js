import React, { useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { 
    Container, 
    Paper, 
    Button, 
    Typography,
    Box,
    Grid,
    CircularProgress,
    Fab,
    Zoom
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { TuneRounded, KeyboardArrowUp } from '@mui/icons-material';
import format from 'date-fns/format';
import startOfToday from 'date-fns/startOfToday';
import isAfter from 'date-fns/isAfter';
import Matches from './Matches';
import LocationAutocomplete from './LocationAutocomplete';
import HeaderNav from './HeaderNav';
import Map from './Map'; // Uncomment Map import
import Filters from './Filters';
import { getVenueForTeam } from '../data/venues';
import { getAllLeagues, getCountryCode, getLeaguesForCountry } from '../data/leagues';

// Helper function to calculate distance between two points using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in miles
};

const Home = ({ searchState, setSearchState }) => {
    const today = startOfToday();
    const [hasSearched, setHasSearched] = useState(false);
    const mapRef = useRef(null);
    const [showBackToTop, setShowBackToTop] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [selectedDistance, setSelectedDistance] = useState(null);
    const [selectedLeagues, setSelectedLeagues] = useState([]);
    const activeMarkerRef = useRef(null);
    const [selectedMatch, setSelectedMatch] = useState(null);

    // Add scroll listener to show/hide back to top button
    React.useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.pageYOffset > 300);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToMap = () => {
        if (mapRef.current) {
            mapRef.current.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
        }
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

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

        // Update selected leagues based on location
        if (newValue?.country) {
            const countryCode = getCountryCode(newValue.country);
            if (countryCode) {
                const countryLeagues = getLeaguesForCountry(countryCode);
                if (countryLeagues.length > 0) {
                    // If the country has leagues, select only those leagues
                    setSelectedLeagues(countryLeagues.map(l => l.id));
                } else {
                    // If no leagues in the country, show all leagues
                    setSelectedLeagues(getAllLeagues().map(l => l.id));
                }
            } else {
                // If country not supported, show all leagues
                setSelectedLeagues(getAllLeagues().map(l => l.id));
            }
        } else {
            // If no location selected, show all leagues
            setSelectedLeagues(getAllLeagues().map(l => l.id));
        }
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
                // Get all available leagues
                const leagues = getAllLeagues();

                // Fetch matches from all leagues in parallel
                const responses = await Promise.all(
                    leagues.map(league => 
                        axios.get(
                            `/v4/competitions/${league.id}/matches?dateFrom=${formattedDates.departure}&dateTo=${formattedDates.return}`,
                            {
                                headers: {
                                    'X-Auth-Token': '2a9e46d07879477e9e4b1506101a299f'
                                }
                            }
                        )
                    )
                );

                // Combine matches from all leagues
                const allMatches = responses.reduce((acc, response, index) => {
                    const matches = response.data.matches || [];
                    const matchesWithLeague = matches.map(match => ({
                        ...match,
                        competition: {
                            ...match.competition,
                            id: leagues[index].id,
                            leagueName: leagues[index].name
                        }
                    }));
                    return [...acc, ...matchesWithLeague];
                }, []);

                // Sort matches by date
                const sortedMatches = allMatches.sort((a, b) => 
                    new Date(a.utcDate) - new Date(b.utcDate)
                );

                // If location is selected, check for matches within 100 miles
                if (searchState.location) {
                    const matchesWithin100Miles = sortedMatches.filter(match => {
                        const venue = getVenueForTeam(match.homeTeam.name);
                        if (!venue || !venue.coordinates) return false;

                        const distance = calculateDistance(
                            searchState.location.lat,
                            searchState.location.lon,
                            venue.coordinates[1],
                            venue.coordinates[0]
                        );

                        return distance <= 100;
                    });

                    // If there are matches within 100 miles, set the filter
                    // If not, show all matches
                    setSelectedDistance(matchesWithin100Miles.length > 0 ? 100 : null);
                } else {
                    setSelectedDistance(null);
                }
                
                // Update all state at once to prevent multiple rerenders
                setSearchState(prev => ({
                    ...prev,
                    matches: sortedMatches,
                    loading: false,
                    error: null
                }));
                setHasSearched(true);
                
                // Scroll to map after a short delay to ensure it's rendered
                if (sortedMatches.length > 0) {
                    setTimeout(scrollToMap, 100);
                }
                
                console.log('Search completed:', {
                    matchCount: sortedMatches.length,
                    hasLocation: !!searchState.location
                });
            } catch (err) {
                setSearchState(prev => ({
                    ...prev,
                    error: 'Failed to fetch matches. Please try again.',
                    loading: false,
                    matches: []
                }));
                setHasSearched(true);
                console.error('Error fetching matches:', err);
            }
        }
    };

    // Reset hasSearched when resetting the form
    const handleReset = () => {
        setHasSearched(false);
        setSelectedDistance(null);
        setSelectedLeagues(getAllLeagues().map(l => l.id));
        setSearchState(prev => ({
            ...prev,
            dates: {
                departure: null,
                return: null
            },
            location: null,
            matches: [],
            loading: false,
            error: null
        }));
    };

    // Filter matches based on selected distance and leagues
    const filteredMatches = useMemo(() => {
        // First filter by leagues
        let filtered = searchState.matches.filter(match => 
            selectedLeagues.includes(match.competition.id)
        );

        // Then filter by distance if applicable
        if (selectedDistance && searchState.location) {
            filtered = filtered.filter(match => {
                const venue = getVenueForTeam(match.homeTeam.name);
                if (!venue || !venue.coordinates) return false;

                const distance = calculateDistance(
                    searchState.location.lat,
                    searchState.location.lon,
                    venue.coordinates[1],
                    venue.coordinates[0]
                );

                return distance <= selectedDistance;
            });
        }

        return filtered;
    }, [searchState.matches, searchState.location, selectedDistance, selectedLeagues]);

    const handleFiltersOpen = () => {
        setIsFiltersOpen(true);
    };

    const handleFiltersClose = () => {
        setIsFiltersOpen(false);
    };

    const handleDistanceChange = (distance) => {
        console.log('Distance changed:', distance); // Add logging
        setSelectedDistance(distance);
    };

    const handleMatchClick = (match) => {
        setSelectedMatch(match);
        if (activeMarkerRef.current) {
            activeMarkerRef.current(match);
            // On mobile, scroll to map when a match is clicked
            if (window.innerWidth < 900) { // md breakpoint
                mapRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    // Add handler for map marker clicks
    const handleMarkerClick = (match) => {
        setSelectedMatch(match);
    };

    return (
        <>
            <HeaderNav onHomeClick={handleReset} />
            <Container maxWidth="xl">
                <Box
                    sx={{
                        minHeight: '100vh',
                        display: 'flex',
                        flexDirection: 'column',
                        py: 4,
                        mt: 8 // Add margin top to account for fixed header
                    }}
                >
                    {/* Search Form */}
                    <Box sx={{ mb: searchState.matches.length > 0 && hasSearched ? 4 : 0 }}>
                        <Paper 
                            elevation={3}
                            sx={{
                                p: 2,
                                width: '100%',
                                maxWidth: 900,
                                borderRadius: 50,
                                mx: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                border: '1px solid #DDDDDD',
                                '&:hover': {
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.18)'
                                }
                            }}
                        >
                            {/* Location */}
                            <Box 
                                sx={{ 
                                    flex: 1,
                                    borderRight: '1px solid #DDDDDD',
                                    pr: 2
                                }}
                            >
                                <Typography 
                                    variant="subtitle2" 
                                    sx={{ 
                                        fontWeight: 600,
                                        color: '#222222',
                                        mb: 0.5
                                    }}
                                >
                                    Where
                                </Typography>
                                <LocationAutocomplete
                                    value={searchState.location}
                                    onChange={handleLocationChange}
                                    placeholder="Search destinations"
                                />
                            </Box>

                            {/* Check-in Date */}
                            <Box 
                                sx={{ 
                                    flex: 1,
                                    borderRight: '1px solid #DDDDDD',
                                    px: 2
                                }}
                            >
                                <Typography 
                                    variant="subtitle2" 
                                    sx={{ 
                                        fontWeight: 600,
                                        color: '#222222',
                                        mb: 0.5
                                    }}
                                >
                                    Departure Date
                                </Typography>
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                    <DatePicker
                                        value={searchState.dates.departure}
                                        onChange={handleDepartureDateChange}
                                        minDate={today}
                                        slotProps={{
                                            textField: {
                                                variant: "standard",
                                                placeholder: "Add dates",
                                                InputProps: {
                                                    disableUnderline: true
                                                }
                                            }
                                        }}
                                    />
                                </LocalizationProvider>
                            </Box>

                            {/* Check-out Date */}
                            <Box 
                                sx={{ 
                                    flex: 1,
                                    px: 2
                                }}
                            >
                                <Typography 
                                    variant="subtitle2" 
                                    sx={{ 
                                        fontWeight: 600,
                                        color: '#222222',
                                        mb: 0.5
                                    }}
                                >
                                    Return Date
                                </Typography>
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                    <DatePicker
                                        value={searchState.dates.return}
                                        onChange={handleReturnDateChange}
                                        minDate={searchState.dates.departure || today}
                                        disabled={!searchState.dates.departure}
                                        slotProps={{
                                            textField: {
                                                variant: "standard",
                                                placeholder: "Add dates",
                                                InputProps: {
                                                    disableUnderline: true
                                                }
                                            }
                                        }}
                                    />
                                </LocalizationProvider>
                            </Box>

                            {/* Search Button */}
                            <Button
                                variant="contained"
                                onClick={handleSearch}
                                disabled={!searchState.dates.departure || !searchState.dates.return || searchState.loading}
                                sx={{
                                    ml: 1,
                                    height: 48,
                                    width: 48,
                                    minWidth: 48,
                                    borderRadius: '50%',
                                    backgroundColor: '#FF385C',
                                    '&:hover': {
                                        backgroundColor: '#E61E4D'
                                    }
                                }}
                            >
                                {searchState.loading ? (
                                    <CircularProgress size={24} color="inherit" />
                                ) : (
                                    <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        viewBox="0 0 32 32" 
                                        style={{ 
                                            fill: 'white',
                                            width: 24,
                                            height: 24
                                        }}
                                    >
                                        <path d="M13 24c6.1 0 11-4.9 11-11S19.1 2 13 2 2 6.9 2 13s4.9 11 11 11zm0-2c-5 0-9-4-9-9s4-9 9-9 9 4 9 9-4 9-9 9zm12.3 10.7l-8.6-8.6c.9-.9 1.6-1.9 2.1-3.1l8.6 8.6c.8.8.8 2 0 2.8-.7.8-1.9.8-2.7.1z"></path>
                                    </svg>
                                )}
                            </Button>
                        </Paper>
                    </Box>

                    {searchState.error && hasSearched && (
                        <Box sx={{ mt: 4, textAlign: 'center' }}>
                            <Typography color="error">{searchState.error}</Typography>
                        </Box>
                    )}

                    {!searchState.loading && searchState.matches.length === 0 && hasSearched && !searchState.error && (
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

                    {searchState.matches.length > 0 && hasSearched && (
                        <>
                            {/* Mobile Map Toggle */}
                            <Box 
                                sx={{ 
                                    display: { xs: 'block', md: 'none' },
                                    mb: 2 
                                }}
                            >
                                <Button
                                    fullWidth
                                    variant="outlined"
                                    onClick={() => mapRef.current?.scrollIntoView({ behavior: 'smooth' })}
                                    sx={{
                                        borderColor: '#DDD',
                                        color: '#666',
                                        py: 1.5,
                                        '&:hover': {
                                            borderColor: '#999',
                                            backgroundColor: '#F5F5F5'
                                        }
                                    }}
                                >
                                    Show Map
                                </Button>
                            </Box>

                            {/* Filters Bar */}
                            <Box sx={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                mb: 2,
                                backgroundColor: '#fff',
                                py: 2
                            }}>
                                <Typography variant="body2" color="text.secondary">
                                    {`Showing ${filteredMatches.length} matches`}
                                    {selectedDistance ? ` within ${selectedDistance} miles` : ''}
                                    {selectedLeagues.length < 4 ? ` from ${selectedLeagues.length} ${selectedLeagues.length === 1 ? 'league' : 'leagues'}` : ''}
                                </Typography>
                                <Button
                                    variant="outlined"
                                    startIcon={<TuneRounded />}
                                    onClick={handleFiltersOpen}
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

                            {/* Results Grid */}
                            <Box 
                                sx={{ 
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                    gap: 3,
                                    height: { xs: 'auto', md: 'calc(100vh - 300px)' },
                                }}
                            >
                                {/* Left side - Match Results */}
                                <Box 
                                    sx={{ 
                                        overflowY: { xs: 'visible', md: 'auto' },
                                        height: { xs: 'auto', md: '100%' },
                                        order: { xs: 2, md: 1 }
                                    }}
                                >
                                    <Matches 
                                        matches={filteredMatches} 
                                        onMatchClick={handleMatchClick}
                                        userLocation={searchState.location}
                                        selectedMatch={selectedMatch}
                                    />
                                </Box>

                                {/* Right side - Map */}
                                <Box 
                                    ref={mapRef}
                                    sx={{ 
                                        height: { xs: '400px', md: '100%' },
                                        order: { xs: 1, md: 2 },
                                        borderRadius: 2,
                                        overflow: 'hidden'
                                    }}
                                >
                                    <Map 
                                        location={searchState.location} 
                                        showLocation={hasSearched && searchState.matches.length > 0}
                                        matches={filteredMatches}
                                        setActiveMarker={(callback) => {
                                            activeMarkerRef.current = callback;
                                        }}
                                        onMarkerClick={handleMarkerClick}
                                    />
                                </Box>
                            </Box>
                        </>
                    )}
                </Box>
            </Container>

            <Filters 
                open={isFiltersOpen}
                onClose={handleFiltersClose}
                selectedDistance={selectedDistance}
                onDistanceChange={handleDistanceChange}
                selectedLeagues={selectedLeagues}
                onLeaguesChange={setSelectedLeagues}
            />

            {/* Back to top button */}
            <Zoom in={showBackToTop}>
                <Fab 
                    color="primary" 
                    size="medium" 
                    aria-label="scroll back to top"
                    onClick={scrollToTop}
                    sx={{
                        position: 'fixed',
                        bottom: 16,
                        right: 16,
                        backgroundColor: '#FF385C',
                        '&:hover': {
                            backgroundColor: '#E61E4D'
                        }
                    }}
                >
                    <KeyboardArrowUp />
                </Fab>
            </Zoom>
        </>
    );
};

export default Home; 