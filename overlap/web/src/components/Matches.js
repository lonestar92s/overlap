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

// Helper function to format match date and time
const formatMatchDateTime = (utcDate) => {
    const date = new Date(utcDate);
    return {
        date: format(date, 'EEE, MMM d'),
        time: format(date, 'h:mm a')
    };
};

const MatchCard = ({ match, onClick, distance, isSelected }) => {
    const { date, time } = formatMatchDateTime(match.utcDate);
    const venue = getVenueForTeam(match.homeTeam.name);
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

    // Group sorted matches by date
    const groupedMatches = useMemo(() => {
        return sortedMatches.reduce((groups, match) => {
            const date = format(new Date(match.utcDate), 'yyyy-MM-dd');
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(match);
            return groups;
        }, {});
    }, [sortedMatches]);

    return (
        <Box>
            {Object.entries(groupedMatches).map(([date, dateMatches]) => (
                <Box key={date} sx={{ mb: 4 }}>
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            mb: 2,
                            color: '#222',
                            fontWeight: 600
                        }}
                    >
                        {format(new Date(date), 'EEEE, MMMM d')}
                    </Typography>
                    {dateMatches.map(match => (
                        <MatchCard 
                            key={match.id} 
                            match={match}
                            onClick={onMatchClick}
                            distance={match.distance}
                            isSelected={selectedMatch && selectedMatch.id === match.id}
                        />
                    ))}
                </Box>
            ))}
        </Box>
    );
};

export default Matches; 