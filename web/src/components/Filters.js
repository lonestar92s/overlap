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
    Divider,
    Tooltip
} from '@mui/material';
import { Close as CloseIcon, Lock as LockIcon } from '@mui/icons-material';
import { getAllLeagues, LEAGUES } from '../data/leagues';
import { useSubscription } from '../hooks/useSubscription';

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
    'NL': 'Netherlands',
    'PT': 'Portugal',
    'IT': 'Italy',
    'BR': 'Brazil',
    'US': 'United States',
    'INT': 'International'
};

const Filters = ({ 
    open, 
    onClose, 
    selectedDistance, 
    onDistanceChange,
    selectedLeagues,
    onLeaguesChange,
    selectedTeams,
    onTeamsChange,
    teamsByLeague
}) => {
    const { hasLeagueAccess, getUpgradeMessage } = useSubscription();

    const handleDistanceChange = (event) => {
        const value = event.target.value === 'all' ? null : Number(event.target.value);
        onDistanceChange(value);
    };

    const handleLeagueChange = (leagueId) => {
        // Check if user has access to this league
        if (!hasLeagueAccess(leagueId)) {
            // Don't allow selection of restricted leagues
            return;
        }

        const newSelectedLeagues = selectedLeagues.includes(leagueId)
            ? selectedLeagues.filter(id => id !== leagueId)
            : [...selectedLeagues, leagueId];
        onLeaguesChange(newSelectedLeagues);

        // When deselecting a league, also deselect all teams from that league
        if (selectedLeagues.includes(leagueId)) {
            const leagueTeams = teamsByLeague[leagueId] || [];
            const newSelectedTeams = selectedTeams.filter(team => !leagueTeams.includes(team));
            onTeamsChange(newSelectedTeams);
        }
    };

    const handleTeamChange = (teamName) => {
        const newSelectedTeams = selectedTeams.includes(teamName)
            ? selectedTeams.filter(name => name !== teamName)
            : [...selectedTeams, teamName];
        onTeamsChange(newSelectedTeams);
    };

    const handleLeagueTeamsChange = (leagueId) => {
        const leagueTeams = teamsByLeague[leagueId] || [];
        
        // Check if all teams from this league are already selected
        const allLeagueTeamsSelected = leagueTeams.every(team => 
            selectedTeams.includes(team)
        );

        if (allLeagueTeamsSelected) {
            // If all selected, remove all teams from this league
            const newSelectedTeams = selectedTeams.filter(team => 
                !leagueTeams.includes(team)
            );
            onTeamsChange(newSelectedTeams);
        } else {
            // If not all selected, add all teams from this league
            const newSelectedTeams = [
                ...selectedTeams.filter(team => !leagueTeams.includes(team)),
                ...leagueTeams
            ];
            onTeamsChange(newSelectedTeams);
        }
    };

    const handleCountryChange = (countryCode) => {
        const countryLeagues = LEAGUES[countryCode] || [];
        // Only include leagues that the user has access to
        const accessibleCountryLeagueIds = countryLeagues
            .filter(league => hasLeagueAccess(league.id))
            .map(league => league.id);
        
        // Check if all accessible leagues from this country are already selected
        const allAccessibleCountryLeaguesSelected = accessibleCountryLeagueIds.every(id => 
            selectedLeagues.includes(id)
        );

        if (allAccessibleCountryLeaguesSelected) {
            // If all selected, remove all accessible leagues from this country
            const newSelectedLeagues = selectedLeagues.filter(id => 
                !accessibleCountryLeagueIds.includes(id)
            );
            onLeaguesChange(newSelectedLeagues);
            
            // Also remove all teams from the deselected leagues
            const countryTeams = accessibleCountryLeagueIds.flatMap(leagueId => teamsByLeague[leagueId] || []);
            const newSelectedTeams = selectedTeams.filter(team => !countryTeams.includes(team));
            onTeamsChange(newSelectedTeams);
        } else {
            // If not all selected, add all accessible leagues from this country
            const newSelectedLeagues = [
                ...selectedLeagues.filter(id => !accessibleCountryLeagueIds.includes(id)),
                ...accessibleCountryLeagueIds
            ];
            onLeaguesChange(newSelectedLeagues);
        }
    };

    const handleSelectAllLeagues = (event) => {
        if (event.target.checked) {
            // Only select leagues that the user has access to
            const accessibleLeagues = getAllLeagues()
                .filter(league => hasLeagueAccess(league.id))
                .map(l => l.id);
            onLeaguesChange(accessibleLeagues);
        } else {
            onLeaguesChange([]);
            // When deselecting all leagues, also clear all team selections
            onTeamsChange([]);
        }
    };

    // Check if all accessible leagues are selected
    const accessibleLeagues = getAllLeagues().filter(league => hasLeagueAccess(league.id));
    const allLeaguesSelected = selectedLeagues.length === accessibleLeagues.length && 
        accessibleLeagues.every(league => selectedLeagues.includes(league.id));
    const someLeaguesSelected = selectedLeagues.length > 0 && !allLeaguesSelected;

    // Helper function to check country selection state
    const getCountrySelectionState = (countryCode) => {
        const countryLeagues = LEAGUES[countryCode] || [];
        // Only consider leagues that the user has access to
        const accessibleCountryLeagueIds = countryLeagues
            .filter(league => hasLeagueAccess(league.id))
            .map(league => league.id);
        
        const selectedAccessibleCountryLeagues = accessibleCountryLeagueIds.filter(id => 
            selectedLeagues.includes(id)
        );

        if (selectedAccessibleCountryLeagues.length === 0) return 'none';
        if (selectedAccessibleCountryLeagues.length === accessibleCountryLeagueIds.length) return 'all';
        return 'some';
    };

    // Helper function to check team selection state for a league
    const getLeagueTeamSelectionState = (leagueId) => {
        const leagueTeams = teamsByLeague[leagueId] || [];
        if (leagueTeams.length === 0) return 'none';
        
        const selectedLeagueTeams = leagueTeams.filter(team => 
            selectedTeams.includes(team)
        );

        if (selectedLeagueTeams.length === 0) return 'none';
        if (selectedLeagueTeams.length === leagueTeams.length) return 'all';
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
                    maxWidth: '500px',
                    maxHeight: '80vh'
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
                    
                    {/* Subscription note */}
                    <Box sx={{ mb: 2, p: 1.5, backgroundColor: '#f8f9fa', borderRadius: 1, border: '1px solid #e9ecef' }}>
                        <Typography variant="caption" sx={{ color: '#666', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LockIcon sx={{ fontSize: 12 }} />
                            Leagues with a lock icon require a Pro subscription
                        </Typography>
                    </Box>
                    
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
                                        {leagues.map((league) => {
                                            const leagueTeams = teamsByLeague[league.id] || [];
                                            const teamSelectionState = getLeagueTeamSelectionState(league.id);
                                            const hasAccess = hasLeagueAccess(league.id);
                                            const isRestricted = !hasAccess;
                                            
                                            return (
                                                <Box key={league.id} sx={{ mb: 1 }}>
                                                    {/* League checkbox */}
                                                    {isRestricted ? (
                                                        <Tooltip 
                                                            title={getUpgradeMessage(league.id)}
                                                            arrow
                                                            placement="top"
                                                        >
                                                            <Box>
                                                                <FormControlLabel
                                                                    control={
                                                                        <Checkbox
                                                                            checked={false}
                                                                            disabled={true}
                                                                            size="small"
                                                                        />
                                                                    }
                                                                    label={
                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                            <Typography
                                                                                sx={{
                                                                                    fontSize: '0.9rem',
                                                                                    color: '#bbb',
                                                                                    textDecoration: 'none'
                                                                                }}
                                                                            >
                                                                                {league.name}
                                                                            </Typography>
                                                                            <LockIcon sx={{ fontSize: 16, color: '#bbb' }} />
                                                                        </Box>
                                                                    }
                                                                    sx={{ 
                                                                        mb: 0.5,
                                                                        opacity: 0.5,
                                                                        cursor: 'not-allowed',
                                                                        '& .MuiTypography-root': {
                                                                            fontSize: '0.9rem',
                                                                            color: '#bbb'
                                                                        }
                                                                    }}
                                                                />
                                                            </Box>
                                                        </Tooltip>
                                                    ) : (
                                                        <FormControlLabel
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
                                                    )}
                                                    
                                                    {/* Team checkboxes - only show if league is selected and has teams */}
                                                    {selectedLeagues.includes(league.id) && leagueTeams.length > 0 && hasAccess && (
                                                        <Box sx={{ ml: 4, mt: 1 }}>
                                                            {/* Select all teams for this league */}
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        checked={teamSelectionState === 'all'}
                                                                        indeterminate={teamSelectionState === 'some'}
                                                                        onChange={() => handleLeagueTeamsChange(league.id)}
                                                                        size="small"
                                                                    />
                                                                }
                                                                label={
                                                                    <Typography 
                                                                        variant="caption" 
                                                                        sx={{ 
                                                                            color: '#888',
                                                                            fontWeight: 500
                                                                        }}
                                                                    >
                                                                        All Teams
                                                                    </Typography>
                                                                }
                                                                sx={{ mb: 0.5 }}
                                                            />
                                                            
                                                            {/* Individual team checkboxes */}
                                                            <Box sx={{ ml: 2 }}>
                                                                {leagueTeams.map((team) => (
                                                                    <FormControlLabel
                                                                        key={team}
                                                                        control={
                                                                            <Checkbox
                                                                                checked={selectedTeams.includes(team)}
                                                                                onChange={() => handleTeamChange(team)}
                                                                                size="small"
                                                                            />
                                                                        }
                                                                        label={
                                                                            <Typography 
                                                                                variant="caption" 
                                                                                sx={{ 
                                                                                    fontSize: '0.8rem',
                                                                                    color: '#999'
                                                                                }}
                                                                            >
                                                                                {team}
                                                                            </Typography>
                                                                        }
                                                                        sx={{ 
                                                                            mb: 0.25,
                                                                            display: 'block'
                                                                        }}
                                                                    />
                                                                ))}
                                                            </Box>
                                                        </Box>
                                                    )}
                                                </Box>
                                            );
                                        })}
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