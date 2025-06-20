import React, { useMemo, useRef, useEffect } from 'react';
import { 
    Card, 
    CardContent, 
    Typography, 
    Box,
    Avatar,
    Button,
    IconButton
} from '@mui/material';
import { Stadium, AccessTime, LocationOn, FavoriteBorder, Favorite } from '@mui/icons-material';
import { format } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';
// getVenueForTeam import removed - distances now calculated in backend

// Helper function to get timezone from coordinates
const getTimezoneFromCoordinates = (coordinates) => {
    // This is a simplified version. In a real-world application, 
    // you would want to use a timezone lookup service or library
    // like Google Time Zone API or moment-timezone with a complete timezone database
    
    const [longitude, latitude] = coordinates;
    
    // Europe
    if (latitude >= 35 && latitude <= 60) {
        if (longitude >= -10 && longitude <= 2) return 'Europe/London';      // UK, Ireland, Portugal
        if (longitude > 2 && longitude <= 7.5) return 'Europe/Paris';        // France, Belgium, Netherlands
        if (longitude > 7.5 && longitude <= 15) return 'Europe/Berlin';      // Germany, Switzerland, Italy
        if (longitude > 15 && longitude <= 20) return 'Europe/Rome';         // Italy, Austria
        if (longitude <= -10) return 'Atlantic/Azores';                      // Azores
        if (longitude > 20 && longitude <= 30) return 'Europe/Istanbul';     // Turkey, Eastern Europe
    }
    
    // Americas
    if (longitude >= -180 && longitude <= -30) {
        if (latitude >= 25 && latitude <= 50) {  // North America
            if (longitude >= -125 && longitude <= -115) return 'America/Los_Angeles';
            if (longitude > -115 && longitude <= -100) return 'America/Denver';
            if (longitude > -100 && longitude <= -85) return 'America/Chicago';
            if (longitude > -85 && longitude <= -65) return 'America/New_York';
        }
        if (latitude >= -60 && latitude < 25) {  // South & Central America
            if (longitude >= -85 && longitude <= -75) return 'America/Bogota';
            if (longitude > -75 && longitude <= -65) return 'America/Lima';
            if (longitude > -65 && longitude <= -55) return 'America/Sao_Paulo';
            if (longitude > -55 && longitude <= -30) return 'America/Buenos_Aires';
        }
    }
    
    // Asia
    if (latitude >= 20 && latitude <= 55 && longitude >= 30 && longitude <= 180) {
        if (longitude >= 30 && longitude <= 45) return 'Asia/Dubai';         // UAE
        if (longitude > 45 && longitude <= 60) return 'Asia/Karachi';        // Pakistan
        if (longitude > 60 && longitude <= 75) return 'Asia/Kolkata';        // India
        if (longitude > 75 && longitude <= 90) return 'Asia/Bangkok';        // Thailand
        if (longitude > 90 && longitude <= 105) return 'Asia/Shanghai';      // China
        if (longitude > 105 && longitude <= 120) return 'Asia/Tokyo';        // Japan
    }
    
    // Africa
    if (latitude >= -35 && latitude <= 35 && longitude >= -20 && longitude <= 50) {
        if (longitude >= -20 && longitude <= 0) return 'Africa/Casablanca';  // Morocco
        if (longitude > 0 && longitude <= 20) return 'Africa/Lagos';         // Nigeria
        if (longitude > 20 && longitude <= 35) return 'Africa/Cairo';        // Egypt
        if (longitude > 35 && longitude <= 50) return 'Africa/Nairobi';      // Kenya
    }
    
    // Australia & Oceania
    if (latitude >= -50 && latitude <= -10 && longitude >= 110 && longitude <= 180) {
        if (longitude >= 110 && longitude <= 130) return 'Australia/Perth';
        if (longitude > 130 && longitude <= 150) return 'Australia/Sydney';
        if (longitude > 150) return 'Pacific/Auckland';
    }
    
    return 'UTC'; // Default to UTC if no specific timezone is found
};

// Helper function to format match date and time
const formatMatchDateTime = (utcDate, venue) => {
    // Create date object from UTC string
    const date = new Date(utcDate);
    
    // Get venue timezone, default to UTC
    let timeZone = 'UTC';
    if (venue?.coordinates) {
        timeZone = getTimezoneFromCoordinates(venue.coordinates);
    }
    
    // Get timezone display name
    // const getTimezoneAbbreviation = (timeZone, date) => {
    //     const isDST = new Date(date).getTimezoneOffset() === 0;
    //     switch (timeZone) {
    //         case 'Europe/London':
    //             return isDST ? 'BST' : 'GMT';
    //         case 'Europe/Paris':
    //         case 'Europe/Berlin':
    //         case 'Europe/Rome':
    //             return isDST ? 'CEST' : 'CET';
    //         default:
    //             return timeZone.split('/')[1] || 'UTC';
    //     }
    // };

    // const timeZoneDisplay = getTimezoneAbbreviation(timeZone, date);
    
    // Convert UTC date to venue's timezone
    const zonedDate = utcToZonedTime(date, timeZone);
    
    // Format the date and time in the venue's timezone
    return {
        date: format(zonedDate, 'EEE, MMM d'),
        time: format(zonedDate, 'h:mm a'),
        fullDate: format(zonedDate, 'EEEE, MMMM d'),
        // Keep groupDate in UTC to ensure consistent grouping
        groupDate: format(date, 'yyyy-MM-dd')
    };
};

const MatchCard = ({ 
    match, 
    onClick, 
    distance, 
    isSelected,
    onHeartClick = () => {},
    isFavorited = false,
}) => {
    // Extract data from the new API response format
    const fixture = match.fixture;
    const teams = match.teams;
    const league = match.league;
    const venue = fixture.venue;
    
    const { date, time } = formatMatchDateTime(fixture.date, venue);
    const cardRef = useRef(null);

    useEffect(() => {
        if (isSelected && cardRef.current) {
            cardRef.current.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center'
            });
        }
    }, [isSelected]);

    return (
        <Card 
            ref={cardRef}
            id={`match-${fixture.id}`}
            elevation={0}
            onClick={() => onClick(match)}
            sx={{
                mb: 2,
                border: '1px solid #eee',
                borderRadius: 2,
                transition: 'all 0.2s ease-in-out',
                cursor: 'pointer',
                backgroundColor: isSelected ? '#F8F9FF' : 'white',
                borderColor: isSelected ? '#385CFF' : '#eee',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    borderColor: '#385CFF'
                }
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AccessTime sx={{ mr: 1, color: '#666' }} />
                        <Typography variant="subtitle1" color="textSecondary">
                            {time}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography 
                            variant="caption" 
                            sx={{ 
                                color: '#666',
                                backgroundColor: '#f5f5f5',
                                px: 1.5,
                                py: 0.5,
                                borderRadius: 1,
                                fontWeight: 500
                            }}
                        >
                            {league.name}
                        </Typography>
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                onHeartClick(match);
                            }}
                            sx={{
                                color: isFavorited ? '#FF385C' : '#666',
                                '&:hover': {
                                    color: '#FF385C',
                                    backgroundColor: 'rgba(255, 56, 92, 0.04)'
                                }
                            }}
                        >
                            {isFavorited ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
                        </IconButton>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <Avatar 
                            src={teams.home.logo} 
                            alt={teams.home.name}
                            sx={{ width: 40, height: 40 }}
                        />
                        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                            {teams.home.name}
                        </Typography>
                    </Box>
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            mx: 2, 
                            color: '#666',
                            fontWeight: 600
                        }}
                    >
                        vs
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'flex-end' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                            {teams.away.name}
                        </Typography>
                        <Avatar 
                            src={teams.away.logo} 
                            alt={teams.away.name}
                            sx={{ width: 40, height: 40 }}
                        />
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                    <Stadium sx={{ color: '#666', fontSize: 20 }} />
                    <Typography variant="body2" color="textSecondary">
                        {venue.name}, {venue.city}
                    </Typography>
                </Box>
                {distance && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <LocationOn sx={{ color: '#666', fontSize: 20 }} />
                        <Typography variant="body2" color="textSecondary">
                            {distance.toFixed(1)} miles away
                        </Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
};

const Matches = ({ 
    matches, 
    onMatchClick, 
    userLocation, 
    selectedMatch,
    onHeartClick = () => {},
    favoritedMatches = []
}) => {
    // Use distances from backend response (calculated server-side)
    const matchesWithDistance = useMemo(() => {
        return matches.map(match => {
            // Distance is now calculated in the backend and included in venue object
            const distance = match.fixture.venue?.distance || null;
            return { ...match, distance };
        });
    }, [matches]);

    // Group matches by date
    const groupedMatches = useMemo(() => {
        return matchesWithDistance.reduce((groups, match) => {
            const date = format(new Date(match.fixture.date), 'yyyy-MM-dd');
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(match);
            return groups;
        }, {});
    }, [matchesWithDistance]);

    // Sort function that prioritizes distance if available, then falls back to time
    const sortMatches = (a, b) => {
        if (userLocation) {
            // If both matches have distances, sort by distance
            if (a.distance !== null && b.distance !== null) {
                return a.distance - b.distance;
            }
            // Put matches with distances first
            if (a.distance !== null) return -1;
            if (b.distance !== null) return 1;
        }
        // Fall back to time-based sorting
        return new Date(a.fixture.date) - new Date(b.fixture.date);
    };

    return (
        <Box>
            {Object.entries(groupedMatches)
                .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
                .map(([date, dateMatches]) => {
                    const firstMatch = dateMatches[0];
                    const { fullDate } = formatMatchDateTime(firstMatch.fixture.date, firstMatch.fixture.venue);

                    return (
                        <Box key={date} sx={{ mb: 4 }}>
                            <Typography 
                                variant="h6" 
                                sx={{ 
                                    mb: 2,
                                    color: '#222',
                                    fontWeight: 600
                                }}
                            >
                                {fullDate}
                            </Typography>
                            {dateMatches
                                .sort(sortMatches)
                                .map(match => (
                                    <MatchCard
                                        key={match.fixture.id}
                                        match={match}
                                        onClick={onMatchClick}
                                        distance={match.distance}
                                        isSelected={selectedMatch?.fixture.id === match.fixture.id}
                                        onHeartClick={onHeartClick}
                                        isFavorited={favoritedMatches.includes(match.fixture.id)}
                                    />
                                ))}
                        </Box>
                    );
                })}
        </Box>
    );
};

export default Matches; 