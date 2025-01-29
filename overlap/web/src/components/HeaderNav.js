import React from 'react';
import { 
    AppBar, 
    Toolbar, 
    IconButton,
    Box,
    Typography
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
                backgroundColor: 'white',
                borderBottom: '1px solid #DDDDDD'
            }}
        >
            <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton
                        edge="start"
                        color="inherit"
                        aria-label="home"
                        onClick={handleHomeClick}
                        sx={{ mr: 1 }}
                    >
                        <Home />
                    </IconButton>
                    <Typography 
                        variant="h6" 
                        sx={{ 
                            fontWeight: 700,
                            color: '#FF385C',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        Overlap
                    </Typography>
                </Box>

                <Box>
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
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default HeaderNav; 