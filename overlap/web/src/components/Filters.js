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

const COUNTRY_NAMES = {
    'GB': 'England',
    'FR': 'France',
    'ES': 'Spain',
    'DE': 'Germany',
    'NL': 'Netherlands'
};

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

    const handleCountryChange = (countryCode) => {
        const countryLeagues = LEAGUES[countryCode] || [];
        const countryLeagueIds = countryLeagues.map(league => league.id);
        
        // Check if all leagues from this country are already selected
        const allCountryLeaguesSelected = countryLeagueIds.every(id => 
            selectedLeagues.includes(id)
        );

        if (allCountryLeaguesSelected) {
            // If all selected, remove all leagues from this country
            const newSelectedLeagues = selectedLeagues.filter(id => 
                !countryLeagueIds.includes(id)
            );
            onLeaguesChange(newSelectedLeagues);
        } else {
            // If not all selected, add all leagues from this country
            const newSelectedLeagues = [
                ...selectedLeagues.filter(id => !countryLeagueIds.includes(id)),
                ...countryLeagueIds
            ];
            onLeaguesChange(newSelectedLeagues);
        }
    };

    const handleSelectAllLeagues = (event) => {
        if (event.target.checked) {
            onLeaguesChange(getAllLeagues().map(l => l.id));
        } else {
            onLeaguesChange([]);
        }
    };

    // Check if all leagues are selected
    const allLeaguesSelected = selectedLeagues.length === getAllLeagues().length;
    const someLeaguesSelected = selectedLeagues.length > 0 && !allLeaguesSelected;

    // Helper function to check country selection state
    const getCountrySelectionState = (countryCode) => {
        const countryLeagues = LEAGUES[countryCode] || [];
        const countryLeagueIds = countryLeagues.map(league => league.id);
        
        const selectedCountryLeagues = countryLeagueIds.filter(id => 
            selectedLeagues.includes(id)
        );

        if (selectedCountryLeagues.length === 0) return 'none';
        if (selectedCountryLeagues.length === countryLeagueIds.length) return 'all';
        return 'some';
    };

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
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={allLeaguesSelected}
                                    indeterminate={someLeaguesSelected}
                                    onChange={handleSelectAllLeagues}
                                />
                            }
                            label="Show all leagues"
                            sx={{ mb: 2 }}
                        />
                        {Object.entries(LEAGUES).map(([countryCode, leagues]) => {
                            const countrySelectionState = getCountrySelectionState(countryCode);
                            
                            return (
                                <Box key={countryCode} sx={{ mb: 2 }}>
                                    {/* Country-level checkbox */}
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={countrySelectionState === 'all'}
                                                indeterminate={countrySelectionState === 'some'}
                                                onChange={() => handleCountryChange(countryCode)}
                                            />
                                        }
                                        label={
                                            <Typography 
                                                variant="subtitle2" 
                                                sx={{ 
                                                    color: '#222',
                                                    fontWeight: 500
                                                }}
                                            >
                                                {COUNTRY_NAMES[countryCode]}
                                            </Typography>
                                        }
                                    />
                                    {/* League-level checkboxes */}
                                    <Box sx={{ ml: 3 }}>
                                        {leagues.map((league) => (
                                            <FormControlLabel
                                                key={league.id}
                                                control={
                                                    <Checkbox
                                                        checked={selectedLeagues.includes(league.id)}
                                                        onChange={() => handleLeagueChange(league.id)}
                                                        size="small"
                                                    />
                                                }
                                                label={league.name}
                                                sx={{ 
                                                    mb: 0.5,
                                                    '& .MuiTypography-root': {
                                                        fontSize: '0.9rem',
                                                        color: '#666'
                                                    }
                                                }}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            );
                        })}
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