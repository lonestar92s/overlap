import React, { useState, useRef, useMemo, useEffect } from 'react';
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
import NaturalLanguageSearch from './NaturalLanguageSearch';

const BACKEND_URL = 'http://localhost:3001';

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
    const [showFilters, setShowFilters] = useState(false);

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

    const handleLocationSelect = (location) => {
        setSearchState(prev => ({ ...prev, location }));
    };

    const handleSearch = async () => {
        if (searchState.dates.departure && searchState.dates.return) {
            setSearchState(prev => ({ ...prev, loading: true, error: null }));
            const formattedDates = {
                departure: format(searchState.dates.departure, 'yyyy-MM-dd'),
                return: format(searchState.dates.return, 'yyyy-MM-dd')
            };
            
            try {
                const leagues = getAllLeagues();
                console.log('🔍 Starting match search with dates:', formattedDates);

                const responses = await Promise.all(
                    leagues.map(async league => {
                        try {
                            const url = `${BACKEND_URL}/v4/competitions/${league.id}/matches`;
                            console.log(`Fetching from: ${url}`);
                            
                            const response = await axios.get(url, {
                                params: {
                                    dateFrom: formattedDates.departure,
                                    dateTo: formattedDates.return
                                }
                            });
                            
                            console.log(`Successfully fetched data for league: ${league.name}`);
                            return response.data;
                        } catch (error) {
                            console.error(`Error fetching matches for league ${league.name}:`, error);
                            return { matches: [] };
                        }
                    })
                );

                const allMatches = responses.reduce((acc, response, index) => {
                    console.log(`\n🏆 Processing matches for league: ${leagues[index].name}`);
                    const matches = response.matches || [];
                    console.log(`Found ${matches.length} matches in ${leagues[index].name}`);
                    
                    if (matches.length > 0) {
                        // Log details of first match as example
                        const sampleMatch = matches[0];
                        console.log('Sample match data:', {
                            id: sampleMatch.id,
                            utcDate: sampleMatch.utcDate,
                            status: sampleMatch.status,
                            homeTeam: `${sampleMatch.homeTeam.name} (${sampleMatch.homeTeam.shortName})`,
                            awayTeam: `${sampleMatch.awayTeam.name} (${sampleMatch.awayTeam.shortName})`,
                            competition: sampleMatch.competition,
                            venue: getVenueForTeam(sampleMatch.homeTeam.name)
                        });
                    }

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

                const sortedMatches = [...allMatches].sort((a, b) => {
                    const dateA = new Date(a.utcDate);
                    const dateB = new Date(b.utcDate);
                    return dateA.getTime() - dateB.getTime();
                });

                console.log(`\n📅 Total matches found: ${sortedMatches.length}`);
                console.log('First 3 matches after sorting:', sortedMatches.slice(0, 3).map(match => ({
                    date: match.utcDate,
                    homeTeam: match.homeTeam.name,
                    awayTeam: match.awayTeam.name,
                    competition: match.competition.leagueName
                })));

                // Set leagues based on location and available matches
                if (searchState.location && searchState.location.country) {
                    const countryCode = getCountryCode(searchState.location.country);
                    if (countryCode) {
                        const countryLeagues = getLeaguesForCountry(countryCode);
                        const countryLeagueIds = countryLeagues.map(league => league.id);
                        
                        // Check if there are any matches in the country's leagues
                        const hasCountryMatches = sortedMatches.some(match => 
                            countryLeagueIds.includes(match.competition.id)
                        );

                        // If matches found in country leagues, select only those leagues
                        // Otherwise, show all leagues
                        setSelectedLeagues(hasCountryMatches ? countryLeagueIds : getAllLeagues().map(league => league.id));
                    }
                }

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

                    // Only set distance filter if we found matches within range
                    setSelectedDistance(matchesWithin100Miles.length > 0 ? 100 : null);
                } else {
                    setSelectedDistance(null);
                }

                setSearchState(prev => ({
                    ...prev,
                    matches: sortedMatches,
                    loading: false,
                    error: sortedMatches.length === 0 ? 'No matches found for the selected dates.' : null
                }));
                
                setHasSearched(true);

                // Scroll to map after a short delay to ensure it's rendered
                if (sortedMatches.length > 0) {
                    setTimeout(scrollToMap, 100);
                }

            } catch (err) {
                console.error('❌ Error in handleSearch:', err);
                if (err.response) {
                    console.error('API Error Details:', {
                        status: err.response.status,
                        statusText: err.response.statusText,
                        data: err.response.data
                    });
                }
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
        setSelectedLeagues([]);
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
        let filtered = searchState.matches.filter(match => {
            const isIncluded = selectedLeagues.length === 0 || selectedLeagues.includes(match.competition.id);
            return isIncluded;
        });

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

        // Always sort chronologically by date and time
        return [...filtered].sort((a, b) => {
            const dateA = new Date(a.utcDate);
            const dateB = new Date(b.utcDate);
            return dateA.getTime() - dateB.getTime();
        });

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
        // Trigger marker popup and map centering
        if (activeMarkerRef.current) {
            activeMarkerRef.current(match);
            // On mobile, scroll to map when a match is clicked
            if (window.innerWidth < 900) { // md breakpoint
                mapRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    // Reset selected match when filters change
    useEffect(() => {
        setSelectedMatch(null);
    }, [selectedDistance, selectedLeagues]);

    // Handle match selection/deselection
    const handleMatchSelect = (match) => {
        console.log('Handling match select/deselect:', match.id);
        console.log('Current selected matches:', searchState.selectedMatches);
        
        setSearchState(prev => {
            const currentSelectedMatches = prev.selectedMatches || [];
            const isAlreadySelected = currentSelectedMatches.some(m => m.id === match.id);
            
            console.log('Is already selected:', isAlreadySelected);
            
            if (isAlreadySelected) {
                // Remove the match and its associated transportation
                const newSelectedMatches = currentSelectedMatches.filter(m => m.id !== match.id);
                const newSelectedTransportation = { ...prev.selectedTransportation };
                
                // Remove transportation options that involve this match
                Object.keys(newSelectedTransportation).forEach(key => {
                    if (key.includes(String(match.id))) {
                        delete newSelectedTransportation[key];
                    }
                });
                
                console.log('New selected matches after removal:', newSelectedMatches);
                
                return {
                    ...prev,
                    selectedMatches: newSelectedMatches,
                    selectedTransportation: newSelectedTransportation
                };
            } else {
                // Add the match if we haven't reached the limit
                if (currentSelectedMatches.length < 5) {
                    const newSelectedMatches = [...currentSelectedMatches, match].sort((a, b) => 
                        new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
                    );
                    
                    console.log('New selected matches after addition:', newSelectedMatches);
                    
                    return {
                        ...prev,
                        selectedMatches: newSelectedMatches
                    };
                }
            }
            return prev;
        });
    };

    // Handle transportation selection
    const handleTransportationSelect = (key, option) => {
        setSearchState(prev => ({
            ...prev,
            selectedTransportation: {
                ...prev.selectedTransportation,
                [key]: option
            }
        }));
    };

    // Handle itinerary save
    const handleSaveItinerary = () => {
        // This would be connected to the backend later
        console.log('Saving itinerary:', {
            matches: searchState.selectedMatches,
            transportation: searchState.selectedTransportation
        });
    };

    // Reset selected matches and transportation when a new search is performed
    useEffect(() => {
        if (hasSearched) {
            setSearchState(prev => ({
                ...prev,
                selectedMatches: [],
                selectedTransportation: {}
            }));
            setSelectedMatch(null);
        }
    }, [hasSearched]);

    const handleNaturalLanguageSearch = (searchParams) => {
        // Set loading state first
        setSearchState(prev => ({
            ...prev,
            loading: true,
            error: null
        }));

        // Update search parameters
        setSearchState(prev => ({
            ...prev,
            location: searchParams.location ? {
                place_id: `${searchParams.location.city}-${searchParams.location.country}`,
                city: searchParams.location.city,
                country: searchParams.location.country,
                lat: searchParams.location.coordinates[1],
                lon: searchParams.location.coordinates[0]
            } : null,
            dates: {
                departure: searchParams.dateRange?.start ? new Date(searchParams.dateRange.start) : null,
                return: searchParams.dateRange?.end ? new Date(searchParams.dateRange.end) : null
            },
            selectedLeagues: searchParams.leagues || []
        }));

        // Only trigger search if we have both location and date range
        if (searchParams.location && searchParams.dateRange?.start && searchParams.dateRange?.end) {
            handleSearch();
        } else {
            // Reset loading state if we don't have enough parameters
            setSearchState(prev => ({
                ...prev,
                loading: false,
                error: 'Please provide both location and dates for the search.'
            }));
        }
    };

    const handleNaturalLanguageError = (error) => {
        setSearchState(prev => ({
            ...prev,
            error
        }));
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
                        py: 2, // Reduced padding
                        mt: 8 // Add margin top to account for fixed header
                    }}
                >
                    {/* Remove the Box wrapper and position NaturalLanguageSearch more efficiently */}
                    <NaturalLanguageSearch
                        onSearch={handleNaturalLanguageSearch}
                        onError={handleNaturalLanguageError}
                    />

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
                                    onChange={handleLocationSelect}
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

                                {/* Right side - Map and Itinerary Builder */}
                                <Box 
                                    sx={{ 
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 3,
                                        height: { xs: 'auto', md: '100%' },
                                        order: { xs: 1, md: 2 }
                                    }}
                                >
                                    {/* Map */}
                                    <Box 
                                        ref={mapRef}
                                        sx={{ 
                                            height: { xs: '400px', md: '100%' },
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
                                            selectedMatch={selectedMatch}
                                        />
                                    </Box>
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