import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import Map from './Map';

const MapPage = () => {
    return (
        <Container maxWidth="lg">
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    py: 4,
                    mt: 8 // Account for header
                }}
            >
                <Typography 
                    variant="h4" 
                    component="h1"
                    sx={{ 
                        mb: 4,
                        fontWeight: 600,
                        color: '#222222'
                    }}
                >
                    Map View
                </Typography>
                <Map />
            </Box>
        </Container>
    );
};

export default MapPage; 