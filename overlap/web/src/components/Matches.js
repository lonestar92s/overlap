import React, { useMemo } from 'react';
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

// Helper function to format match date and time
const formatMatchDateTime = (utcDate) => {
    const date = new Date(utcDate);
    return {
        date: format(date, 'EEE, MMM d'),
        time: format(date, 'h:mm a')
    };
};

const MatchCard = ({ match, onClick }) => {
    const { date, time } = formatMatchDateTime(match.utcDate);
    const venue = getVenueForTeam(match.homeTeam.name);

    return (
        <Card 
            elevation={0}
            onClick={() => onClick(match)}
            sx={{
                mb: 2,
                border: '1px solid #eee',
                borderRadius: 2,
                transition: 'all 0.2s ease-in-out',
                cursor: 'pointer',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    borderColor: '#ddd'
                }
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', mb: 3 }}>
                    <AccessTime sx={{ mr: 1, color: '#666' }} />
                    <Typography variant="subtitle1" color="textSecondary">
                        {time}
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
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Stadium sx={{ mr: 1, color: '#666' }} />
                        <Typography variant="body2" color="textSecondary">
                            {venue.stadium}
                        </Typography>
                    </Box>
                    {venue.location && (
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
                    )}
                </Box>
            </CardContent>
        </Card>
    );
};

const Matches = ({ matches, onMatchClick }) => {
    // Group matches by date
    const groupedMatches = useMemo(() => {
        return matches.reduce((groups, match) => {
            const date = format(new Date(match.utcDate), 'yyyy-MM-dd');
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(match);
            return groups;
        }, {});
    }, [matches]);

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
                        />
                    ))}
                </Box>
            ))}
        </Box>
    );
};

export default Matches; 