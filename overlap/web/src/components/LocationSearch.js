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

const LocationSearch = ({ onSelect, initialLocation = null }) => {
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastRequestTime, setLastRequestTime] = useState(0);
    
    // Set initial input value if initialLocation is provided
    useEffect(() => {
        if (initialLocation) {
            setInputValue(initialLocation.city + (initialLocation.region ? `, ${initialLocation.region}` : '') + `, ${initialLocation.country}`);
        }
    }, [initialLocation]);
    
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
                        'accept-language': 'en'
                    }
                }
            );
            
            const suggestions = response.data.map(item => {
                const nameParts = item.display_name.split(', ');
                const city = nameParts[0];
                const country = nameParts[nameParts.length - 1];
                const region = nameParts.slice(1, -1).join(', ');
                
                // Create a more unique identifier that includes all location components
                const uniqueId = `${item.place_id}-${item.lat}-${item.lon}-${city}-${region}-${country}`;
                
                return {
                    place_id: uniqueId,
                    description: `${city}${region ? `, ${region}` : ''}, ${country}`,
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
            
            // Filter out duplicates based on exact coordinates and full location details
            const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
                index === self.findIndex((s) => (
                    s.lat === suggestion.lat && 
                    s.lon === suggestion.lon &&
                    s.city === suggestion.city &&
                    s.region === suggestion.region &&
                    s.country === suggestion.country
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
            id="location-search"
            freeSolo
            filterOptions={(x) => x}
            options={options}
            loading={loading}
            inputValue={inputValue}
            onInputChange={(event, newInputValue) => {
                setInputValue(newInputValue);
                debouncedFetchSuggestions(newInputValue);
            }}
            onChange={(event, newValue) => {
                if (newValue && typeof newValue === 'object') {
                    onSelect(newValue);
                }
            }}
            getOptionLabel={(option) => {
                if (typeof option === 'string') {
                    return option;
                }
                return `${option.city}${option.region ? `, ${option.region}` : ''}, ${option.country}`;
            }}
            renderOption={(props, option) => (
                <Box component="li" {...props}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LocationOn sx={{ color: 'text.secondary', mr: 1 }} />
                        <Box>
                            <Typography variant="body1">
                                {option.city}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {option.region ? `${option.region}, ` : ''}{option.country}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            )}
            renderInput={(params) => (
                <TextField
                    {...params}
                    placeholder="Enter a city or airport"
                    fullWidth
                    variant="outlined"
                    size="small"
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <React.Fragment>
                                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                {params.InputProps.endAdornment}
                            </React.Fragment>
                        ),
                    }}
                    error={!!error}
                    helperText={error}
                />
            )}
        />
    );
};

export default LocationSearch; 