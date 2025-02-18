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
    Slide
} from '@mui/material';
import { Search, Clear, Chat, Close } from '@mui/icons-material';
import { processNaturalLanguageQuery, extractSearchParams } from '../services/naturalLanguageService';

const Transition = React.forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const NaturalLanguageSearch = ({ onSearch, onError }) => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [showExamples, setShowExamples] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    const examples = [
        "Find Premier League matches in London next weekend",
        "Show me derby matches within 100 miles of Manchester in December",
        "Find matches between top teams in Spain during Christmas week",
        "Show Champions League matches in Germany next month"
    ];

    const handleSearch = async (searchQuery) => {
        try {
            setLoading(true);
            const response = await processNaturalLanguageQuery(searchQuery);
            const searchParams = extractSearchParams(response);
            onSearch(searchParams);
            setIsOpen(false); // Close dialog after successful search
            setQuery(''); // Clear query
        } catch (error) {
            onError(error.message || 'Error processing search');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            handleSearch(query);
            setShowExamples(false);
        }
    };

    const handleExampleClick = (example) => {
        setQuery(example);
        handleSearch(example);
        setShowExamples(false);
    };

    const handleClose = () => {
        setIsOpen(false);
        setQuery('');
        setShowExamples(true);
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
                        maxWidth: 400,
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
                        Search Matches
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
                            placeholder="Search matches using natural language..."
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
                                    setShowExamples(true);
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