import React, { useMemo, useRef, useEffect } from 'react';
import { 
    Card, 
    CardContent, 
    Typography, 
    Box,
    Avatar,
    Button
} from '@mui/material';
import { Stadium, AccessTime, LocationOn } from '@mui/icons-material';
import { format } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';
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

const MatchCard = ({ match, onClick, distance, isSelected, onSelectMatch, isSelectable, isInItinerary }) => {
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

    const handleSelectMatch = (e) => {
        e.stopPropagation();
        console.log('Match select button clicked:', match.id);
        console.log('Is selectable:', isSelectable);
        console.log('Is in itinerary:', isInItinerary);
        onSelectMatch(match);
    };

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
                backgroundColor: isInItinerary ? '#FFF8F9' : isSelected ? '#F8F9FF' : 'white',
                borderColor: isInItinerary ? '#FF385C' : isSelected ? '#385CFF' : '#eee',
                opacity: !isSelectable && !isInItinerary ? 0.5 : 1,
                '&:hover': {
                    transform: isSelectable || isInItinerary ? 'translateY(-2px)' : 'none',
                    boxShadow: isSelectable || isInItinerary ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                    borderColor: isInItinerary ? '#FF385C' : isSelected ? '#385CFF' : '#ddd'
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
                            {match.competition.leagueName}
                        </Typography>
                        {(isSelectable || isInItinerary) && (
                            <Button
                                variant={isInItinerary ? "contained" : "outlined"}
                                size="small"
                                onClick={handleSelectMatch}
                                sx={{
                                    minWidth: 'auto',
                                    px: 1,
                                    backgroundColor: isInItinerary ? '#FF385C' : 'transparent',
                                    borderColor: isInItinerary ? '#FF385C' : '#385CFF',
                                    color: isInItinerary ? 'white' : '#385CFF',
                                    '&:hover': {
                                        backgroundColor: isInItinerary ? '#E61E4D' : 'rgba(56, 92, 255, 0.1)',
                                        borderColor: isInItinerary ? '#E61E4D' : '#385CFF',
                                    }
                                }}
                            >
                                {isInItinerary ? 'Remove' : 'Add'}
                            </Button>
                        )}
                    </Box>
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

const Matches = ({ 
    matches, 
    onMatchClick, 
    userLocation, 
    selectedMatch,
    onSelectMatch,
    selectedMatches = [],
    maxDistance = 300 // Maximum allowed distance between venues in miles
}) => {
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
                    venue.coordinates[1],
                    venue.coordinates[0]
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

    // Check if a match can be added to the itinerary
    const isMatchSelectable = (match) => {
        if (selectedMatches.length >= 5) return false;
        
        // Check for time conflicts
        const matchDate = new Date(match.utcDate);
        return !selectedMatches.some(selected => {
            const selectedDate = new Date(selected.utcDate);
            // Consider matches within 4 hours of each other as conflicts
            return Math.abs(matchDate.getTime() - selectedDate.getTime()) < 4 * 60 * 60 * 1000;
        });
    };

    // Check if venues are too far apart
    const areVenuesReachable = (match) => {
        if (selectedMatches.length === 0) return true;
        
        const matchVenue = getVenueForTeam(match.homeTeam.name);
        if (!matchVenue?.coordinates) return false;

        return selectedMatches.every(selected => {
            const selectedVenue = getVenueForTeam(selected.homeTeam.name);
            if (!selectedVenue?.coordinates) return false;

            const distance = calculateDistance(
                matchVenue.coordinates[1],
                matchVenue.coordinates[0],
                selectedVenue.coordinates[1],
                selectedVenue.coordinates[0]
            );

            return distance <= maxDistance;
        });
    };

    // Group sorted matches by date
    const groupedMatches = useMemo(() => {
        return sortedMatches.reduce((groups, match) => {
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
                                        onSelectMatch={onSelectMatch}
                                        isSelectable={isMatchSelectable(match) && areVenuesReachable(match)}
                                        isInItinerary={selectedMatches.some(m => m.id === match.id)}
                                    />
                                ))}
                        </Box>
                    );
                })}
        </Box>
    );
};

export default Matches; 