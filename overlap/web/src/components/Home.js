import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Container, 
    Paper, 
    TextField, 
    Button, 
    Typography,
    Box,
    Grid
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import format from 'date-fns/format';
import startOfToday from 'date-fns/startOfToday';

const Home = () => {
    const navigate = useNavigate();
    const [dates, setDates] = useState({
        departure: null,
        return: null
    });

    const today = startOfToday();

    const handleSearch = () => {
        if (dates.departure && dates.return) {
            const formattedDates = {
                departure: format(dates.departure, 'yyyy-MM-dd'),
                return: format(dates.return, 'yyyy-MM-dd')
            };
            navigate('/matches', { state: { dates: formattedDates } });
        }
    };

    return (
        <Container maxWidth="lg">
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    py: 4,
                    // background: 'linear-gradient(to bottom, #FF385C, #E61E4D)'
                }}
            >
                <Paper 
                    elevation={3}
                    sx={{
                        p: 6,
                        width: '100%',
                        maxWidth: 800,
                        borderRadius: 4,
                        textAlign: 'center'
                    }}
                >
                    <Typography 
                        variant="h2" 
                        component="h1" 
                        gutterBottom
                        sx={{ 
                            fontWeight: 800,
                            mb: 4,
                            color: '#222222',
                            fontSize: { xs: '2.5rem', md: '3.5rem' }
                        }}
                    >
                        Find Premier League Matches
                        <Typography
                            variant="h2"
                            component="span"
                            sx={{
                                display: 'block',
                                color: '#FF385C',
                                fontSize: { xs: '2rem', md: '3rem' },
                                fontWeight: 700
                            }}
                        >
                            During Your Trip
                        </Typography>
                    </Typography>

                    <Box sx={{ mt: 6 }}>
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <LocalizationProvider dateAdapter={AdapterDateFns}>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <DatePicker
                                                label="Departure Date"
                                                value={dates.departure}
                                                onChange={(newValue) => {
                                                    setDates(prev => ({
                                                        ...prev,
                                                        departure: newValue,
                                                        return: prev.return && newValue && prev.return < newValue ? null : prev.return
                                                    }));
                                                }}
                                                minDate={today}
                                                slotProps={{ 
                                                    textField: { 
                                                        fullWidth: true,
                                                        error: false,
                                                        helperText: '' 
                                                    } 
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <DatePicker
                                                label="Return Date"
                                                value={dates.return}
                                                onChange={(newValue) => {
                                                    setDates(prev => ({
                                                        ...prev,
                                                        return: newValue
                                                    }));
                                                }}
                                                minDate={dates.departure || today}
                                                disabled={!dates.departure}
                                                slotProps={{ 
                                                    textField: { 
                                                        fullWidth: true,
                                                        error: false,
                                                        helperText: !dates.departure ? 'Select departure date first' : '' 
                                                    } 
                                                }}
                                            />
                                        </Grid>
                                    </Grid>
                                </LocalizationProvider>
                            </Grid>
                            <Grid item xs={12}>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    fullWidth
                                    size="large"
                                    onClick={handleSearch}
                                    disabled={!dates.departure || !dates.return}
                                    sx={{
                                        py: 2,
                                        mt: 2,
                                        backgroundColor: '#FF385C',
                                        fontSize: '1.1rem',
                                        fontWeight: 600,
                                        '&:hover': {
                                            backgroundColor: '#E61E4D'
                                        },
                                        '&.Mui-disabled': {
                                            backgroundColor: '#FFB3C0',
                                            color: '#FFF'
                                        }
                                    }}
                                >
                                    Search Matches
                                </Button>
                            </Grid>
                        </Grid>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
};

export default Home; 