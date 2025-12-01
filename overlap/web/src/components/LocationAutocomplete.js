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

const LocationAutocomplete = ({ value, onChange, placeholder = "Search destinations" }) => {
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastRequestTime, setLastRequestTime] = useState(0);

    // Helper function to format location display
    const formatLocationDisplay = (option) => {
        if (!option) return '';
        // Use description field if available (handles disambiguation)
        if (option.description) {
            return option.description;
        }
        return `${option.city}, ${option.country}`;
    };

    // Helper function to format full location details
    const formatLocationDetails = (option) => {
        if (!option) return '';
        // Use description field if available (handles disambiguation)
        if (option.description) {
            return option.description;
        }
        return `${option.city}, ${option.country}`;
    };

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
            
            // Helper function to filter postal codes from region
            const filterPostalCodes = (region) => {
                if (!region) return '';
                // Split by comma and filter out parts that are purely numeric (postal codes)
                // Also filter out patterns like "SW1A 1AA" (UK postcodes)
                const parts = region.split(', ').filter(part => {
                    // Remove purely numeric parts (e.g., "75000", "90210")
                    if (/^\d+$/.test(part.trim())) return false;
                    // Remove UK-style postcodes (e.g., "SW1A 1AA", "M1 1AA")
                    if (/^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i.test(part.trim())) return false;
                    // Remove US ZIP+4 format (e.g., "90210-1234")
                    if (/^\d{5}-\d{4}$/.test(part.trim())) return false;
                    return true;
                });
                return parts.join(', ');
            };

            const suggestions = response.data.map(item => {
                const nameParts = item.display_name.split(', ');
                const city = nameParts[0];
                const country = nameParts[nameParts.length - 1];
                const region = nameParts.slice(1, -1).join(', ');
                const displayRegion = filterPostalCodes(region);
                
                // Create a more unique identifier that includes all location components
                const uniqueId = `${item.place_id}-${item.lat}-${item.lon}-${city}-${region}-${country}`;
                
                return {
                    place_id: uniqueId,
                    lat: item.lat,
                    lon: item.lon,
                    city,
                    region, // Keep full region with postal codes
                    displayRegion, // Cleaned region without postal codes
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

            // Check for duplicate city names to determine if disambiguation is needed
            const cityNameCounts = {};
            uniqueSuggestions.forEach(suggestion => {
                const cityKey = suggestion.city.toLowerCase();
                if (!cityNameCounts[cityKey]) {
                    cityNameCounts[cityKey] = [];
                }
                cityNameCounts[cityKey].push(suggestion);
            });

            // Generate descriptions with disambiguation logic
            uniqueSuggestions.forEach(suggestion => {
                const cityKey = suggestion.city.toLowerCase();
                const citiesWithSameName = cityNameCounts[cityKey];
                
                // If multiple cities share the same name, include region for disambiguation
                if (citiesWithSameName.length > 1) {
                    // Include displayRegion (without postal codes) for disambiguation
                    suggestion.description = suggestion.displayRegion 
                        ? `${suggestion.city}, ${suggestion.displayRegion}, ${suggestion.country}`
                        : `${suggestion.city}, ${suggestion.country}`;
                } else {
                    // Unique city name, show simple format
                    suggestion.description = `${suggestion.city}, ${suggestion.country}`;
                }

                // Update structured_formatting for display
                suggestion.structured_formatting = {
                    main_text: suggestion.city,
                    secondary_text: suggestion.displayRegion 
                        ? `${suggestion.displayRegion}, ${suggestion.country}` 
                        : suggestion.country
                };
            });
            
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
            getOptionLabel={(option) => formatLocationDisplay(option)}
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
                            padding: '0px !important',
                            '&:before': {
                                display: 'none'
                            },
                            '&:after': {
                                display: 'none'
                            },
                            '&:hover:not(.Mui-disabled):before': {
                                display: 'none'
                            }
                        },
                        '& .MuiInputBase-input': {
                            padding: '0 !important',
                            color: '#222222',
                            outline: 'none !important',
                            '&:focus': {
                                outline: 'none !important'
                            },
                            '&::placeholder': {
                                color: '#717171',
                                opacity: 1
                            }
                        },
                        '& .MuiInput-underline': {
                            '&:before': {
                                display: 'none'
                            },
                            '&:after': {
                                display: 'none'
                            },
                            '&:hover:not(.Mui-disabled):before': {
                                display: 'none'
                            }
                        }
                    }}
                />
            )}
            renderOption={(props, option) => {
                const { key, ...otherProps } = props;
                return (
                    <Box 
                        component="li" 
                        key={option.place_id}
                        {...otherProps}
                        sx={{ 
                            py: 0.5,
                            px: 1.5,
                            minHeight: 'auto',
                            '&:hover': {
                                backgroundColor: '#F7F7F7'
                            }
                        }}
                    >
                        <LocationOn sx={{ color: '#717171', mr: 1, fontSize: 18 }} />
                        <Box>
                            <Typography variant="body2" color="#222222" sx={{ fontSize: '0.875rem', lineHeight: 1.2 }}>
                                {option.city}
                                {option.region && `, ${option.region}`}
                            </Typography>
                            <Typography variant="caption" color="#717171" sx={{ fontSize: '0.75rem', lineHeight: 1.1 }}>
                                {option.country}
                            </Typography>
                        </Box>
                    </Box>
                );
            }}
            PaperComponent={({ children, ...props }) => (
                <Paper 
                    {...props} 
                    elevation={2}
                    sx={{ 
                        mt: 0.5,
                        borderRadius: 2,
                        border: '1px solid #DDDDDD',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                        maxHeight: '200px',
                        overflow: 'auto'
                    }}
                >
                    {children}
                </Paper>
            )}
        />
    );
};

export default LocationAutocomplete; 