import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Autocomplete,
    TextField,
    Box,
    Typography,
    Avatar,
    Chip,
    CircularProgress,
    Paper,
    Divider
} from '@mui/material';
import { SportsSoccer, Stadium, EmojiEvents } from '@mui/icons-material';
import { debounce } from 'lodash';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

// Custom renderOption to show badges and type indicators
const renderSearchOption = (props, option) => {
    const getTypeIcon = (type) => {
        switch (type) {
            case 'league':
                return <EmojiEvents sx={{ fontSize: 20, color: '#FF385C' }} />;
            case 'team':
                return <SportsSoccer sx={{ fontSize: 20, color: '#FF385C' }} />;
            case 'venue':
                return <Stadium sx={{ fontSize: 20, color: '#FF385C' }} />;
            default:
                return null;
        }
    };

    const getTypeLabel = (type) => {
        switch (type) {
            case 'league':
                return 'League';
            case 'team':
                return 'Team';
            case 'venue':
                return 'Venue';
            default:
                return '';
        }
    };

    return (
        <Box component="li" {...props} sx={{ py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {/* Badge/Logo */}
                {option.badge ? (
                    <Avatar
                        src={option.badge}
                        alt={option.name}
                        variant="rounded"
                        sx={{
                            width: 40,
                            height: 40,
                            bgcolor: '#f0f0f0'
                        }}
                    >
                        {!option.badge && getTypeIcon(option.type)}
                    </Avatar>
                ) : (
                    <Avatar
                        variant="rounded"
                        sx={{
                            width: 40,
                            height: 40,
                            bgcolor: '#f0f0f0'
                        }}
                    >
                        {getTypeIcon(option.type)}
                    </Avatar>
                )}

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500, flex: 1 }}>
                            {option.name}
                        </Typography>
                        <Chip
                            label={getTypeLabel(option.type)}
                            size="small"
                            sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                bgcolor: option.type === 'league' ? '#e3f2fd' :
                                         option.type === 'team' ? '#f3e5f5' :
                                         '#fff3e0',
                                color: option.type === 'league' ? '#1976d2' :
                                       option.type === 'team' ? '#7b1fa2' :
                                       '#e65100'
                            }}
                        />
                    </Box>
                    <Typography variant="body2" color="text.secondary" noWrap>
                        {option.type === 'venue' ? (
                            `${option.city ? option.city + ', ' : ''}${option.country}`
                        ) : option.type === 'team' ? (
                            `${option.city ? option.city + ', ' : ''}${option.country}`
                        ) : (
                            option.country
                        )}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

const UnifiedSearch = ({ onSelect, placeholder = "Search leagues, teams, or venues...", style = {} }) => {
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastRequestTime, setLastRequestTime] = useState(0);

    // Debounced search function
    const fetchSearchResults = useCallback(
        debounce(async (query) => {
            if (!query || query.length < 2) {
                setOptions([]);
                return;
            }

            // Rate limiting: ensure at least 300ms between requests
            const now = Date.now();
            const timeSinceLastRequest = now - lastRequestTime;
            if (timeSinceLastRequest < 300) {
                await new Promise(resolve => setTimeout(resolve, 300 - timeSinceLastRequest));
            }
            setLastRequestTime(Date.now());

            setLoading(true);
            setError(null);

            try {
                const response = await axios.get(`${API_BASE_URL}/api/search/unified`, {
                    params: { query }
                });

                if (response.data.success) {
                    // Combine all results into a flat array
                    const allResults = [
                        ...response.data.results.leagues,
                        ...response.data.results.teams,
                        ...response.data.results.venues
                    ];
                    setOptions(allResults);
                } else {
                    setOptions([]);
                    setError(response.data.message || 'Search failed');
                }
            } catch (err) {
                console.error('Search error:', err);
                setError('Failed to search');
                setOptions([]);
            } finally {
                setLoading(false);
            }
        }, 400),
        [lastRequestTime]
    );

    useEffect(() => {
        if (inputValue) {
            fetchSearchResults(inputValue);
        } else {
            setOptions([]);
        }

        // Cleanup
        return () => {
            fetchSearchResults.cancel();
        };
    }, [inputValue, fetchSearchResults]);

    const handleInputChange = (event, newInputValue) => {
        setInputValue(newInputValue);
    };

    const handleChange = (event, newValue) => {
        if (newValue && typeof newValue === 'object') {
            if (onSelect) {
                onSelect(newValue);
            }
        }
    };

    const getOptionLabel = (option) => {
        if (typeof option === 'string') {
            return option;
        }
        return option.name || '';
    };

    // Use flat list of options (already combined from backend)
    const flatOptions = options;

    return (
        <Autocomplete
            freeSolo
            options={flatOptions}
            loading={loading}
            inputValue={inputValue}
            onInputChange={handleInputChange}
            onChange={handleChange}
            getOptionLabel={getOptionLabel}
            renderOption={renderSearchOption}
            filterOptions={(x) => x} // Don't filter - backend already filtered
            renderInput={(params) => (
                <TextField
                    {...params}
                    placeholder={placeholder}
                    variant="outlined"
                    error={!!error}
                    helperText={error}
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <>
                                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                {params.InputProps.endAdornment}
                            </>
                        ),
                    }}
                />
            )}
            PaperComponent={(props) => (
                <Paper {...props} elevation={3} />
            )}
            sx={style}
            noOptionsText={inputValue.length < 2 ? 'Type at least 2 characters to search' : 'No results found'}
        />
    );
};

export default UnifiedSearch;

