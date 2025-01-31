import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    FormControlLabel,
    RadioGroup,
    Radio,
    Typography,
    Box,
    IconButton,
    Checkbox,
    Divider
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { getAllLeagues, LEAGUES } from '../data/leagues';

const DISTANCE_OPTIONS = [
    { value: 50, label: '50 miles' },
    { value: 100, label: '100 miles' },
    { value: 250, label: '250 miles' }
];

const Filters = ({ 
    open, 
    onClose, 
    selectedDistance, 
    onDistanceChange,
    selectedLeagues,
    onLeaguesChange 
}) => {
    const handleDistanceChange = (event) => {
        const value = event.target.value === 'all' ? null : Number(event.target.value);
        onDistanceChange(value);
    };

    const handleLeagueChange = (leagueId) => {
        const newSelectedLeagues = selectedLeagues.includes(leagueId)
            ? selectedLeagues.filter(id => id !== leagueId)
            : [...selectedLeagues, leagueId];
        onLeaguesChange(newSelectedLeagues);
    };

    // Group leagues by country for display
    const leaguesByCountry = getAllLeagues().reduce((acc, league) => {
        const countryCode = Object.entries(LEAGUES).find(([_, leagues]) => 
            leagues.some(l => l.id === league.id)
        )?.[0];
        
        if (!acc[countryCode]) {
            acc[countryCode] = [];
        }
        acc[countryCode].push(league);
        return acc;
    }, {});

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    width: '100%',
                    maxWidth: '400px'
                }
            }}
        >
            <DialogTitle sx={{ 
                m: 0, 
                p: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                    Filter Matches
                </Typography>
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        color: (theme) => theme.palette.grey[500]
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                {/* Distance Filter */}
                <Box sx={{ py: 1 }}>
                    <Typography 
                        variant="subtitle1" 
                        sx={{ 
                            mb: 2,
                            fontWeight: 500,
                            color: '#444'
                        }}
                    >
                        Distance from your location
                    </Typography>
                    <FormControl component="fieldset">
                        <RadioGroup
                            value={selectedDistance === null ? 'all' : selectedDistance.toString()}
                            onChange={handleDistanceChange}
                        >
                            <FormControlLabel 
                                value="all" 
                                control={<Radio />} 
                                label="Show all matches"
                                sx={{ mb: 1 }}
                            />
                            {DISTANCE_OPTIONS.map((option) => (
                                <FormControlLabel
                                    key={option.value}
                                    value={option.value.toString()}
                                    control={<Radio />}
                                    label={option.label}
                                    sx={{ mb: 1 }}
                                />
                            ))}
                        </RadioGroup>
                    </FormControl>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* League Filter */}
                <Box sx={{ py: 1 }}>
                    <Typography 
                        variant="subtitle1" 
                        sx={{ 
                            mb: 2,
                            fontWeight: 500,
                            color: '#444'
                        }}
                    >
                        Leagues
                    </Typography>
                    <FormControl component="fieldset">
                        {Object.entries(leaguesByCountry).map(([countryCode, leagues]) => (
                            <Box key={countryCode} sx={{ mb: 2 }}>
                                <Typography 
                                    variant="subtitle2" 
                                    sx={{ 
                                        color: '#666',
                                        mb: 1
                                    }}
                                >
                                    {countryCode === 'GB' ? 'England' :
                                     countryCode === 'FR' ? 'France' :
                                     countryCode === 'ES' ? 'Spain' :
                                     countryCode === 'DE' ? 'Germany' : countryCode}
                                </Typography>
                                {leagues.map((league) => (
                                    <FormControlLabel
                                        key={league.id}
                                        control={
                                            <Checkbox
                                                checked={selectedLeagues.includes(league.id)}
                                                onChange={() => handleLeagueChange(league.id)}
                                            />
                                        }
                                        label={league.name}
                                        sx={{ 
                                            mb: 1,
                                            ml: 2 // Indent leagues under country
                                        }}
                                    />
                                ))}
                            </Box>
                        ))}
                    </FormControl>
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button 
                    onClick={onClose}
                    variant="contained"
                    sx={{
                        backgroundColor: '#FF385C',
                        '&:hover': {
                            backgroundColor: '#E61E4D'
                        }
                    }}
                >
                    Done
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default Filters; 