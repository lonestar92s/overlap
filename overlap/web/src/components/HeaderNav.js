import React, { useState, useContext } from 'react';
import { 
    AppBar, 
    Toolbar, 
    Typography, 
    Box, 
    IconButton, 
    Avatar, 
    Menu, 
    MenuItem,
    Drawer,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Divider,
    useMediaQuery,
    useTheme,
    Chip,
    Badge
} from '@mui/material';
import { 
    AccountCircle, 
    Person, 
    FlightTakeoff, 
    Settings, 
    Logout,
    Menu as MenuIcon,
    Stadium,
    Explore as ExploreIcon,
    Dashboard as DashboardIcon,
    SportsSoccer
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from './Auth';
import { useSubscription } from '../hooks/useSubscription';

const HeaderNav = () => {
    const navigate = useNavigate();
    const { user, logout } = useContext(AuthContext);
    const { subscriptionTier } = useSubscription();
    const [anchorEl, setAnchorEl] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const handleMenuClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleMobileMenuToggle = () => {
        setMobileMenuOpen(!mobileMenuOpen);
    };

    const handleMobileMenuClose = () => {
        setMobileMenuOpen(false);
    };

    const handleHomeClick = () => {
        navigate('/');
        handleMobileMenuClose();
    };

    const handleStadiumsClick = () => {
        navigate('/stadiums');
        handleMobileMenuClose();
    };

    const handleExploreClick = () => {
        navigate('/explore');
        handleMobileMenuClose();
    };

    const handleProfileClick = () => {
        navigate('/profile');
        handleMenuClose();
        handleMobileMenuClose();
    };

    const handleTripsClick = () => {
        navigate('/trips');
        handleMenuClose();
        handleMobileMenuClose();
    };

    const handlePreferencesClick = () => {
        navigate('/preferences');
        handleMenuClose();
        handleMobileMenuClose();
    };

    const handleMatchesClick = () => {
        navigate('/attended-matches');
        handleMenuClose();
        handleMobileMenuClose();
    };

    const handleAdminClick = () => {
        navigate('/admin');
        handleMenuClose();
        handleMobileMenuClose();
    };

    const handleLogout = () => {
        logout();
        navigate('/');
        handleMenuClose();
        handleMobileMenuClose();
    };

    const handleTeamMatchesClick = () => {
        navigate('/team-matches');
        handleMobileMenuClose();
    };

    // Helper function to get subscription badge
    const getSubscriptionBadge = () => {
        if (subscriptionTier === 'pro') {
            return (
                <Chip 
                    label="PRO" 
                    size="small" 
                    sx={{ 
                        backgroundColor: '#FF385C',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.65rem',
                        height: '18px',
                        '& .MuiChip-label': {
                            px: 0.5
                        }
                    }}
                />
            );
        }
        if (subscriptionTier === 'planner') {
            return (
                <Chip 
                    label="PLANNER" 
                    size="small" 
                    sx={{ 
                        backgroundColor: '#9C27B0',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.65rem',
                        height: '18px',
                        '& .MuiChip-label': {
                            px: 0.5
                        }
                    }}
                />
            );
        }
        if (subscriptionTier === 'freemium') {
            return (
                <Chip 
                    label="FREEMIUM" 
                    size="small" 
                    sx={{ 
                        backgroundColor: '#757575',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.65rem',
                        height: '18px',
                        '& .MuiChip-label': {
                            px: 0.5
                        }
                    }}
                />
            );
        }
        return null;
    };

    const mobileMenuItems = [
        { text: 'Home', icon: <ExploreIcon />, onClick: handleHomeClick },
        { text: 'Team Matches', icon: <SportsSoccer />, onClick: handleTeamMatchesClick },
        { text: 'Stadiums', icon: <Stadium />, onClick: handleStadiumsClick },
        { text: 'Explore', icon: <ExploreIcon />, onClick: handleExploreClick },
    ];

    const userMenuItems = [
        { text: 'Profile', icon: <Person />, onClick: handleProfileClick },
        { text: 'My Trips', icon: <FlightTakeoff />, onClick: handleTripsClick },
        { text: 'Memories', icon: <Stadium />, onClick: handleMatchesClick },
        { text: 'Preferences', icon: <Settings />, onClick: handlePreferencesClick },
    ];

    // Add admin menu item if user is admin
    if (user?.role === 'admin') {
        userMenuItems.unshift({
            text: 'Admin Dashboard',
            icon: <DashboardIcon />,
            onClick: handleAdminClick,
            isAdmin: true
        });
    }

    return (
        <>
            <AppBar 
                position="fixed" 
                color="default" 
                elevation={1}
                sx={{
                    backgroundColor: 'white',
                    borderBottom: '1px solid #DDDDDD'
                }}
            >
                <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Left Side - Mobile Menu + Brand */}
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {/* Mobile Menu Button */}
                        {isMobile && (
                            <IconButton
                                edge="start"
                                color="inherit"
                                aria-label="menu"
                                onClick={handleMobileMenuToggle}
                                sx={{ mr: 1 }}
                            >
                                <MenuIcon />
                            </IconButton>
                        )}
                        
                        <Typography 
                            variant="h6" 
                            onClick={handleHomeClick}
                            sx={{ 
                                fontWeight: 700,
                                color: '#FF385C',
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontSize: { xs: '1.1rem', sm: '1.25rem' },
                                '&:hover': {
                                    backgroundColor: 'rgba(255, 56, 92, 0.08)',
                                    color: '#E91E63'
                                }
                            }}
                        >
                            Overlap
                        </Typography>
                    </Box>
                    
                    {/* Center - Main Navigation (Desktop Only) */}
                    <Box sx={{ 
                        display: { xs: 'none', md: 'flex' }, 
                        gap: 2,
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)'
                    }}>
                        <Typography
                            variant="body1"
                            onClick={handleTeamMatchesClick}
                            sx={{ 
                                color: '#666',
                                cursor: 'pointer',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontWeight: 500,
                                '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                    color: '#333'
                                }
                            }}
                        >
                            Team Matches
                        </Typography>
                        <Typography
                            variant="body1"
                            onClick={handleStadiumsClick}
                            sx={{ 
                                color: '#666',
                                cursor: 'pointer',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontWeight: 500,
                                '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                    color: '#333'
                                }
                            }}
                        >
                            Stadiums
                        </Typography>
                        <Typography
                            variant="body1"
                            onClick={handleExploreClick}
                            sx={{ 
                                color: '#666',
                                cursor: 'pointer',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontWeight: 500,
                                '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                    color: '#333'
                                }
                            }}
                        >
                            Explore
                        </Typography>
                    </Box>
                    
                    {/* Right Side - User Menu */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {user ? (
                            <>
                                {/* Subscription Badge */}
                                {getSubscriptionBadge()}
                                
                                <IconButton
                                    onClick={handleMenuClick}
                                    sx={{ 
                                        p: 0.5,
                                        border: '2px solid transparent',
                                        '&:hover': {
                                            borderColor: '#FF385C'
                                        }
                                    }}
                                >
                                    <Avatar 
                                        sx={{ 
                                            width: { xs: 32, sm: 40 }, 
                                            height: { xs: 32, sm: 40 },
                                            backgroundColor: '#FF385C',
                                            fontSize: { xs: '0.875rem', sm: '1rem' }
                                        }}
                                    >
                                        {user?.profile?.firstName?.[0] || user?.email?.[0]?.toUpperCase()}
                                    </Avatar>
                                </IconButton>
                            </>
                        ) : (
                            <IconButton onClick={() => navigate('/auth')}>
                                <AccountCircle />
                            </IconButton>
                        )}
                    </Box>
                    
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="subtitle2" fontWeight="bold">
                                    {user?.profile?.firstName} {user?.profile?.lastName}
                                </Typography>
                                {getSubscriptionBadge()}
                                {user?.role === 'admin' && (
                                    <Chip 
                                        label="Admin" 
                                        size="small" 
                                        color="primary" 
                                        variant="outlined"
                                    />
                                )}
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                                {user?.email}
                            </Typography>
                        </Box>
                        
                        {userMenuItems.map((item, index) => (
                            <MenuItem 
                                key={index} 
                                onClick={item.onClick}
                                sx={item.isAdmin ? { 
                                    backgroundColor: 'primary.50',
                                    '&:hover': { backgroundColor: 'primary.100' }
                                } : {}}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {item.icon}
                                    <Typography color={item.isAdmin ? 'primary.main' : 'inherit'}>
                                        {item.text}
                                    </Typography>
                                </Box>
                            </MenuItem>
                        ))}
                        
                        <MenuItem onClick={handleLogout}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Logout />
                                <Typography>Logout</Typography>
                            </Box>
                        </MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>

            {/* Mobile Navigation Drawer */}
            <Drawer
                anchor="left"
                open={mobileMenuOpen}
                onClose={handleMobileMenuClose}
                PaperProps={{
                    sx: {
                        width: 280,
                        backgroundColor: 'white'
                    }
                }}
            >
                <Box sx={{ pt: 2, pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, mb: 1 }}>
                        <Typography 
                            variant="h6" 
                            sx={{ 
                                fontWeight: 700,
                                color: '#FF385C'
                            }}
                        >
                            Overlap
                        </Typography>
                        {user && getSubscriptionBadge()}
                    </Box>
                    <Divider />
                </Box>
                
                <List>
                    {mobileMenuItems.map((item, index) => (
                        <ListItem 
                            button 
                            key={index} 
                            onClick={item.onClick}
                            sx={{
                                '&:hover': {
                                    backgroundColor: 'rgba(255, 56, 92, 0.04)'
                                }
                            }}
                        >
                            <ListItemIcon sx={{ color: '#666' }}>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText 
                                primary={item.text}
                                primaryTypographyProps={{
                                    fontWeight: 500
                                }}
                            />
                        </ListItem>
                    ))}
                </List>
                
                {user && (
                    <>
                        <Divider sx={{ my: 1 }} />
                        <List>
                            {userMenuItems.map((item, index) => (
                                <ListItem 
                                    button 
                                    key={index} 
                                    onClick={item.onClick}
                                    sx={{
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 56, 92, 0.04)'
                                        }
                                    }}
                                >
                                    <ListItemIcon sx={{ color: '#666' }}>
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText 
                                        primary={item.text}
                                        primaryTypographyProps={{
                                            fontWeight: 500
                                        }}
                                    />
                                </ListItem>
                            ))}
                            
                            <ListItem 
                                button 
                                onClick={handleLogout}
                                sx={{
                                    '&:hover': {
                                        backgroundColor: 'rgba(255, 56, 92, 0.04)'
                                    }
                                }}
                            >
                                <ListItemIcon sx={{ color: '#666' }}>
                                    <Logout />
                                </ListItemIcon>
                                <ListItemText 
                                    primary="Logout"
                                    primaryTypographyProps={{
                                        fontWeight: 500
                                    }}
                                />
                            </ListItem>
                        </List>
                    </>
                )}
            </Drawer>
        </>
    );
};

export default HeaderNav; 