import React, { useState } from 'react';
import {
    Box,
    TextField,
    IconButton,
    Paper,
    Typography,
    CircularProgress,
    Collapse,
    Fab,
    Zoom,
    Dialog,
    DialogContent,
    DialogTitle,
    Slide,
    Alert,
    Chip,
    List,
    ListItem,
    ListItemText,
    Divider
} from '@mui/material';
import { Search, Clear, Chat, Close, CheckCircle, Warning } from '@mui/icons-material';
import { processNaturalLanguageQuery, extractSearchParams, formatSearchResults, getSearchExamples } from '../services/naturalLanguageService';
import { formatMatchDateTime } from '../utils/timezone';

const Transition = React.forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const NaturalLanguageSearch = ({ onSearch, onError }) => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [showExamples, setShowExamples] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [searchResults, setSearchResults] = useState(null);

    const examples = getSearchExamples();

    const handleSearch = async (searchQuery) => {
        try {
            setLoading(true);
            setSearchResults(null);
            
            const response = await processNaturalLanguageQuery(searchQuery);
            const formattedResults = formatSearchResults(response);
            const searchParams = extractSearchParams(response);
            
            setSearchResults(formattedResults);
            
            // If we have direct matches, show them in the dialog
            if (formattedResults.success && formattedResults.matches.length > 0) {
                // Don't close dialog, show results instead
                setShowExamples(false);
            } else if (searchParams.error) {
                // Show error in dialog
                setShowExamples(false);
            } else {
                // Use legacy search behavior for backward compatibility
                onSearch(searchParams);
                setIsOpen(false);
                setQuery('');
            }
        } catch (error) {
            setSearchResults({
                success: false,
                message: error.message || 'Error processing search',
                suggestions: ['Try a different search query', 'Check your internet connection']
            });
            setShowExamples(false);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            handleSearch(query);
        }
    };

    const handleExampleClick = (example) => {
        setQuery(example);
        handleSearch(example);
    };

    const handleClose = () => {
        setIsOpen(false);
        setQuery('');
        setShowExamples(true);
        setSearchResults(null);
    };

    const handleNewSearch = () => {
        setSearchResults(null);
        setShowExamples(true);
        setQuery('');
    };

    const renderConfidenceIndicator = (confidence) => {
        if (confidence >= 80) {
            return <Chip icon={<CheckCircle />} label={`${confidence}% confident`} color="success" size="small" />;
        } else if (confidence >= 50) {
            return <Chip icon={<Warning />} label={`${confidence}% confident`} color="warning" size="small" />;
        } else {
            return <Chip icon={<Warning />} label={`${confidence}% confident`} color="error" size="small" />;
        }
    };

    const renderParsedEntities = (parsed) => {
        const entities = [];
        
        if (parsed.teams?.length > 0) {
            entities.push(
                <Chip key="teams" label={`Teams: ${parsed.teams.map(t => t.name).join(', ')}`} variant="outlined" size="small" />
            );
        }
        
        if (parsed.leagues?.length > 0) {
            entities.push(
                <Chip key="leagues" label={`Leagues: ${parsed.leagues.map(l => l.name).join(', ')}`} variant="outlined" size="small" />
            );
        }
        
        if (parsed.location) {
            entities.push(
                <Chip key="location" label={`Location: ${parsed.location.city}, ${parsed.location.country}`} variant="outlined" size="small" />
            );
        }
        
        if (parsed.dateRange) {
            entities.push(
                <Chip key="dates" label={`Dates: ${parsed.dateRange.start} to ${parsed.dateRange.end}`} variant="outlined" size="small" />
            );
        }
        
        if (parsed.distance) {
            entities.push(
                <Chip key="distance" label={`Within ${parsed.distance} miles`} variant="outlined" size="small" />
            );
        }
        
        return entities;
    };

    return (
        <>
            {/* Floating action button */}
            <Zoom in={!isOpen}>
                <Fab
                    color="primary"
                    aria-label="chat"
                    onClick={() => setIsOpen(true)}
                    sx={{
                        position: 'fixed',
                        bottom: 24,
                        right: 24,
                        zIndex: 1000
                    }}
                >
                    <Chat />
                </Fab>
            </Zoom>

            {/* Chat dialog */}
            <Dialog
                open={isOpen}
                onClose={handleClose}
                TransitionComponent={Transition}
                PaperProps={{
                    sx: {
                        position: 'fixed',
                        bottom: 24,
                        right: 24,
                        m: 0,
                        width: '100%',
                        maxWidth: 450,
                        borderRadius: 2,
                        height: 'auto',
                        maxHeight: '80vh'
                    }
                }}
            >
                <DialogTitle sx={{ 
                    m: 0, 
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                }}>
                    <Typography variant="h6" component="div">
                        Smart Match Search
                    </Typography>
                    <IconButton
                        aria-label="close"
                        onClick={handleClose}
                        sx={{
                            color: (theme) => theme.palette.grey[500]
                        }}
                    >
                        <Close />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 2 }}>
                    {/* Search form */}
                    <Paper 
                        component="form" 
                        onSubmit={handleSubmit}
                        sx={{ 
                            p: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            border: '1px solid',
                            borderColor: 'grey.300',
                            borderRadius: 2,
                            mb: 2
                        }}
                        elevation={0}
                    >
                        <TextField
                            fullWidth
                            placeholder="e.g., Arsenal vs Chelsea in London next weekend"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            sx={{ 
                                ml: 1,
                                flex: 1,
                                '& .MuiInputBase-root': {
                                    padding: '8px'
                                },
                                '& .MuiOutlinedInput-notchedOutline': {
                                    border: 'none'
                                }
                            }}
                            disabled={loading}
                        />
                        {query && (
                            <IconButton 
                                sx={{ p: '10px' }} 
                                aria-label="clear"
                                onClick={() => {
                                    setQuery('');
                                    handleNewSearch();
                                }}
                            >
                                <Clear />
                            </IconButton>
                        )}
                        <IconButton 
                            type="submit" 
                            sx={{ p: '10px' }} 
                            aria-label="search"
                            disabled={!query.trim() || loading}
                        >
                            {loading ? <CircularProgress size={24} /> : <Search />}
                        </IconButton>
                    </Paper>

                    {/* Search Results */}
                    {searchResults && (
                        <Box sx={{ mb: 2 }}>
                            {searchResults.success ? (
                                <Box>
                                    {/* Confidence and parsed entities */}
                                    <Box sx={{ mb: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            {renderConfidenceIndicator(searchResults.confidence)}
                                            <Typography variant="body2" color="text.secondary">
                                                Found {searchResults.count} matches
                                            </Typography>
                                        </Box>
                                        
                                        {/* Parsed entities */}
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {renderParsedEntities(searchResults.parsed)}
                                        </Box>
                                    </Box>

                                    {/* Match results */}
                                    {searchResults.matches.length > 0 && (
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                                Match Results:
                                            </Typography>
                                            <Paper sx={{ maxHeight: 300, overflow: 'auto' }} variant="outlined">
                                                <List dense>
                                                    {searchResults.matches.slice(0, 10).map((match, index) => (
                                                        <React.Fragment key={match._id || index}>
                                                            <ListItem>
                                                                <ListItemText
                                                                    primary={`${match.teams?.home?.name || 'TBD'} vs ${match.teams?.away?.name || 'TBD'}`}
                                                                    secondary={
                                                                        <Box>
                                                                            <Typography variant="body2" color="text.secondary">
                                                                                {formatMatchDateTime(match.date, match.venue).fullDate} • {match.venue?.name || 'TBD'} ({formatMatchDateTime(match.date, match.venue).timeZone})
                                                                            </Typography>
                                                                            {match.distance && (
                                                                                <Typography variant="caption" color="text.secondary">
                                                                                    {match.distance} miles away
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                    }
                                                                />
                                                            </ListItem>
                                                            {index < Math.min(searchResults.matches.length - 1, 9) && <Divider />}
                                                        </React.Fragment>
                                                    ))}
                                                </List>
                                            </Paper>
                                        </Box>
                                    )}
                                </Box>
                            ) : (
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                        {searchResults.message}
                                    </Typography>
                                    {searchResults.suggestions && searchResults.suggestions.length > 0 && (
                                        <Box>
                                            <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                                                Suggestions:
                                            </Typography>
                                            {searchResults.suggestions.map((suggestion, index) => (
                                                <Typography key={index} variant="caption" display="block" sx={{ ml: 1 }}>
                                                    • {suggestion}
                                                </Typography>
                                            ))}
                                        </Box>
                                    )}
                                </Alert>
                            )}
                        </Box>
                    )}

                    {/* Examples section */}
                    <Collapse in={showExamples}>
                        <Box>
                            <Typography 
                                variant="subtitle2" 
                                color="text.secondary"
                                sx={{ mb: 1 }}
                            >
                                Try these examples:
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {examples.map((example, index) => (
                                    <Paper
                                        key={index}
                                        sx={{
                                            p: 1.5,
                                            cursor: 'pointer',
                                            '&:hover': {
                                                bgcolor: 'grey.100'
                                            }
                                        }}
                                        onClick={() => handleExampleClick(example)}
                                        elevation={0}
                                    >
                                        <Typography variant="body2">
                                            "{example}"
                                        </Typography>
                                    </Paper>
                                ))}
                            </Box>
                        </Box>
                    </Collapse>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default NaturalLanguageSearch; 