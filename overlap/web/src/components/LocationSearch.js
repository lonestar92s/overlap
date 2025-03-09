import React, { useState, useEffect } from 'react';
import { 
    TextField, 
    Autocomplete, 
    CircularProgress, 
    Box, 
    Typography 
} from '@mui/material';
import { LocationOn } from '@mui/icons-material';

const BACKEND_URL = 'http://localhost:3001';

const LocationSearch = ({ onSelect, initialLocation = null }) => {
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Set initial input value if initialLocation is provided
    useEffect(() => {
        if (initialLocation) {
            setInputValue(initialLocation.city + (initialLocation.region ? `, ${initialLocation.region}` : '') + `, ${initialLocation.country}`);
        }
    }, [initialLocation]);
    
    // Fetch location suggestions when input changes
    useEffect(() => {
        let active = true;
        
        if (inputValue.length < 3) {
            setOptions([]);
            return undefined;
        }
        
        const fetchLocations = async () => {
            setLoading(true);
            setError(null);
            
            try {
                const response = await fetch(`${BACKEND_URL}/locations?query=${encodeURIComponent(inputValue)}`);
                
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (active) {
                    setOptions(data);
                }
            } catch (err) {
                console.error('Error fetching locations:', err);
                setError('Failed to fetch locations. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        
        fetchLocations();
        
        return () => {
            active = false;
        };
    }, [inputValue]);
    
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