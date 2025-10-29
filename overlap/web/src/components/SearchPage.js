import React, { useState } from 'react';
import { Box, Container, Typography, Paper } from '@mui/material';
import UnifiedSearch from './UnifiedSearch';
import { useNavigate } from 'react-router-dom';

const SearchPage = () => {
    const navigate = useNavigate();
    const [selectedResult, setSelectedResult] = useState(null);

    const handleResultSelect = (result) => {
        setSelectedResult(result);
        
        // Navigate based on result type
        if (result.type === 'team') {
            navigate(`/teams/${result.id}`);
        } else if (result.type === 'league') {
            navigate(`/leagues/${result.id}`);
        } else if (result.type === 'venue') {
            navigate(`/venues/${result.id}`);
        }
    };

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Paper elevation={0} sx={{ p: 4, backgroundColor: 'transparent' }}>
                <Typography variant="h4" sx={{ mb: 3, fontWeight: 600, textAlign: 'center' }}>
                    Search Leagues, Teams & Venues
                </Typography>
                
                <UnifiedSearch
                    onSelect={handleResultSelect}
                    placeholder="Search for leagues, teams, or venues..."
                    style={{ width: '100%' }}
                />

                {selectedResult && (
                    <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            Selected: {selectedResult.name} ({selectedResult.type})
                        </Typography>
                    </Box>
                )}
            </Paper>
        </Container>
    );
};

export default SearchPage;

