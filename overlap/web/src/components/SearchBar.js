import React, { useState, useRef } from 'react';
import {
    Box,
    Paper,
    Button,
    Typography,
    CircularProgress,
    Dialog,
    DialogContent,
    IconButton,
    Chip,
    Divider
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { 
    SearchRounded, 
    EditRounded, 
    CloseRounded,
    LocationOn,
    DateRange,
    Search
} from '@mui/icons-material';
import LocationAutocomplete from './LocationAutocomplete';
import { format } from 'date-fns';

// Helper function to safely format dates
const safeFormatDate = (date, formatString) => {
    if (!date || !(date instanceof Date) || isNaN(date)) {
        return '';
    }
    try {
        return format(date, formatString);
    } catch (error) {
        console.warn('Error formatting date:', error);
        return '';
    }
};

const SearchBar = ({ 
    searchState, 
    onLocationChange, 
    onFromDateChange,
    onToDateChange, 
    onSearch,
    compact = false,
    className = ""
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const today = new Date();

    const handleExpandedSearch = () => {
        onSearch();
        setIsExpanded(false);
    };

    // Compact mode - shows after search results
    if (compact) {
        return (
            <>
                <Paper 
                    elevation={2}
                    onClick={() => setIsExpanded(true)}
                    sx={{ 
                        p: { xs: 1.5, sm: 2 },
                        borderRadius: 3,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        border: '1px solid #e0e0e0',
                        background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
                        '&:hover': {
                            transform: { xs: 'none', sm: 'translateY(-2px)' },
                            boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                            borderColor: '#FF385C'
                        },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minHeight: { xs: '56px', sm: '64px' }
                    }}
                >
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: { xs: 1, sm: 2 }, 
                        flex: 1,
                        overflow: 'hidden'
                    }}>
                        <LocationOn sx={{ color: '#FF385C', fontSize: { xs: 20, sm: 24 } }} />
                        <Typography 
                            variant="body2" 
                            sx={{ 
                                fontWeight: 600,
                                color: '#333',
                                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {searchState.location ? searchState.location.name : 'Search location...'}
                        </Typography>
                        {searchState.dates.from && searchState.dates.from instanceof Date && !isNaN(searchState.dates.from) && (
                            <>
                                <Divider orientation="vertical" flexItem sx={{ mx: { xs: 0.5, sm: 1 } }} />
                                <DateRange sx={{ color: '#666', fontSize: { xs: 18, sm: 20 } }} />
                                <Typography 
                                    variant="body2" 
                                    sx={{ 
                                        color: '#666',
                                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {safeFormatDate(searchState.dates.from, 'MMM d')}
                                    {searchState.dates.to && searchState.dates.to instanceof Date && !isNaN(searchState.dates.to) && ` - ${safeFormatDate(searchState.dates.to, 'MMM d')}`}
                                </Typography>
                            </>
                        )}
                    </Box>
                    <IconButton size="small" sx={{ color: '#666', ml: 1 }}>
                        <Search fontSize="small" />
                    </IconButton>
                </Paper>

                {/* Expanded Search Dialog */}
                <Dialog 
                    open={isExpanded} 
                    onClose={() => setIsExpanded(false)}
                    maxWidth="md"
                    fullWidth
                    PaperProps={{
                        sx: {
                            borderRadius: 3,
                            maxWidth: '600px'
                        }
                    }}
                >
                    <DialogContent sx={{ p: 0 }}>
                        <Box sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Edit Your Search
                                </Typography>
                                <IconButton onClick={() => setIsExpanded(false)}>
                                    <CloseRounded />
                                </IconButton>
                            </Box>

                            <SearchBarContent 
                                searchState={searchState}
                                onLocationChange={onLocationChange}
                                onFromDateChange={onFromDateChange}
                                onToDateChange={onToDateChange}
                                onSearch={handleExpandedSearch}
                                today={today}
                            />
                        </Box>
                    </DialogContent>
                </Dialog>
            </>
        );
    }

    // Full mode - initial search
    return (
        <Box className={className}>
            <SearchBarContent 
                searchState={searchState}
                onLocationChange={onLocationChange}
                onFromDateChange={onFromDateChange}
                onToDateChange={onToDateChange}
                onSearch={onSearch}
                today={today}
                fullMode={true}
            />
        </Box>
    );
};

// Extracted search form content for reuse
const SearchBarContent = ({ 
    searchState, 
    onLocationChange, 
    onFromDateChange, 
    onToDateChange, 
    onSearch,
    today,
    fullMode = false
}) => {
    const [toDatePickerOpen, setToDatePickerOpen] = useState(false);

    const handleFromDateChange = (date) => {
        const wasAccepted = onFromDateChange(date);
        
        // Only auto-open to date picker if from date was successfully accepted
        if (date && !searchState.dates.to && wasAccepted) {
            setTimeout(() => {
                setToDatePickerOpen(true);
            }, 100);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Paper 
                elevation={fullMode ? 3 : 0}
                sx={{ 
                    p: fullMode ? 3 : 2,
                    borderRadius: fullMode ? 4 : 2,
                    border: fullMode ? 'none' : '1px solid #e0e0e0'
                }}
            >
                <Box sx={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0,
                    height: fullMode ? 'auto' : '48px'
                }}>
                    {/* Location */}
                    <Box 
                        sx={{ 
                            flex: 1,
                            borderRight: '1px solid #DDDDDD',
                            px: 2,
                            py: fullMode ? 1 : 0
                        }}
                    >
                        <Typography 
                            variant="subtitle2" 
                            sx={{ 
                                fontWeight: 600,
                                color: '#222222',
                                mb: fullMode ? 0.5 : 0,
                                fontSize: fullMode ? '14px' : '12px'
                            }}
                        >
                            Where
                        </Typography>
                        <LocationAutocomplete
                            value={searchState.location}
                            onChange={onLocationChange}
                            placeholder="Search destinations"
                        />
                    </Box>

                    {/* From Date */}
                    <Box 
                        sx={{ 
                            flex: 1,
                            borderRight: '1px solid #DDDDDD',
                            px: 2,
                            py: fullMode ? 1 : 0
                        }}
                    >
                        <Typography 
                            variant="subtitle2" 
                            sx={{ 
                                fontWeight: 600,
                                color: '#222222',
                                mb: fullMode ? 0.5 : 0,
                                fontSize: fullMode ? '14px' : '12px'
                            }}
                        >
                            From
                        </Typography>
                        <DatePicker
                            value={searchState.dates.from}
                            onChange={handleFromDateChange}
                            minDate={today}
                            slotProps={{
                                textField: {
                                    variant: "standard",
                                    placeholder: "Add dates",
                                    size: fullMode ? "medium" : "small",
                                    InputProps: {
                                        disableUnderline: true
                                    }
                                }
                            }}
                        />
                    </Box>

                    {/* To Date */}
                    <Box 
                        sx={{ 
                            flex: 1,
                            px: 2,
                            py: fullMode ? 1 : 0
                        }}
                    >
                        <Typography 
                            variant="subtitle2" 
                            sx={{ 
                                fontWeight: 600,
                                color: '#222222',
                                mb: fullMode ? 0.5 : 0,
                                fontSize: fullMode ? '14px' : '12px'
                            }}
                        >
                            To
                        </Typography>
                        <DatePicker
                            value={searchState.dates.to}
                            onChange={(date) => {
                                onToDateChange(date);
                                setToDatePickerOpen(false);
                            }}
                            minDate={searchState.dates.from || today}
                            disabled={!searchState.dates.from}
                            open={toDatePickerOpen}
                            onClose={() => setToDatePickerOpen(false)}
                            slotProps={{
                                textField: {
                                    variant: "standard",
                                    placeholder: "Add dates",
                                    size: fullMode ? "medium" : "small",
                                    InputProps: {
                                        disableUnderline: true
                                    }
                                }
                            }}
                        />
                    </Box>

                    {/* Search Button */}
                    <Button
                        variant="contained"
                        onClick={onSearch}
                        disabled={!searchState.dates.from || !searchState.dates.to || searchState.loading}
                        sx={{
                            ml: 1,
                            height: fullMode ? 56 : 48,
                            width: fullMode ? 56 : 48,
                            minWidth: fullMode ? 56 : 48,
                            borderRadius: '50%',
                            backgroundColor: '#FF385C',
                            '&:hover': {
                                backgroundColor: '#E61E4D'
                            },
                            '&:disabled': {
                                backgroundColor: '#ccc'
                            }
                        }}
                    >
                        {searchState.loading ? (
                            <CircularProgress size={24} color="inherit" />
                        ) : (
                            <SearchRounded sx={{ fontSize: fullMode ? 28 : 24 }} />
                        )}
                    </Button>
                </Box>
            </Paper>
        </LocalizationProvider>
    );
};

export default SearchBar; 