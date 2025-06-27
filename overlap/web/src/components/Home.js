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
    Zoom,
    IconButton,
    TextField
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { TuneRounded, KeyboardArrowUp, SearchRounded, CloseRounded } from '@mui/icons-material';
import format from 'date-fns/format';
import startOfToday from 'date-fns/startOfToday';
import isAfter from 'date-fns/isAfter';
import Matches from './Matches';
import LocationAutocomplete from './LocationAutocomplete';
import SearchBar from './SearchBar';

import Map from './Map'; // Uncomment Map import
import Filters from './Filters';
import { getAllLeagues, getCountryCode, getLeaguesForCountry, getLeagueById } from '../data/leagues';
import NaturalLanguageSearch from './NaturalLanguageSearch';
import LocationSearch from './LocationSearch';
import useVisitedStadiums from '../hooks/useVisitedStadiums';
import TripModal from './TripModal';
import { getBackendUrl } from '../utils/api';
// getVenueForTeam and calculateDistance removed - distances now calculated in backend

const BACKEND_URL = `${getBackendUrl()}/v4`;

const Home = ({ searchState, setSearchState }) => {
    const today = startOfToday();
    const [hasSearched, setHasSearched] = useState(false);
    const mapRef = useRef(null);
    const [showBackToTop, setShowBackToTop] = useState(false);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [selectedDistance, setSelectedDistance] = useState(null);
    const [selectedLeagues, setSelectedLeagues] = useState([]);
    const [selectedTeams, setSelectedTeams] = useState([]);
    const activeMarkerRef = useRef(null);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [showFilters, setShowFilters] = useState(false);
    const [favoritedMatches, setFavoritedMatches] = useState([]);
    const [tripModalOpen, setTripModalOpen] = useState(false);
    const [selectedMatchForTrip, setSelectedMatchForTrip] = useState(null);
    
    // Use shared visited stadiums hook
    const { visitedStadiums, handleStadiumClick, isStadiumVisited } = useVisitedStadiums();

    // Load saved matches on component mount
    useEffect(() => {
        loadSavedMatches();
    }, []);

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

    useEffect(() => {
        console.log('searchState updated:', searchState);
    }, [searchState]);

    const handleLocationSelect = (location) => {
        // Handle null/undefined location (when input is cleared)
        if (!location) {
            console.log('Location cleared');
            setSearchState(prev => ({
                ...prev,
                location: null,
                matches: [], // Clear matches when location changes
                loading: false,
                error: null
            }));
            return;
        }

        // Convert lat/lon to numbers if they are strings
        const normalizedLocation = {
            ...location,
            lat: typeof location.lat === 'string' ? parseFloat(location.lat) : location.lat,
            lon: typeof location.lon === 'string' ? parseFloat(location.lon) : location.lon
        };
        console.log('Setting location in state:', normalizedLocation);
        setSearchState(prev => ({
            ...prev,
            location: normalizedLocation,
            matches: [], // Clear matches when location changes
            loading: false,
            error: null
        }));
    };

    const handleSearch = async () => {
        // Set default distance filter to 100 miles if not already set
        if (!selectedDistance) {
            setSelectedDistance(100);
        }
        
        // Reset league and team filters to show all
        setSelectedLeagues([]);
        setSelectedTeams([]);
        
        if (searchState.dates.departure && searchState.dates.return &&
            searchState.dates.departure instanceof Date && !isNaN(searchState.dates.departure) &&
            searchState.dates.return instanceof Date && !isNaN(searchState.dates.return)) {
            const currentLocation = searchState.location;
            setSearchState(prev => ({ ...prev, loading: true, error: null }));
            setHasSearched(true);
            const formattedDates = {
                departure: format(searchState.dates.departure, 'yyyy-MM-dd'),
                return: format(searchState.dates.return, 'yyyy-MM-dd')
            };
            
            try {
                const leagues = getAllLeagues();
                console.log('🔍 Starting match search with dates:', formattedDates);
                console.log(`Fetching matches for ${leagues.length} leagues`);

                // Fetch all leagues in parallel
                const responses = await Promise.all(
                    leagues.map(async (league) => {
                        const url = `${BACKEND_URL}/competitions/${league.id}/matches`;
                        try {
                            const response = await axios.get(url, {
                                params: {
                                    dateFrom: formattedDates.departure,
                                    dateTo: formattedDates.return,
                                    userLat: currentLocation?.lat,
                                    userLon: currentLocation?.lon
                                },
                                headers: {
                                    'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY
                                }
                            });
                            return { success: true, data: response.data, league };
                        } catch (error) {
                            console.error(`Error fetching matches for league ${league.name}:`, error);
                            return { success: false, data: { matches: [] }, league };
                        }
                    })
                );

                // Process all matches in a single pass
                const allMatches = responses.reduce((acc, { data, league }) => {
                    // The API response is already in the correct format
                    const matches = data.response || [];
                    
                    // Add competition data if missing
                    const processedMatches = matches.map(match => {
                        if (!match.competition) {
                            // Get the complete league information from our database
                            const leagueInfo = getLeagueById(league.id);
                            return {
                                ...match,
                                competition: {
                                    id: league.id,
                                    name: leagueInfo?.name || league.name,
                                    country: leagueInfo?.country || 'Unknown',
                                    logo: league.logo || ''
                                }
                            };
                        }
                        return match;
                    });
                    
                    return [...acc, ...processedMatches];
                }, []);

                // Sort matches by date
                const sortedMatches = [...allMatches].sort((a, b) => {
                    const dateA = new Date(a.fixture.date);
                    const dateB = new Date(b.fixture.date);
                    return dateA.getTime() - dateB.getTime();
                });

                console.log(`\n📅 Total matches found: ${sortedMatches.length}`);

                // Store all matches in state, filtering will be handled by the UI
                setSearchState(prev => ({
                    ...prev,
                    matches: sortedMatches,
                    loading: false,
                    error: sortedMatches.length === 0 ? 'No matches found for the selected dates.' : null,
                    location: currentLocation // Preserve the location
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
                    matches: [],
                    location: currentLocation // Preserve the location even on error
                }));
                setHasSearched(true);
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

    // Filter matches based on selected distance, leagues, and teams
    const filteredMatches = useMemo(() => {
        // First filter by leagues
        let filtered = searchState.matches.filter(match => {
            // Add null safety for competition data
            if (!match.competition) {
                console.warn('Match missing competition data:', match);
                return false; // Skip matches without competition data
            }
            
            const isIncluded = selectedLeagues.length === 0 || selectedLeagues.includes(match.competition.id);
            return isIncluded;
        });

        // Then filter by teams if any teams are selected
        if (selectedTeams.length > 0) {
            filtered = filtered.filter(match => {
                const homeTeamName = match.teams.home.name;
                const awayTeamName = match.teams.away.name;
                return selectedTeams.includes(homeTeamName) || selectedTeams.includes(awayTeamName);
            });
        }

        // Then filter by distance if location is selected
        if (selectedDistance && searchState.location) {
            filtered = filtered.filter(match => {
                // Distance is now calculated in backend and included in venue object
                const distance = match.fixture.venue?.distance;
                return distance !== null && distance <= selectedDistance;
            }).sort((a, b) => (a.fixture.venue?.distance || 0) - (b.fixture.venue?.distance || 0));
        }

        // Always sort chronologically by date and time
        return [...filtered].sort((a, b) => {
            const dateA = new Date(a.fixture.date);
            const dateB = new Date(b.fixture.date);
            return dateA.getTime() - dateB.getTime();
        });

    }, [searchState.matches, searchState.location, selectedDistance, selectedLeagues, selectedTeams]);

    console.log('🔍 FILTERING DEBUG:', {
        totalMatches: searchState.matches.length,
        selectedLeagues: selectedLeagues,
        selectedTeams: selectedTeams,
        filteredMatchesLength: filteredMatches.length,
        filteredMatchTeams: filteredMatches.map(m => `${m.teams.home.name} vs ${m.teams.away.name}`),
        // Debug: Show all unique team names in Premier League matches
        premierLeagueTeams: [...new Set(
            searchState.matches
                .filter(m => m.competition.id === '39')
                .flatMap(m => [m.teams.home.name, m.teams.away.name])
        )].sort()
    });

    // Helper function to get teams by league from current matches
    const getTeamsByLeague = useMemo(() => {
        const teamsByLeague = {};
        
        searchState.matches.forEach(match => {
            if (!match.competition || !match.teams) return;
            
            const leagueId = match.competition.id;
            if (!teamsByLeague[leagueId]) {
                teamsByLeague[leagueId] = new Set();
            }
            
            teamsByLeague[leagueId].add(match.teams.home.name);
            teamsByLeague[leagueId].add(match.teams.away.name);
        });
        
        // Convert Sets to sorted arrays
        Object.keys(teamsByLeague).forEach(leagueId => {
            teamsByLeague[leagueId] = Array.from(teamsByLeague[leagueId]).sort();
        });
        
        return teamsByLeague;
    }, [searchState.matches]);

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

    const handleTeamsChange = (teams) => {
        console.log('Teams changed:', teams);
        setSelectedTeams(teams);
    };

    const loadSavedMatches = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${getBackendUrl()}/api/preferences/saved-matches`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const matchIds = data.savedMatches.map(match => parseInt(match.matchId));
                setFavoritedMatches(matchIds);
            }
        } catch (error) {
            console.error('Error loading saved matches:', error);
        }
    };



    const saveMatch = async (match) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${getBackendUrl()}/api/preferences/saved-matches`, {
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

            if (!response.ok) {
                throw new Error('Failed to save match');
            }
        } catch (error) {
            console.error('Error saving match:', error);
            // Revert the state change on error
            setFavoritedMatches(prev => prev.filter(id => id !== match.fixture.id));
        }
    };

    const removeSavedMatch = async (matchId) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${getBackendUrl()}/api/preferences/saved-matches/${matchId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to remove saved match');
            }
        } catch (error) {
            console.error('Error removing saved match:', error);
            // Revert the state change on error
            setFavoritedMatches(prev => [...prev, matchId]);
        }
    };

    const handleHeartClick = (match) => {
        setSelectedMatchForTrip(match);
        setTripModalOpen(true);
    };

    const handleMatchAddedToTrip = (matchId) => {
        // Add the match to favoritedMatches to keep the heart selected
        setFavoritedMatches(prev => {
            if (!prev.includes(matchId)) {
                return [...prev, matchId];
            }
            return prev;
        });
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
    }, [selectedDistance, selectedLeagues, selectedTeams]);

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
                        new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime()
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
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box sx={{ 
                height: '100vh', 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: 'hidden',
                position: 'relative'
            }}>
                
                {/* Search Section - Only visible when no matches are shown */}
                {(!searchState.matches.length || !hasSearched) && (
                    <Box sx={{ 
                        p: { xs: 2, sm: 3 }, 
                        backgroundColor: 'white', 
                        borderBottom: '1px solid', 
                        borderColor: 'grey.200',
                        zIndex: 2,
                        mt: '64px' // Add margin top to account for fixed header
                    }}>
                        <NaturalLanguageSearch
                            onSearch={handleNaturalLanguageSearch}
                            onError={handleNaturalLanguageError}
                        />
                        
                        <Box sx={{ mt: 2, maxWidth: 900, mx: 'auto' }}>
                            <SearchBar
                                searchState={searchState}
                                onLocationChange={handleLocationSelect}
                                onDepartureDateChange={handleDepartureDateChange}
                                onReturnDateChange={handleReturnDateChange}
                                onSearch={handleSearch}
                                compact={false}
                            />
                        </Box>
                    </Box>
                )}

                {/* Main Content Area */}
                <Box sx={{ 
                    flex: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    mt: searchState.matches.length > 0 && hasSearched ? '64px' : 0 // Add margin top to account for fixed header when showing matches
                }}>
                    {searchState.error && hasSearched && (
                        <Box sx={{ p: { xs: 2, sm: 4 }, textAlign: 'center' }}>
                            <Typography color="error">{searchState.error}</Typography>
                        </Box>
                    )}

                    {!searchState.loading && searchState.matches.length === 0 && hasSearched && !searchState.error && (
                        <Box sx={{ p: { xs: 2, sm: 4 }, textAlign: 'center' }}>
                            <Paper 
                                elevation={1}
                                sx={{ 
                                    p: { xs: 3, sm: 4 }, 
                                    borderRadius: 2,
                                    backgroundColor: '#FFF8F9',
                                    maxWidth: 600,
                                    mx: 'auto'
                                }}
                            >
                                <Typography 
                                    variant="h6"
                                    sx={{ 
                                        color: '#666',
                                        fontWeight: 500
                                    }}
                                >
                                    No matches are scheduled between {
                                        searchState.dates.departure && searchState.dates.departure instanceof Date && !isNaN(searchState.dates.departure) ?
                                        format(searchState.dates.departure, 'MMMM d') : 'selected dates'
                                    } and {
                                        searchState.dates.return && searchState.dates.return instanceof Date && !isNaN(searchState.dates.return) ?
                                        format(searchState.dates.return, 'MMMM d, yyyy') : 'selected dates'
                                    }.
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
                            {/* Compact Search Bar - Only visible when matches are shown */}
                            <Box sx={{ 
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                backgroundColor: 'white',
                                zIndex: 5, // Lower than header nav
                                p: { xs: 1, sm: 1.5 },
                                borderBottom: '1px solid',
                                borderColor: 'grey.200',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: { xs: 1, sm: 2 }
                            }}>
                                <Box sx={{ flex: 1 }}>
                                    <SearchBar
                                        searchState={searchState}
                                        onLocationChange={handleLocationSelect}
                                        onDepartureDateChange={handleDepartureDateChange}
                                        onReturnDateChange={handleReturnDateChange}
                                        onSearch={handleSearch}
                                        compact={true}
                                    />
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Button 
                                        size="small" 
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
                            </Box>



                            {/* Full-screen Map with Rail */}
                            <Box sx={{ 
                                position: 'absolute',
                                top: { xs: 76, sm: 82 }, // Adjust for mobile vs desktop compact search bar height
                                left: 0,
                                right: 0,
                                bottom: 0,
                                display: 'flex'
                            }}>
                                {/* Left Rail with Matches */}
                                <Box sx={{
                                    width: { xs: '100%', md: '480px' },
                                    height: '100%',
                                    backgroundColor: 'white',
                                    borderRight: { xs: 'none', md: '1px solid #DDDDDD' },
                                    overflowY: 'auto',
                                    display: { xs: selectedMatch ? 'none' : 'block', md: 'block' },
                                    zIndex: 5,
                                    boxShadow: { xs: 'none', md: '2px 0 8px rgba(0,0,0,0.1)' }
                                }}>
                                    {/* Matches List */}
                                    <Box sx={{ 
                                        p: { xs: 1.5, sm: 2 },
                                        height: '100%',
                                        overflowY: 'auto'
                                    }}>
                                        <Box sx={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center',
                                            mb: 2,
                                            pb: 1,
                                            borderBottom: '1px solid #eee'
                                        }}>
                                            <Typography variant="body2" color="text.secondary">
                                                {`Showing ${filteredMatches.length} matches`}
                                                {selectedDistance ? ` within ${selectedDistance} miles` : ''}
                                                {selectedLeagues.length > 0 && ` from ${selectedLeagues.length} leagues`}
                                                {selectedTeams.length > 0 && ` featuring ${selectedTeams.length} teams`}
                                            </Typography>
                                        </Box>
                                        
                                        <Matches 
                                            matches={filteredMatches}
                                            selectedMatches={searchState.selectedMatches}
                                            onMatchClick={handleMatchClick}
                                            userLocation={searchState.location}
                                            selectedMatch={selectedMatch}
                                            onHeartClick={handleHeartClick}
                                            favoritedMatches={favoritedMatches}
                                            onStadiumClick={handleStadiumClick}
                                            visitedStadiums={visitedStadiums}
                                            isStadiumVisited={isStadiumVisited}
                                        />
                                    </Box>
                                </Box>

                                {/* Full-screen Map */}
                                <Box sx={{ 
                                    flex: 1,
                                    height: '100%',
                                    position: 'relative'
                                }}>
                                    <Map
                                        matches={filteredMatches}
                                        location={searchState.location}
                                        showLocation={true}
                                        selectedMatches={searchState.selectedMatches}
                                        selectedTransportation={searchState.selectedTransportation}
                                        setActiveMarker={(callback) => {
                                            activeMarkerRef.current = callback;
                                        }}
                                        onHeartClick={handleHeartClick}
                                        favoritedMatches={favoritedMatches}
                                        visitedStadiums={visitedStadiums}
                                    />
                                    
                                    {/* Mobile toggle button to show matches list */}
                                    <Box sx={{ 
                                        display: { xs: 'block', md: 'none' },
                                        position: 'absolute',
                                        bottom: { xs: 20, sm: 16 },
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        zIndex: 5
                                    }}>
                                        <Button
                                            variant="contained"
                                            onClick={() => setSelectedMatch(null)}
                                            sx={{
                                                display: selectedMatch ? 'flex' : 'none',
                                                backgroundColor: 'white',
                                                color: '#333',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                                px: { xs: 2, sm: 3 },
                                                py: { xs: 1, sm: 1.5 },
                                                fontSize: { xs: '0.875rem', sm: '1rem' },
                                                '&:hover': {
                                                    backgroundColor: '#f5f5f5'
                                                }
                                            }}
                                        >
                                            Back to List
                                        </Button>
                                    </Box>
                                </Box>
                            </Box>
                        </>
                    )}
                </Box>

                {/* Filters Dialog */}
                <Filters 
                    open={isFiltersOpen}
                    onClose={handleFiltersClose}
                    selectedDistance={selectedDistance}
                    onDistanceChange={handleDistanceChange}
                    selectedLeagues={selectedLeagues}
                    onLeaguesChange={setSelectedLeagues}
                    selectedTeams={selectedTeams}
                    onTeamsChange={handleTeamsChange}
                    teamsByLeague={getTeamsByLeague}
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

                {/* Trip Modal */}
                <TripModal
                    open={tripModalOpen}
                    onClose={() => {
                        setTripModalOpen(false);
                        setSelectedMatchForTrip(null);
                    }}
                    match={selectedMatchForTrip}
                    onMatchAddedToTrip={handleMatchAddedToTrip}
                />
            </Box>
        </LocalizationProvider>
    );
};

export default Home; 