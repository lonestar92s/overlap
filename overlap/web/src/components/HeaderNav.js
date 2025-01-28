import React from 'react';
import { 
    AppBar, 
    Toolbar, 
    IconButton,
    Box,
} from '@mui/material';
import { Home, AccountCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const HeaderNav = ({ onHomeClick }) => {
    const navigate = useNavigate();

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