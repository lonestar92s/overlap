import React, { useMemo, useRef, useEffect } from 'react';
import { 
    Grid, 
    Card, 
    CardContent, 
    Typography, 
    Box,
    Avatar
} from '@mui/material';
import { Stadium, AccessTime, LocationOn } from '@mui/icons-material';
import { format } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { getVenueForTeam } from '../data/venues';

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
    const timeZoneDisplay = timeZone.split('/')[1] || 'UTC';
    
    // Convert UTC date to venue's timezone
    const zonedDate = utcToZonedTime(date, timeZone);
    
    // Format the date and time in the venue's timezone
    return {
        date: format(zonedDate, 'EEE, MMM d'),
        time: format(zonedDate, 'h:mm a') + ' ' + timeZoneDisplay,
        fullDate: format(zonedDate, 'EEEE, MMMM d'),
        // Keep groupDate in UTC to ensure consistent grouping
        groupDate: format(date, 'yyyy-MM-dd')
    };
};

const MatchCard = ({ match, onClick, distance, isSelected }) => {
    const venue = getVenueForTeam(match.homeTeam.name);
    const { date, time } = formatMatchDateTime(match.utcDate, venue);
    const cardRef = useRef(null);

    useEffect(() => {
        if (isSelected && cardRef.current) {
            cardRef.current.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center'
            });
        }
    }, [isSelected]);

    // Log missing venue for debugging
    if (!venue) {
        console.warn(`No venue data found for team: ${match.homeTeam.name}`);
    }

    return (
        <Card 
            ref={cardRef}
            id={`match-${match.id}`}
            elevation={0}
            onClick={() => onClick(match)}
            sx={{
                mb: 2,
                border: '1px solid #eee',
                borderRadius: 2,
                transition: 'all 0.2s ease-in-out',
                cursor: 'pointer',
                backgroundColor: isSelected ? '#FFF8F9' : 'white',
                borderColor: isSelected ? '#FF385C' : '#eee',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    borderColor: isSelected ? '#FF385C' : '#ddd'
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
                        {match.competition.leagueName}
                    </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        <Avatar 
                            src={match.homeTeam.crest} 
                            alt={match.homeTeam.name}
                            sx={{ 
                                width: 32, 
                                height: 32, 
                                mr: 1,
                                backgroundColor: 'transparent'
                            }}
                        />
                        <Typography 
                            variant="body1"
                            sx={{ 
                                fontWeight: 500,
                                color: '#222'
                            }}
                        >
                            {match.homeTeam.name}
                        </Typography>
                    </Box>
                    <Typography 
                        variant="body1" 
                        sx={{ 
                            mx: 2,
                            color: '#666',
                            fontWeight: 500
                        }}
                    >
                        vs
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                        <Typography 
                            variant="body1"
                            sx={{ 
                                fontWeight: 500,
                                color: '#222',
                                mr: 1
                            }}
                        >
                            {match.awayTeam.name}
                        </Typography>
                        <Avatar 
                            src={match.awayTeam.crest} 
                            alt={match.awayTeam.name}
                            sx={{ 
                                width: 32, 
                                height: 32,
                                backgroundColor: 'transparent'
                            }}
                        />
                    </Box>
                </Box>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {venue ? (
                        <>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Stadium sx={{ mr: 1, color: '#666' }} />
                                <Typography variant="body2" color="textSecondary">
                                    {venue.stadium}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <LocationOn sx={{ mr: 1, color: '#666', fontSize: 20 }} />
                                    <Typography 
                                        variant="body2" 
                                        color="textSecondary"
                                        sx={{ fontSize: '0.875rem' }}
                                    >
                                        {venue.location}
                                    </Typography>
                                </Box>
                                {distance != null && (
                                    <Typography 
                                        variant="body2" 
                                        color="textSecondary"
                                        sx={{ 
                                            fontSize: '0.875rem',
                                            backgroundColor: '#f5f5f5',
                                            px: 1,
                                            py: 0.5,
                                            borderRadius: 1
                                        }}
                                    >
                                        {Math.round(distance)} miles away
                                    </Typography>
                                )}
                            </Box>
                        </>
                    ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Stadium sx={{ mr: 1, color: '#666' }} />
                            <Typography variant="body2" color="textSecondary">
                                Home venue information unavailable
                            </Typography>
                        </Box>
                    )}
                </Box>
            </CardContent>
        </Card>
    );
};

const Matches = ({ matches, onMatchClick, userLocation, selectedMatch }) => {
    // Calculate distances and sort matches
    const sortedMatches = useMemo(() => {
        if (!userLocation) return matches;

        return [...matches].map(match => {
            const venue = getVenueForTeam(match.homeTeam.name);
            let distance = null;
            
            if (venue && venue.coordinates) {
                distance = calculateDistance(
                    userLocation.lat,
                    userLocation.lon,
                    venue.coordinates[1], // Venue latitude
                    venue.coordinates[0]  // Venue longitude
                );
            }
            
            return { ...match, distance };
        }).sort((a, b) => {
            // Put matches with no distance at the end
            if (a.distance === null) return 1;
            if (b.distance === null) return -1;
            return a.distance - b.distance;
        });
    }, [matches, userLocation]);

    // Group sorted matches by date using UTC
    const groupedMatches = useMemo(() => {
        return sortedMatches.reduce((groups, match) => {
            // Use UTC date for grouping
            const date = format(new Date(match.utcDate), 'yyyy-MM-dd', { timeZone: 'UTC' });
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(match);
            return groups;
        }, {});
    }, [sortedMatches]);

    return (
        <Box>
            {Object.entries(groupedMatches)
                .sort(([dateA], [dateB]) => {
                    // Compare dates in UTC
                    const dateAObj = new Date(dateA + 'T00:00:00Z');
                    const dateBObj = new Date(dateB + 'T00:00:00Z');
                    return dateAObj.getTime() - dateBObj.getTime();
                })
                .map(([date, dateMatches]) => {
                    const firstMatch = dateMatches[0];
                    const firstMatchVenue = getVenueForTeam(firstMatch.homeTeam.name);
                    const { fullDate } = formatMatchDateTime(firstMatch.utcDate, firstMatchVenue);
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
                                .sort((a, b) => {
                                    // Sort matches within a day using UTC times
                                    const dateA = new Date(a.utcDate);
                                    const dateB = new Date(b.utcDate);
                                    return dateA.getTime() - dateB.getTime();
                                })
                                .map(match => (
                                    <MatchCard 
                                        key={match.id} 
                                        match={match}
                                        onClick={onMatchClick}
                                        distance={match.distance}
                                        isSelected={selectedMatch && selectedMatch.id === match.id}
                                    />
                                ))}
                        </Box>
                    );
                })}
        </Box>
    );
};

export default Matches; 