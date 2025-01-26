import React from 'react';
import { 
    Grid, 
    Card, 
    CardContent, 
    Typography, 
    Box,
    Avatar
} from '@mui/material';
import { Stadium, AccessTime, LocationOn } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { TEAM_VENUES } from '../data/venues';

const Matches = ({ matches }) => {
    // Group matches by date
    const matchesByDate = matches.reduce((acc, match) => {
        const date = format(parseISO(match.utcDate), 'yyyy-MM-dd');
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(match);
        return acc;
    }, {});

    const getVenueInfo = (match) => {
        const homeTeamVenue = TEAM_VENUES[match.homeTeam.name];
        return homeTeamVenue || { stadium: 'Venue TBD', location: '' };
    };

    return (
        <Box>
            {Object.entries(matchesByDate).map(([date, dateMatches]) => (
                <Box key={date} sx={{ mb: 4 }}>
                    <Typography 
                        variant="h5" 
                        sx={{ 
                            mb: 2, 
                            fontWeight: 600,
                            color: '#222222'
                        }}
                    >
                        {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                    </Typography>
                    <Grid container spacing={3}>
                        {dateMatches.map((match) => {
                            const venueInfo = getVenueInfo(match);
                            return (
                                <Grid item xs={12} md={6} key={match.id}>
                                    <Card 
                                        elevation={2}
                                        sx={{
                                            height: '100%',
                                            borderRadius: 2,
                                            transition: 'transform 0.2s',
                                            '&:hover': {
                                                transform: 'translateY(-4px)'
                                            }
                                        }}
                                    >
                                        <CardContent>
                                            <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', mb: 3 }}>
                                                <AccessTime sx={{ mr: 1, color: '#666' }} />
                                                <Typography variant="subtitle1" color="textSecondary">
                                                    {format(parseISO(match.utcDate), 'h:mm a')}
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
                                                        {venueInfo.stadium}
                                                    </Typography>
                                                </Box>
                                                {venueInfo.location && (
                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                        <LocationOn sx={{ mr: 1, color: '#666', fontSize: 20 }} />
                                                        <Typography 
                                                            variant="body2" 
                                                            color="textSecondary"
                                                            sx={{ fontSize: '0.875rem' }}
                                                        >
                                                            {venueInfo.location}
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                </Box>
            ))}
        </Box>
    );
};

export default Matches; 