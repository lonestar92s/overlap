import React, { useState, useEffect, useMemo } from 'react';
import { 
    TextField, 
    Autocomplete, 
    Box,
    Typography,
    CircularProgress,
    Paper
} from '@mui/material';
import { LocationOn } from '@mui/icons-material';
import axios from 'axios';
import { debounce } from 'lodash';

const LOCATIONIQ_API_KEY = process.env.REACT_APP_LOCATIONIQ_API_KEY;

const LocationAutocomplete = ({ value, onChange, placeholder = "Where are you going?" }) => {
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

    const handleInputChange = (event, newInputValue) => {
        setInputValue(newInputValue);
        debouncedFetchSuggestions(newInputValue);
    };

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
            value={value}
            onChange={(event, newValue) => {
                onChange(newValue);
            }}
            onInputChange={handleInputChange}
            options={options}
            getOptionLabel={(option) => 
                option ? `${option.city}${option.region ? `, ${option.region}` : ''}, ${option.country}` : ''
            }
            loading={loading}
            filterOptions={(x) => x}
            freeSolo
            renderInput={(params) => (
                <TextField
                    {...params}
                    placeholder={placeholder}
                    variant="standard"
                    InputProps={{
                        ...params.InputProps,
                        disableUnderline: true,
                        endAdornment: (
                            <>
                                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                {params.InputProps.endAdornment}
                            </>
                        ),
                    }}
                    sx={{
                        '& .MuiInputBase-root': {
                            padding: '0 !important'
                        },
                        '& .MuiInputBase-input': {
                            padding: '0 !important',
                            color: '#222222',
                            '&::placeholder': {
                                color: '#717171',
                                opacity: 1
                            }
                        }
                    }}
                />
            )}
            renderOption={(props, option) => {
                // Extract key from props
                const { key, ...otherProps } = props;
                return (
                    <Box 
                        component="li" 
                        key={option.place_id} // Use place_id as key
                        {...otherProps}
                        sx={{ 
                            py: 1,
                            px: 2,
                            '&:hover': {
                                backgroundColor: '#F7F7F7'
                            }
                        }}
                    >
                        <LocationOn sx={{ color: '#717171', mr: 2 }} />
                        <Box>
                            <Typography variant="body1" color="#222222">
                                {option.city}
                                {option.region && `, ${option.region}`}
                            </Typography>
                            <Typography variant="body2" color="#717171">
                                {option.country}
                            </Typography>
                        </Box>
                    </Box>
                );
            }}
            PaperComponent={({ children, ...props }) => (
                <Paper 
                    {...props} 
                    elevation={3}
                    sx={{ 
                        mt: 1,
                        borderRadius: 4,
                        border: '1px solid #DDDDDD',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.18)'
                    }}
                >
                    {children}
                </Paper>
            )}
        />
    );
};

export default LocationAutocomplete; 