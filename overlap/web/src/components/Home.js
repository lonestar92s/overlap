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
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { TuneRounded, KeyboardArrowUp, SearchRounded, CloseRounded, Clear, ClearAll } from '@mui/icons-material';
import format from 'date-fns/format';
import startOfToday from 'date-fns/startOfToday';
import isAfter from 'date-fns/isAfter';
import addDays from 'date-fns/addDays';
import differenceInDays from 'date-fns/differenceInDays';
import Matches from './Matches';
import LocationAutocomplete from './LocationAutocomplete';
import SearchBar from './SearchBar';
import Map from './Map';
import Filters from './Filters';
import { getAllLeagues, getCountryCode, getLeaguesForCountry, getLeagueById } from '../data/leagues';
import NaturalLanguageSearch from './NaturalLanguageSearch';
import LocationSearch from './LocationSearch';
import useVisitedStadiums from '../hooks/useVisitedStadiums';
import { useSubscription } from '../hooks/useSubscription';
import TripModal from './TripModal';
import { getBackendUrl } from '../utils/api';
import { MatchCarousel } from './carousel/MatchCarousel';
import { mockMatches } from './carousel/mockMatches';
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
    
    // Use subscription hook
    const { subscriptionTier, accessibleLeagues, hasLeagueAccess, getUpgradeMessage } = useSubscription();

    // Date restriction for freemium users (60 days max)
    const FREEMIUM_MAX_DAYS = 60;
    
    // Modal state for date restriction
    const [dateRestrictionModalOpen, setDateRestrictionModalOpen] = useState(false);
    const [restrictedDateType, setRestrictedDateType] = useState(''); // 'from' or 'to'
    
    const handleDateRestrictionModal = (dateType) => {
        if (subscriptionTier === 'freemium') {
            setRestrictedDateType(dateType);
            setDateRestrictionModalOpen(true);
            return true; // Indicates restriction was triggered
        }
        return false; // No restriction
    };

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

    const handleFromDateChange = (newValue) => {
        // Only update if the date is valid or null
        const isValidDate = newValue === null || (newValue instanceof Date && !isNaN(newValue));
        if (!isValidDate) {
            console.warn('Invalid from date attempted:', newValue);
            return false;
        }
        
        // Check for freemium date restriction
        if (newValue && subscriptionTier === 'freemium' && differenceInDays(newValue, today) > FREEMIUM_MAX_DAYS) {
            handleDateRestrictionModal('from');
            return false; // Date was rejected
        }
        
        setSearchState(prev => ({
            ...prev,
            dates: {
                from: newValue,
                to: prev.dates.to && isAfter(newValue, prev.dates.to) ? null : prev.dates.to
            }
        }));
        
        return true; // Date was accepted
    };

    const handleToDateChange = (newValue) => {
        // Only update if the date is valid or null
        const isValidDate = newValue === null || (newValue instanceof Date && !isNaN(newValue));
        if (!isValidDate) {
            console.warn('Invalid to date attempted:', newValue);
            return false;
        }
        
        // Check for freemium date restriction
        if (newValue && subscriptionTier === 'freemium' && differenceInDays(newValue, today) > FREEMIUM_MAX_DAYS) {
            handleDateRestrictionModal('to');
            return false; // Date was rejected
        }
        
        setSearchState(prev => ({
            ...prev,
            dates: {
                ...prev.dates,
                to: newValue
            }
        }));
        
        return true; // Date was accepted
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
        
        if (searchState.dates.from && searchState.dates.to &&
            searchState.dates.from instanceof Date && !isNaN(searchState.dates.from) &&
            searchState.dates.to instanceof Date && !isNaN(searchState.dates.to)) {
            const currentLocation = searchState.location;
            setSearchState(prev => ({ ...prev, loading: true, error: null }));
            setHasSearched(true);
            const formattedDates = {
                from: format(searchState.dates.from, 'yyyy-MM-dd'),
                to: format(searchState.dates.to, 'yyyy-MM-dd')
            };
            
            try {
                // Filter leagues based on subscription
                const allLeagues = getAllLeagues();
                const leagues = allLeagues.filter(league => hasLeagueAccess(league.id));
                
                console.log('🔍 Starting match search with dates:', formattedDates);
                console.log(`📊 Subscription tier: ${subscriptionTier}`);
                console.log(`🌍 All available leagues: ${allLeagues.length}`, allLeagues.map(l => `${l.name} (${l.id})`));
                console.log(`✅ Accessible leagues: ${leagues.length}`, leagues.map(l => `${l.name} (${l.id})`));
                console.log(`❌ Restricted leagues:`, allLeagues.filter(league => !hasLeagueAccess(league.id)).map(l => `${l.name} (${l.id})`));

                // Fetch all accessible leagues in parallel
                const responses = await Promise.all(
                    leagues.map(async (league) => {
                        const url = `${BACKEND_URL}/competitions/${league.id}/matches`;
                        try {
                            const response = await axios.get(url, {
                                params: {
                                    dateFrom: formattedDates.from,
                                    dateTo: formattedDates.to,
                                    userLat: currentLocation?.lat,
                                    userLon: currentLocation?.lon
                                },
                                headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                    'Content-Type': 'application/json'
                                }
                            });
                            return { success: true, data: response.data, league };
                        } catch (error) {
                            console.error(`Error fetching matches for league ${league.name}:`, error);
                            if (error.response?.status === 403) {
                                console.log(`⚠️ Access denied to ${league.name} - subscription required`);
                            }
                            return { success: false, data: { response: [] }, league };
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
                from: null,
                to: null
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

    // Debug: Log when filteredMatches changes
    useEffect(() => {
        console.log('🏠 HOME: filteredMatches changed:', {
            count: filteredMatches.length,
            matchIds: filteredMatches.map(m => m.fixture.id),
            selectedLeagues,
            selectedTeams,
            selectedDistance
        });
    }, [filteredMatches, selectedLeagues, selectedTeams, selectedDistance]);

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

        // Helper function to safely create a Date object
        const createSafeDate = (dateString) => {
            if (!dateString) return null;
            const date = new Date(dateString);
            return (date instanceof Date && !isNaN(date)) ? date : null;
        };

        // Update search parameters with validated dates
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
                from: createSafeDate(searchParams.dateRange?.start),
                to: createSafeDate(searchParams.dateRange?.end)
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

    const clearDistanceFilter = () => {
        setSelectedDistance(null);
    };
    
    const clearLeagueFilter = (leagueId) => {
        setSelectedLeagues(prev => prev.filter(id => id !== leagueId));
    };
    
    const clearTeamFilter = (teamId) => {
        setSelectedTeams(prev => prev.filter(id => id !== teamId));
    };
    
    const clearAllFilters = () => {
        setSelectedDistance(null);
        setSelectedLeagues([]);
        setSelectedTeams([]);
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box sx={{ 
                minHeight: '100vh', 
                display: 'flex', 
                flexDirection: 'column',
                position: 'relative',
                pt: '64px' // Add padding top to account for fixed header
            }}>
                {/* Search Section - Always visible below header */}
                <Box sx={{ 
                    position: 'sticky',
                    top: '64px',
                    backgroundColor: 'white',
                    borderBottom: '1px solid',
                    borderColor: 'grey.200',
                    zIndex: 10,
                    p: { xs: 2, sm: 3 }
                }}>
                    <NaturalLanguageSearch
                        onSearch={handleNaturalLanguageSearch}
                        onError={handleNaturalLanguageError}
                    />
                    
                    <Box sx={{ mt: 2, maxWidth: 900, mx: 'auto' }}>
                        <SearchBar
                            searchState={searchState}
                            onLocationChange={handleLocationSelect}
                            onFromDateChange={handleFromDateChange}
                            onToDateChange={handleToDateChange}
                            onSearch={handleSearch}
                            compact={false}
                        />
                    </Box>
                </Box>

                {/* Main Content Area */}
                <Box sx={{ 
                    flex: 1,
                    position: 'relative',
                    pt: 2
                }}>
                    {/* Carousels */}
                    {(!searchState.matches.length || !hasSearched) && (
                        <Box sx={{ pb: 4 }}>
                            <MatchCarousel 
                                title="Popular matches in England" 
                                matches={mockMatches.filter(m => m.stadium.country === 'England')} 
                            />
                            
                            <MatchCarousel 
                                title="Matches next month in Europe" 
                                matches={mockMatches.filter(m => ['Spain', 'Germany', 'Italy'].includes(m.stadium.country))} 
                            />
                            
                            <MatchCarousel 
                                title="Watch a match in Switzerland" 
                                matches={mockMatches.slice(2)} 
                            />
                        </Box>
                    )}

                    {/* Search Results */}
                    {searchState.matches.length > 0 && hasSearched && (
                        <>
                            {/* Compact Search Bar - Only visible when matches are shown */}
                            <Box sx={{ 
                                backgroundColor: 'white',
                                zIndex: 5,
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
                                        onFromDateChange={handleFromDateChange}
                                        onToDateChange={handleToDateChange}
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

                            {/* Map and Results */}
                            <Box sx={{ 
                                position: 'relative',
                                height: 'calc(100vh - 64px - 56px)', // Viewport height minus header and search bar
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
                                        
                                        {/* Applied Filters */}
                                        {(selectedDistance || selectedLeagues.length > 0 || selectedTeams.length > 0) && (
                                            <Box sx={{ mb: 2 }}>
                                                <Box sx={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'space-between',
                                                    mb: 1 
                                                }}>
                                                    <Typography variant="caption" sx={{ 
                                                        fontWeight: 600, 
                                                        color: '#666',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px'
                                                    }}>
                                                        Applied Filters
                                                    </Typography>
                                                    <Button
                                                        size="small"
                                                        startIcon={<ClearAll />}
                                                        onClick={clearAllFilters}
                                                        sx={{ 
                                                            color: '#666',
                                                            fontSize: '0.75rem',
                                                            minWidth: 'auto',
                                                            px: 1,
                                                            '&:hover': {
                                                                backgroundColor: '#f5f5f5'
                                                            }
                                                        }}
                                                    >
                                                        Clear All
                                                    </Button>
                                                </Box>
                                                
                                                <Box sx={{ 
                                                    display: 'flex', 
                                                    flexWrap: 'wrap', 
                                                    gap: 1 
                                                }}>
                                                    {/* Distance Filter */}
                                                    {selectedDistance && (
                                                        <Chip
                                                            label={`Within ${selectedDistance} miles`}
                                                            onDelete={clearDistanceFilter}
                                                            deleteIcon={<Clear />}
                                                            size="small"
                                                            sx={{
                                                                backgroundColor: '#e3f2fd',
                                                                color: '#1976d2',
                                                                '& .MuiChip-deleteIcon': {
                                                                    color: '#1976d2'
                                                                }
                                                            }}
                                                        />
                                                    )}
                                                    
                                                    {/* League Filters */}
                                                    {selectedLeagues.map(leagueId => {
                                                        const league = getLeagueById(leagueId);
                                                        return (
                                                            <Chip
                                                                key={leagueId}
                                                                label={league?.name || `League ${leagueId}`}
                                                                onDelete={() => clearLeagueFilter(leagueId)}
                                                                deleteIcon={<Clear />}
                                                                size="small"
                                                                sx={{
                                                                    backgroundColor: '#f3e5f5',
                                                                    color: '#7b1fa2',
                                                                    '& .MuiChip-deleteIcon': {
                                                                        color: '#7b1fa2'
                                                                    }
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                    
                                                    {/* Team Filters */}
                                                    {selectedTeams.map(teamName => (
                                                        <Chip
                                                            key={teamName}
                                                            label={teamName}
                                                            onDelete={() => clearTeamFilter(teamName)}
                                                            deleteIcon={<Clear />}
                                                            size="small"
                                                            sx={{
                                                                backgroundColor: '#e8f5e8',
                                                                color: '#2e7d32',
                                                                '& .MuiChip-deleteIcon': {
                                                                    color: '#2e7d32'
                                                                }
                                                            }}
                                                        />
                                                    ))}
                                                </Box>
                                            </Box>
                                        )}
                                        
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

                    {/* Error States */}
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
                                        searchState.dates.from && searchState.dates.from instanceof Date && !isNaN(searchState.dates.from) ?
                                        format(searchState.dates.from, 'MMMM d') : 'selected dates'
                                    } and {
                                        searchState.dates.to && searchState.dates.to instanceof Date && !isNaN(searchState.dates.to) ?
                                        format(searchState.dates.to, 'MMMM d, yyyy') : 'selected dates'
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

                {/* Date Restriction Modal */}
                <Dialog
                    open={dateRestrictionModalOpen}
                    onClose={() => setDateRestrictionModalOpen(false)}
                    maxWidth="sm"
                    fullWidth
                    PaperProps={{
                        sx: {
                            borderRadius: 3,
                            p: 1
                        }
                    }}
                >
                    <DialogTitle sx={{ 
                        fontWeight: 600, 
                        color: '#FF385C',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                    }}>
                        🔒 Date Restriction
                    </DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            Sorry! As a <strong>Freemium</strong> user, you can only search for matches up to <strong>60 days</strong> in advance.
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
                            You tried to select a {restrictedDateType} date that's more than 60 days from today. 
                            To search for matches further in the future, please upgrade to a Pro subscription.
                        </Typography>
                        <Box sx={{ 
                            p: 2, 
                            backgroundColor: '#f8f9fa', 
                            borderRadius: 2, 
                            border: '1px solid #e9ecef' 
                        }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                                ✨ Upgrade to Pro to unlock:
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#666' }}>
                                • Unlimited date range for match searches<br/>
                                • Access to Championship league matches<br/>
                                • Priority customer support
                            </Typography>
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 3, pt: 1 }}>
                        <Button 
                            onClick={() => setDateRestrictionModalOpen(false)}
                            sx={{ color: '#666' }}
                        >
                            Got it
                        </Button>
                        <Button 
                            variant="contained"
                            onClick={() => {
                                setDateRestrictionModalOpen(false);
                                // TODO: Navigate to upgrade page
                                console.log('Navigate to upgrade page');
                            }}
                            sx={{
                                backgroundColor: '#FF385C',
                                '&:hover': {
                                    backgroundColor: '#E61E4D'
                                }
                            }}
                        >
                            Upgrade to Pro
                        </Button>
                    </DialogActions>
                </Dialog>

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