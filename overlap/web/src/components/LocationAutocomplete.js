import React, { useState, useEffect, useMemo } from 'react';
import { 
    TextField, 
    Autocomplete, 
    Box,
    Typography,
    CircularProgress
} from '@mui/material';
import { LocationOn } from '@mui/icons-material';
import axios from 'axios';
import { debounce } from 'lodash';

const LOCATIONIQ_API_KEY = process.env.REACT_APP_LOCATIONIQ_API_KEY;

const LocationAutocomplete = ({ value, onChange }) => {
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastRequestTime, setLastRequestTime] = useState(0);

    const fetchSuggestions = async (query) => {
        if (!query || query.length < 2 || !LOCATIONIQ_API_KEY) {
            setOptions([]);
            return;
        }

        // Ensure at least 1 second between requests
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
        }

        setLoading(true);
        setError(null);
        
        try {
            setLastRequestTime(Date.now());
            const response = await axios.get(
                `https://api.locationiq.com/v1/autocomplete`,
                {
                    params: {
                        key: LOCATIONIQ_API_KEY,
                        q: query,
                        limit: 5,
                        dedupe: 1,
                        'accept-language': 'en',
                        tag: 'place:city,place:town'
                    }
                }
            );
            
            const suggestions = response.data.map(item => {
                const nameParts = item.display_name.split(', ');
                const city = nameParts[0];
                const country = nameParts[nameParts.length - 1];
                const region = nameParts.slice(1, -1).join(', ');
                
                return {
                    place_id: `${item.place_id}-${item.lat}-${item.lon}`,
                    description: `${city}, ${country}`,
                    structured_formatting: {
                        main_text: city,
                        secondary_text: region ? `${region}, ${country}` : country
                    },
                    lat: item.lat,
                    lon: item.lon,
                    city,
                    region,
                    country
                };
            });
            
            const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
                index === self.findIndex((s) => (
                    s.lat === suggestion.lat && s.lon === suggestion.lon
                ))
            );
            
            setOptions(uniqueSuggestions);
        } catch (error) {
            console.error('Error fetching location suggestions:', error);
            if (error.response?.status === 429) {
                setError('Please type more slowly...');
            } else {
                setError('Error fetching locations');
            }
            setOptions([]);
        } finally {
            setLoading(false);
        }
    };

    const debouncedFetchSuggestions = useMemo(
        () => debounce(fetchSuggestions, 500),
        [] // Empty dependency array since fetchSuggestions is defined inside the component
    );

    useEffect(() => {
        return () => {
            debouncedFetchSuggestions.cancel();
        };
    }, [debouncedFetchSuggestions]);

    if (!LOCATIONIQ_API_KEY) {
        return (
            <TextField
                fullWidth
                error
                helperText="LocationIQ API key is not configured"
                placeholder="Where are you going?"
                InputProps={{
                    startAdornment: (
                        <LocationOn sx={{ color: '#666', ml: 1, mr: -0.5 }} />
                    )
                }}
            />
        );
    }

    return (
        <Autocomplete
            id="location-autocomplete"
            fullWidth
            options={options}
            autoComplete
            includeInputInList
            filterSelectedOptions
            value={value}
            onChange={(event, newValue) => {
                onChange(newValue);
                setError(null);
            }}
            onInputChange={(event, newInputValue) => {
                setInputValue(newInputValue);
                debouncedFetchSuggestions(newInputValue);
            }}
            getOptionLabel={(option) => 
                typeof option === 'string' ? option : option.description
            }
            isOptionEqualToValue={(option, value) =>
                option?.place_id === value?.place_id
            }
            renderInput={(params) => (
                <TextField
                    {...params}
                    placeholder="Where are you going?"
                    error={!!error}
                    helperText={error}
                    InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                            <LocationOn sx={{ color: '#666', ml: 1, mr: -0.5 }} />
                        ),
                        endAdornment: (
                            <>
                                {loading && <CircularProgress color="inherit" size={20} />}
                                {params.InputProps.endAdornment}
                            </>
                        )
                    }}
                />
            )}
            renderOption={(props, option) => (
                <li {...props}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', flexDirection: 'column', py: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {option.structured_formatting.main_text}
                        </Typography>
                        <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ fontSize: '0.875rem' }}
                        >
                            {option.structured_formatting.secondary_text}
                        </Typography>
                    </Box>
                </li>
            )}
            loading={loading}
        />
    );
};

export default LocationAutocomplete; 