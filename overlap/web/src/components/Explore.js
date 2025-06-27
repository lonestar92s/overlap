import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  TrendingUp as TrendingIcon,
  Schedule as ScheduleIcon,
  EmojiEvents as TrophyIcon,
  Group as TeamIcon,
  Sports as SportsIcon
} from '@mui/icons-material';

const Explore = () => {
  const [loading, setLoading] = useState(true);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [popularLeagues, setPopularLeagues] = useState([]);
  const [trendingTeams, setTrendingTeams] = useState([]);

  useEffect(() => {
    // Simulate loading data
    setTimeout(() => {
      setUpcomingMatches(getMockUpcomingMatches());
      setPopularLeagues(getMockPopularLeagues());
      setTrendingTeams(getMockTrendingTeams());
      setLoading(false);
    }, 1000);
  }, []);

  const getMockUpcomingMatches = () => [
    {
      id: 1,
      homeTeam: 'Arsenal FC',
      awayTeam: 'Chelsea FC',
      league: 'Premier League',
      date: '2025-01-25',
      time: '15:00',
      venue: 'Emirates Stadium'
    },
    {
      id: 2,
      homeTeam: 'Real Madrid CF',
      awayTeam: 'FC Barcelona',
      league: 'La Liga',
      date: '2025-01-26',
      time: '20:00',
      venue: 'Santiago Bernabéu'
    },
    {
      id: 3,
      homeTeam: 'FC Bayern München',
      awayTeam: 'Borussia Dortmund',
      league: 'Bundesliga',
      date: '2025-01-27',
      time: '18:30',
      venue: 'Allianz Arena'
    }
  ];

  const getMockPopularLeagues = () => [
    { name: 'Premier League', country: 'England', teams: 20, matches: 380 },
    { name: 'La Liga', country: 'Spain', teams: 20, matches: 380 },
    { name: 'Bundesliga', country: 'Germany', teams: 18, matches: 306 },
    { name: 'Serie A', country: 'Italy', teams: 20, matches: 380 },
    { name: 'Ligue 1', country: 'France', teams: 18, matches: 306 },
    { name: 'Champions League', country: 'Europe', teams: 32, matches: 125 }
  ];

  const getMockTrendingTeams = () => [
    { name: 'Arsenal FC', league: 'Premier League', country: 'England' },
    { name: 'Real Madrid CF', league: 'La Liga', country: 'Spain' },
    { name: 'FC Bayern München', league: 'Bundesliga', country: 'Germany' },
    { name: 'Manchester City FC', league: 'Premier League', country: 'England' },
    { name: 'FC Barcelona', league: 'La Liga', country: 'Spain' },
    { name: 'Liverpool FC', league: 'Premier League', country: 'England' }
  ];

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1200, margin: '0 auto', padding: 3, mt: 10 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto', padding: { xs: 2, sm: 3 }, mt: { xs: 8, sm: 10 } }}>
      <Paper elevation={3} sx={{ padding: { xs: 3, sm: 4 } }}>
        <Typography variant="h4" component="h1" mb={3} sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>
          Explore Football
        </Typography>

        <Grid container spacing={{ xs: 2, sm: 4 }}>
          {/* Upcoming Matches */}
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ScheduleIcon sx={{ mr: 1, color: '#FF385C' }} />
                <Typography variant="h6" component="h2" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                  Upcoming Matches
                </Typography>
              </Box>
              
              {upcomingMatches.map((match) => (
                <Card key={match.id} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                  <CardContent sx={{ py: { xs: 1.5, sm: 2 } }}>
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: { xs: 1, sm: 0 }
                    }}>
                      <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                          {match.homeTeam} vs {match.awayTeam}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                          {match.venue}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: { xs: 'center', sm: 'right' } }}>
                        <Chip 
                          label={match.league}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ mb: 0.5, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                        />
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                          {match.date} at {match.time}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Grid>

          {/* Popular Leagues */}
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrophyIcon sx={{ mr: 1, color: '#FF385C' }} />
                <Typography variant="h6" component="h2" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                  Popular Leagues
                </Typography>
              </Box>
              
              <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                {popularLeagues.map((league, index) => (
                  <Grid item xs={12} sm={6} key={index}>
                    <Card sx={{ border: '1px solid #e0e0e0', cursor: 'pointer', '&:hover': { boxShadow: 2 } }}>
                      <CardContent sx={{ py: { xs: 1.5, sm: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <SportsIcon sx={{ mr: 1, color: '#666', fontSize: { xs: 18, sm: 20 } }} />
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                            {league.name}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                          {league.country}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: { xs: 1.5, sm: 2 } }} />
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TrendingIcon sx={{ mr: 1, color: '#FF385C' }} />
              <Typography variant="h6" component="h2" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                Trending Teams
              </Typography>
            </Box>
            
            <Grid container spacing={{ xs: 1.5, sm: 2 }}>
              {trendingTeams.map((team, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card sx={{ border: '1px solid #e0e0e0', cursor: 'pointer', '&:hover': { boxShadow: 2 } }}>
                    <CardContent sx={{ py: { xs: 1.5, sm: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <TeamIcon sx={{ mr: 1, color: '#666', fontSize: { xs: 18, sm: 20 } }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                          {team.name}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                        {team.league} • {team.country}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Explore; 