import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Container,
    Grid,
    Card,
    CardContent,
    Typography,
    Box,
    IconButton,
    CircularProgress,
    Button,
    Chip
} from '@mui/material';
import { ArrowBack, Stadium, AccessTime } from '@mui/icons-material';
import format from 'date-fns/format';
import parseISO from 'date-fns/parseISO';
import axios from 'axios';

const Matches = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchMatches = async () => {
            if (!location.state?.dates) {
                navigate('/');
                return;
            }

            const { departure, return: returnDate } = location.state.dates;
            
            try {
                const API_KEY = '2a9e46d07879477e9e4b1506101a299f';
                const response = await axios.get(
                    `/v4/competitions/PL/matches`,
                    {
                        headers: {
                            'X-Auth-Token': API_KEY
                        },
                        params: {
                            dateFrom: departure,
                            dateTo: returnDate
                        }
                    }
                );

                setMatches(response.data.matches || []);
            } catch (err) {
                setError('Failed to fetch matches. Please try again later.');
                console.error('Error fetching matches:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMatches();
    }, [location.state, navigate]);

    if (loading) {
        return (
            <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                minHeight="100vh"
                sx={{ backgroundColor: '#F7F7F7' }}
            >
                <CircularProgress sx={{ color: '#FF385C' }} />
            </Box>
        );
    }

    if (error) {
        return (
            <Container>
                <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    justifyContent="center"
                    minHeight="100vh"
                    gap={2}
                    sx={{ backgroundColor: '#F7F7F7' }}
                >
                    <Typography color="error">{error}</Typography>
                    <Button
                        variant="contained"
                        onClick={() => navigate('/')}
                        sx={{
                            backgroundColor: '#FF385C',
                            '&:hover': {
                                backgroundColor: '#E61E4D'
                            }
                        }}
                    >
                        Go Back
                    </Button>
                </Box>
            </Container>
        );
    }

    // Group matches by date
    const matchesByDate = matches.reduce((acc, match) => {
        const date = match.utcDate.split('T')[0];
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(match);
        return acc;
    }, {});

    return (
        <Box sx={{ backgroundColor: '#F7F7F7', minHeight: '100vh', py: 4 }}>
            <Container maxWidth="lg">
                <Box sx={{ mb: 4 }}>
                    <IconButton
                        onClick={() => navigate('/')}
                        sx={{ mb: 2, color: '#FF385C' }}
                    >
                        <ArrowBack />
                    </IconButton>
                    <Typography 
                        variant="h4" 
                        component="h1" 
                        gutterBottom
                        sx={{ 
                            fontWeight: 700,
                            color: '#222222'
                        }}
                    >
                        Matches During Your Trip
                    </Typography>
                    <Typography 
                        variant="subtitle1" 
                        sx={{ 
                            color: '#717171',
                            fontWeight: 500
                        }}
                    >
                        {format(parseISO(location.state.dates.departure), 'MMM d, yyyy')} - {format(parseISO(location.state.dates.return), 'MMM d, yyyy')}
                    </Typography>
                </Box>

                {Object.entries(matchesByDate).map(([date, dayMatches]) => (
                    <Box key={date} sx={{ mb: 6 }}>
                        <Typography 
                            variant="h5" 
                            sx={{ 
                                mb: 3,
                                fontWeight: 600,
                                color: '#222222'
                            }}
                        >
                            {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                        </Typography>
                        <Grid container spacing={3}>
                            {dayMatches.map((match) => (
                                <Grid item xs={12} md={6} key={match.id}>
                                    <Card 
                                        elevation={0}
                                        sx={{
                                            height: '100%',
                                            transition: 'transform 0.2s, box-shadow 0.2s',
                                            border: '1px solid #EBEBEB',
                                            '&:hover': {
                                                transform: 'translateY(-4px)',
                                                boxShadow: '0 6px 16px rgba(0,0,0,0.12)'
                                            }
                                        }}
                                    >
                                        <CardContent>
                                            <Box sx={{ mb: 2 }}>
                                                <Chip 
                                                    icon={<AccessTime sx={{ fontSize: 16 }} />}
                                                    label={format(parseISO(match.utcDate), 'h:mm a')}
                                                    size="small"
                                                    sx={{ 
                                                        backgroundColor: '#FFE1E3',
                                                        color: '#FF385C',
                                                        mr: 1
                                                    }}
                                                />
                                                {match.venue && (
                                                    <Chip 
                                                        icon={<Stadium sx={{ fontSize: 16 }} />}
                                                        label={match.venue}
                                                        size="small"
                                                        sx={{ 
                                                            backgroundColor: '#F7F7F7',
                                                            color: '#717171'
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 2
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                        flex: 1
                                                    }}
                                                >
                                                    <img
                                                        src={match.homeTeam.crest}
                                                        alt={match.homeTeam.shortName}
                                                        style={{
                                                            width: 32,
                                                            height: 32,
                                                            objectFit: 'contain'
                                                        }}
                                                    />
                                                    <Typography 
                                                        sx={{ 
                                                            fontWeight: 500,
                                                            color: '#222222'
                                                        }}
                                                    >
                                                        {match.homeTeam.shortName}
                                                    </Typography>
                                                </Box>
                                                <Typography 
                                                    variant="body2" 
                                                    sx={{ 
                                                        mx: 1,
                                                        color: '#717171',
                                                        fontWeight: 500
                                                    }}
                                                >
                                                    vs
                                                </Typography>
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                        flex: 1,
                                                        justifyContent: 'flex-end'
                                                    }}
                                                >
                                                    <Typography 
                                                        sx={{ 
                                                            fontWeight: 500,
                                                            color: '#222222'
                                                        }}
                                                    >
                                                        {match.awayTeam.shortName}
                                                    </Typography>
                                                    <img
                                                        src={match.awayTeam.crest}
                                                        alt={match.awayTeam.shortName}
                                                        style={{
                                                            width: 32,
                                                            height: 32,
                                                            objectFit: 'contain'
                                                        }}
                                                    />
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                ))}

                {matches.length === 0 && (
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            minHeight: '50vh'
                        }}
                    >
                        <Typography 
                            variant="h6" 
                            sx={{ 
                                color: '#717171',
                                textAlign: 'center'
                            }}
                        >
                            No matches found during your selected dates.
                        </Typography>
                    </Box>
                )}
            </Container>
        </Box>
    );
};

export default Matches; 