import React, { useState, useEffect } from 'react';
import TeamSearch from './TeamSearch';
import TeamLogo from './TeamLogo';
import { Box, Typography, Container, Alert } from '@mui/material';
import { MatchCard } from './Matches';
import { useAuth } from './Auth';
import TripModal from './TripModal';

const BACKEND_URL = 'http://localhost:3001';

const TeamMatches = () => {
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [matches, setMatches] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedMatch, setSelectedMatch] = useState(null);
    const [favoritedMatches, setFavoritedMatches] = useState([]);
    const [tripModalOpen, setTripModalOpen] = useState(false);
    const [matchForTrip, setMatchForTrip] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        if (selectedTeam) {
            fetchTeamMatches();
        }
    }, [selectedTeam]);

    useEffect(() => {
        if (user) {
            fetchFavoritedMatches();
        }
    }, [user]);

    const fetchFavoritedMatches = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            // First get all trips
            const response = await fetch(`${BACKEND_URL}/api/trips`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Extract all match IDs from all trips
                const matchIds = new Set();
                data.trips.forEach(trip => {
                    trip.matches.forEach(match => {
                        matchIds.add(match.matchId);
                    });
                });
                setFavoritedMatches(Array.from(matchIds));
            }
        } catch (error) {
            console.error('Error fetching favorited matches:', error);
        }
    };

    const fetchTeamMatches = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${BACKEND_URL}/api/matches/by-team/${selectedTeam.id}`);
            const data = await response.json();
            if (data.success) {
                setMatches(data.matches);
            } else {
                setError(data.message || 'Failed to fetch matches');
            }
        } catch (error) {
            setError('Error fetching matches. Please try again.');
            console.error('Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTeamSelect = (team) => {
        setSelectedTeam(team);
        setMatches([]);
        setSelectedMatch(null);
    };

    const handleMatchClick = (match) => {
        setSelectedMatch(match.id === selectedMatch?.id ? null : match);
    };

    const handleHeartClick = async (match) => {
        if (!user) {
            setError('Please log in to save matches to your trips');
            return;
        }

        // Open trip modal with the selected match
        setMatchForTrip(match);
        setTripModalOpen(true);
    };

    const handleMatchAddedToTrip = (matchId) => {
        // Update favorited matches list
        setFavoritedMatches(prev => [...prev, matchId.toString()]);
    };

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4 }}>
                Find Team Matches
            </Typography>
            
            <Box sx={{ maxWidth: 600, mx: 'auto', mb: 6 }}>
                <TeamSearch 
                    onTeamSelect={handleTeamSelect}
                    placeholder="Search for a team..."
                    selectedTeams={selectedTeam ? [selectedTeam] : []}
                />
            </Box>

            {error && (
                <Alert 
                    severity="error" 
                    sx={{ mb: 3 }}
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}

            {selectedTeam && (
                <Box sx={{ mb: 4, textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <TeamLogo 
                            src={selectedTeam.logo} 
                            alt={`${selectedTeam.name} logo`}
                            teamName={selectedTeam.name}
                            size={48}
                        />
                        <Typography variant="h5" component="h2">
                            {selectedTeam.name}
                        </Typography>
                    </Box>
                </Box>
            )}

            {isLoading && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography>Loading matches...</Typography>
                </Box>
            )}

            {!isLoading && !error && matches.length > 0 && (
                <Box>
                    {matches.map((match) => (
                        <MatchCard
                            key={match.fixture.id}
                            match={match}
                            onClick={handleMatchClick}
                            isSelected={selectedMatch?.fixture.id === match.fixture.id}
                            onHeartClick={handleHeartClick}
                            isFavorited={favoritedMatches.includes(match.fixture.id.toString())}
                        />
                    ))}
                </Box>
            )}

            {!isLoading && !error && matches.length === 0 && selectedTeam && (
                <Box sx={{ 
                    textAlign: 'center', 
                    py: 4, 
                    bgcolor: '#F5F5F5', 
                    borderRadius: 2
                }}>
                    <Typography>
                        No upcoming matches found for {selectedTeam.name}
                    </Typography>
                </Box>
            )}

            <TripModal
                open={tripModalOpen}
                onClose={() => {
                    setTripModalOpen(false);
                    setMatchForTrip(null);
                }}
                match={matchForTrip}
                onMatchAddedToTrip={handleMatchAddedToTrip}
            />
        </Container>
    );
};

export default TeamMatches; 