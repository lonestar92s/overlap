import React from 'react';
import { 
    AppBar, 
    Toolbar, 
    IconButton,
    Box,
    Button
} from '@mui/material';
import { Home, AccountCircle, Map as MapIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const HeaderNav = ({ onHomeClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const isMapPage = location.pathname === '/map';

    const handleMapClick = () => {
        navigate('/map');
    };

    const handleHomeClick = () => {
        onHomeClick();
        navigate('/');
    };

    return (
        <AppBar 
            position="fixed" 
            color="default" 
            elevation={1}
            sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)'
            }}
        >
            <Toolbar sx={{ justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton
                        onClick={handleHomeClick}
                        size="large"
                        sx={{ 
                            color: '#FF385C',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 56, 92, 0.04)'
                            }
                        }}
                    >
                        <Home />
                    </IconButton>

                    <Button
                        startIcon={<MapIcon />}
                        onClick={handleMapClick}
                        sx={{ 
                            color: isMapPage ? '#FF385C' : '#666',
                            '&:hover': {
                                backgroundColor: 'rgba(255, 56, 92, 0.04)'
                            }
                        }}
                    >
                        Map
                    </Button>
                </Box>

                <IconButton
                    size="large"
                    sx={{ 
                        color: '#666',
                        '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.04)'
                        }
                    }}
                >
                    <AccountCircle />
                </IconButton>
            </Toolbar>
        </AppBar>
    );
};

export default HeaderNav; 