import React, { useMemo, useRef, useEffect } from 'react';
import { 
    Card, 
    CardContent, 
    Typography, 
    Box,
    Avatar,
    Button,
    IconButton,
    useMediaQuery,
    useTheme
} from '@mui/material';
import { Stadium, AccessTime, LocationOn, FavoriteBorder, Favorite } from '@mui/icons-material';
import { format } from 'date-fns';
import { formatMatchDateTime } from '../utils/timezone';
import TeamLogo from './TeamLogo';
// getVenueForTeam import removed - distances now calculated in backend

// Export MatchCard component
export const MatchCard = ({ 
    match, 
    onClick, 
    distance, 
    isSelected,
    onHeartClick = () => {},
    isFavorited = false,
    onStadiumClick = () => {},
    isStadiumVisited = false,
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    
    // Extract data from the new API response format and provide defaults
    const fixture = match?.fixture || {};
    const teams = match?.teams || { home: {}, away: {} };
    const league = match?.league || {};
    const venue = fixture?.venue || { name: 'Unknown Venue', city: 'Unknown City' };
    
    // Add logging for venue data
    console.log(`[MatchCard] Venue data for match ${fixture.id}:`, {
        venue,
        homeTeam: teams.home?.name,
        awayTeam: teams.away?.name,
        league: league.name,
        rawMatch: match // Log full match object for debugging
    });

    const { date, time } = formatMatchDateTime(fixture.date || new Date(), venue);
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
                mb: { xs: 1.5, sm: 2 },
                border: '1px solid #eee',
                borderRadius: 2,
                transition: 'all 0.2s ease-in-out',
                cursor: 'pointer',
                backgroundColor: isSelected ? '#F8F9FF' : 'white',
                borderColor: isSelected ? '#385CFF' : '#eee',
                '&:hover': {
                    transform: { xs: 'none', sm: 'translateY(-2px)' },
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    borderColor: '#385CFF'
                }
            }}
        >
            <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 2, sm: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <AccessTime sx={{ mr: 1, color: '#666', fontSize: { xs: 18, sm: 24 } }} />
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <Typography variant="subtitle1" color="textSecondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                                {formatMatchDateTime(fixture.date || new Date(), venue).fullDate}
                            </Typography>
                            <Typography variant="subtitle2" color="textSecondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.9rem' } }}>
                                {time}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, lineHeight: 1 }}>
                                {formatMatchDateTime(fixture.date || new Date(), venue).timeZone}
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
                        <Typography 
                            variant="caption" 
                            sx={{ 
                                color: '#666',
                                backgroundColor: '#f5f5f5',
                                px: { xs: 1, sm: 1.5 },
                                py: 0.5,
                                borderRadius: 1,
                                fontWeight: 500,
                                fontSize: { xs: '0.7rem', sm: '0.75rem' }
                            }}
                        >
                            {league.name || 'Unknown League'}
                        </Typography>
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                onStadiumClick(match);
                            }}
                            sx={{
                                color: isStadiumVisited ? '#4CAF50' : '#666',
                                p: { xs: 0.5, sm: 1 },
                                '&:hover': {
                                    color: '#4CAF50',
                                    backgroundColor: 'rgba(76, 175, 80, 0.04)'
                                }
                            }}
                            title={isStadiumVisited ? "You've been to this stadium" : "Mark stadium as visited"}
                        >
                            <Stadium fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                onHeartClick(match);
                            }}
                            sx={{
                                color: isFavorited ? '#FF385C' : '#666',
                                p: { xs: 0.5, sm: 1 },
                                '&:hover': {
                                    color: '#FF385C',
                                    backgroundColor: 'rgba(255, 56, 92, 0.04)'
                                }
                            }}
                            title={isFavorited ? "Remove from want to go" : "Add to want to go"}
                        >
                            {isFavorited ? <Favorite fontSize="small" /> : <FavoriteBorder fontSize="small" />}
                        </IconButton>
                    </Box>
                </Box>
                <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    mb: { xs: 1.5, sm: 2 },
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 1, sm: 0 }
                }}>
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: { xs: 1.5, sm: 2 }, 
                        flex: 1,
                        justifyContent: { xs: 'center', sm: 'flex-start' }
                    }}>
                        <TeamLogo 
                            src={teams.home?.logo} 
                            alt={teams.home?.name}
                            teamName={teams.home?.name}
                            size={isMobile ? 32 : 40}
                        />
                        <Typography 
                            variant="subtitle1" 
                            sx={{ 
                                fontWeight: 500,
                                fontSize: { xs: '0.875rem', sm: '1rem' },
                                textAlign: { xs: 'center', sm: 'left' }
                            }}
                        >
                            {teams.home?.name || 'Unknown Team'}
                        </Typography>
                    </Box>
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            mx: { xs: 1, sm: 2 }, 
                            color: '#666',
                            fontWeight: 600,
                            fontSize: { xs: '1rem', sm: '1.25rem' }
                        }}
                    >
                        vs
                    </Typography>
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: { xs: 1.5, sm: 2 }, 
                        flex: 1, 
                        justifyContent: { xs: 'center', sm: 'flex-end' }
                    }}>
                        <Typography 
                            variant="subtitle1" 
                            sx={{ 
                                fontWeight: 500,
                                fontSize: { xs: '0.875rem', sm: '1rem' },
                                textAlign: { xs: 'center', sm: 'right' }
                            }}
                        >
                            {teams.away?.name || 'Unknown Team'}
                        </Typography>
                        <TeamLogo 
                            src={teams.away?.logo} 
                            alt={teams.away?.name}
                            teamName={teams.away?.name}
                            size={isMobile ? 32 : 40}
                        />
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: { xs: 1.5, sm: 2 } }}>
                    <Stadium sx={{ color: '#666', fontSize: { xs: 18, sm: 20 } }} />
                    <Typography variant="body2" color="textSecondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        {venue.name}{venue.city ? `, ${venue.city}` : ''}
                    </Typography>
                </Box>
                {distance && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <LocationOn sx={{ color: '#666', fontSize: { xs: 18, sm: 20 } }} />
                        <Typography 
                            variant="body2" 
                            color="textSecondary"
                            sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                        >
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
    favoritedMatches = [],
    onStadiumClick = () => {},
    visitedStadiums = [],
    isStadiumVisited = () => false
}) => {
    // Add logging when matches are received
    useEffect(() => {
        console.log('[Matches] Received matches:', matches.map(match => ({
            id: match.fixture?.id,
            venue: match.fixture?.venue,
            homeTeam: match.teams?.home?.name,
            awayTeam: match.teams?.away?.name,
            league: match.league?.name
        })));
    }, [matches]);

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
                                .map(match => {
                                    // Check if this stadium has been visited
                                    const stadiumVisited = isStadiumVisited(match);

                                    return (
                                        <MatchCard
                                            key={match.fixture.id}
                                            match={match}
                                            onClick={onMatchClick}
                                            distance={match.distance}
                                            isSelected={selectedMatch?.fixture.id === match.fixture.id}
                                            onHeartClick={onHeartClick}
                                            isFavorited={favoritedMatches.includes(match.fixture.id)}
                                            onStadiumClick={onStadiumClick}
                                            isStadiumVisited={stadiumVisited}
                                        />
                                    );
                                })}
                        </Box>
                    );
                })}
        </Box>
    );
};

export default Matches; 