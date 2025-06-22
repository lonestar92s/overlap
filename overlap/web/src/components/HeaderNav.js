import React, { useState } from 'react';
import { 
    AppBar, 
    Toolbar, 
    IconButton,
    Box,
    Typography,
    Menu,
    MenuItem,
    Avatar,
    Divider
} from '@mui/material';
import { 
    Home, 
    Person, 
    ExitToApp
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const HeaderNav = ({ onHomeClick, user, onLogout }) => {
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = useState(null);

    const handleHomeClick = () => {
        onHomeClick();
        navigate('/');
    };

    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleProfileClick = () => {
        handleMenuClose();
        navigate('/profile');
    };

    const handleLogoutClick = () => {
        handleMenuClose();
        onLogout();
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
                        onClick={handleMenuOpen}
                        sx={{ 
                            color: '#666',
                            '&:hover': {
                                backgroundColor: 'rgba(0, 0, 0, 0.04)'
                            }
                        }}
                    >
                        {user?.profile?.avatar ? (
                            <Avatar 
                                src={user.profile.avatar} 
                                sx={{ width: 32, height: 32 }}
                            />
                        ) : (
                            <Avatar sx={{ width: 32, height: 32, bgcolor: '#FF385C' }}>
                                {user?.profile?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                            </Avatar>
                        )}
                    </IconButton>
                    
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleMenuClose}
                        onClick={handleMenuClose}
                        PaperProps={{
                            elevation: 3,
                            sx: {
                                mt: 1.5,
                                minWidth: 200,
                                '& .MuiMenuItem-root': {
                                    px: 2,
                                    py: 1
                                }
                            }
                        }}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    >
                        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid #eee' }}>
                            <Typography variant="subtitle2" fontWeight="bold">
                                {user?.profile?.firstName} {user?.profile?.lastName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {user?.email}
                            </Typography>
                        </Box>
                        
                        <MenuItem onClick={handleProfileClick}>
                            <Person sx={{ mr: 1 }} />
                            Profile & Preferences
                        </MenuItem>
                        
                        <Divider />
                        
                        <MenuItem onClick={handleLogoutClick}>
                            <ExitToApp sx={{ mr: 1 }} />
                            Logout
                        </MenuItem>
                    </Menu>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default HeaderNav; 