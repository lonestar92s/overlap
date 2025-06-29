import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Card,
    CardContent,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Alert,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Tooltip,
    CircularProgress,
    Tabs,
    Tab
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    Group as GroupIcon,
    Stadium as StadiumIcon,
    Warning as WarningIcon,
    Edit as EditIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
    Clear as ClearIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useAuth } from './Auth';
import { getBackendUrl } from '../utils/api';

function TabPanel({ children, value, index, ...other }) {
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`admin-tabpanel-${index}`}
            aria-labelledby={`admin-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

const AdminDashboard = () => {
    const { user } = useAuth();
    const [currentTab, setCurrentTab] = useState(0);
    const [stats, setStats] = useState(null);
    const [unmappedTeams, setUnmappedTeams] = useState([]);
    const [venues, setVenues] = useState([]);
    const [dataFreshness, setDataFreshness] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Dialog states
    const [mapTeamDialog, setMapTeamDialog] = useState(false);
    const [selectedUnmappedTeam, setSelectedUnmappedTeam] = useState(null);
    const [mappingData, setMappingData] = useState({
        name: '',
        city: '',
        country: '',
        leagueId: ''
    });
    // Add venue edit state
    const [venueEditDialog, setVenueEditDialog] = useState(false);
    const [selectedVenue, setSelectedVenue] = useState(null);
    const [venueEditData, setVenueEditData] = useState({
        name: '',
        address: '',
        city: '',
        country: '',
        latitude: '',
        longitude: '',
        capacity: '',
        surface: '',
        website: ''
    });

    // Subscription management state
    const [users, setUsers] = useState([]);
    const [subscriptionStats, setSubscriptionStats] = useState(null);
    const [userSearch, setUserSearch] = useState('');
    const [selectedTier, setSelectedTier] = useState('');
    const [userPage, setUserPage] = useState(1);
    const [userPagination, setUserPagination] = useState(null);

    const getAuthHeaders = () => ({
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    });

    const fetchStats = async () => {
        try {
            const response = await fetch(`${getBackendUrl()}/api/admin/stats`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                setStats(data.data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchUnmappedTeams = async () => {
        try {
            const response = await fetch(`${getBackendUrl()}/api/admin/unmapped-teams`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                setUnmappedTeams(data.data.teams);
            }
        } catch (error) {
            console.error('Error fetching unmapped teams:', error);
        }
    };

    const fetchVenues = async () => {
        try {
            const response = await fetch(`${getBackendUrl()}/api/admin/venues?hasIssues=true&limit=20`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                setVenues(data.data.venues);
            }
        } catch (error) {
            console.error('Error fetching venues:', error);
        }
    };

    const fetchDataFreshness = async () => {
        try {
            const response = await fetch(`${getBackendUrl()}/api/admin/data-freshness`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                setDataFreshness(data.data);
            }
        } catch (error) {
            console.error('Error fetching data freshness:', error);
        }
    };

    const refreshLeagueData = async (leagueId) => {
        try {
            const response = await fetch(`${getBackendUrl()}/api/admin/refresh-league-data/${leagueId}`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            
            const data = await response.json();
            if (data.success) {
                setSuccess(`League data refresh triggered: ${data.message}`);
                fetchDataFreshness(); // Refresh the data
            } else {
                setError(data.message || 'Failed to refresh league data');
            }
        } catch (error) {
            setError('Error refreshing league data: ' + error.message);
        }
    };

    // Fetch users for subscription management
    const fetchUsers = async () => {
        try {
            const response = await fetch(`${getBackendUrl()}/api/admin/users?page=${userPage}&search=${userSearch}&tier=${selectedTier}`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                setUsers(data.data.users);
                setUserPagination(data.data.pagination);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    // Fetch subscription statistics
    const fetchSubscriptionStats = async () => {
        try {
            const response = await fetch(`${getBackendUrl()}/api/admin/subscription-stats`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                setSubscriptionStats(data.data);
            }
        } catch (error) {
            console.error('Error fetching subscription stats:', error);
        }
    };

    // Update user subscription tier
    const updateUserSubscription = async (userId, newTier) => {
        try {
            const response = await fetch(`${getBackendUrl()}/api/admin/users/${userId}/subscription`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ tier: newTier })
            });
            const data = await response.json();
            if (data.success) {
                setSuccess(`Successfully updated user subscription to ${newTier}`);
                fetchUsers();
                fetchSubscriptionStats();
            } else {
                setError(data.message || 'Failed to update subscription');
            }
        } catch (error) {
            setError('Error updating subscription: ' + error.message);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([
                fetchStats(), 
                fetchUnmappedTeams(), 
                fetchVenues(), 
                fetchDataFreshness(),
                fetchUsers(),
                fetchSubscriptionStats()
            ]);
            setLoading(false);
        };
        loadData();
    }, []);

    // Refresh users when search/filter changes
    useEffect(() => {
        if (currentTab === 3) { // Subscription tab
            fetchUsers();
        }
    }, [userSearch, selectedTier, userPage, currentTab]);

    // Check admin access AFTER all hooks
    if (!user || user.role !== 'admin') {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">
                    Access denied. Admin privileges required.
                </Alert>
            </Box>
        );
    }

    const handleMapTeam = async () => {
        try {
            const response = await fetch(`${getBackendUrl()}/api/admin/map-team`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    apiName: selectedUnmappedTeam.apiName,
                    teamData: mappingData
                })
            });
            
            const data = await response.json();
            if (data.success) {
                setSuccess(`Successfully mapped ${selectedUnmappedTeam.apiName} to ${mappingData.name}`);
                setMapTeamDialog(false);
                setSelectedUnmappedTeam(null);
                setMappingData({ name: '', city: '', country: '', leagueId: '' });
                fetchUnmappedTeams();
                fetchStats();
            } else {
                setError(data.message || 'Failed to map team');
            }
        } catch (error) {
            setError('Error mapping team: ' + error.message);
        }
    };

    const clearUnmappedCache = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${getBackendUrl()}/api/admin/clear-unmapped-cache`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            
            const data = await response.json();
            if (data.success) {
                setSuccess('Cache cleared successfully');
                fetchUnmappedTeams();
            } else {
                setError('Failed to clear cache');
            }
        } catch (error) {
            setError('Error clearing cache: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Venue edit handlers
    const handleEditVenue = (venue) => {
        setSelectedVenue(venue);
        setVenueEditData({
            name: venue.name || '',
            address: venue.address || '',
            city: venue.city || '',
            country: venue.country || '',
            latitude: venue.location?.coordinates?.[1] || '',
            longitude: venue.location?.coordinates?.[0] || '',
            capacity: venue.capacity || '',
            surface: venue.surface || '',
            website: venue.website || ''
        });
        setVenueEditDialog(true);
    };

    const handleSaveVenue = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${getBackendUrl()}/api/admin/venues/${selectedVenue._id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    name: venueEditData.name,
                    address: venueEditData.address,
                    city: venueEditData.city,
                    country: venueEditData.country,
                    location: {
                        type: 'Point',
                        coordinates: [
                            parseFloat(venueEditData.longitude) || null,
                            parseFloat(venueEditData.latitude) || null
                        ].filter(coord => coord !== null)
                    },
                    capacity: venueEditData.capacity ? parseInt(venueEditData.capacity) : null,
                    surface: venueEditData.surface,
                    website: venueEditData.website
                })
            });
            
            const data = await response.json();
            if (data.success) {
                // Check if venue issues have been resolved
                const hasCoordinates = venueEditData.latitude && venueEditData.longitude;
                const hasSpecificName = !venueEditData.name.toLowerCase().match(/stadium|ground|arena/);
                const issuesResolved = hasCoordinates && hasSpecificName;
                
                if (issuesResolved) {
                    setSuccess(`✅ Venue issues resolved! ${venueEditData.name} now has proper coordinates and naming.`);
                } else {
                    const remainingIssues = [];
                    if (!hasCoordinates) remainingIssues.push("missing coordinates");
                    if (!hasSpecificName) remainingIssues.push("generic name");
                    setSuccess(`✏️ Venue updated: ${venueEditData.name}. Still needs: ${remainingIssues.join(", ")}`);
                }
                
                setVenueEditDialog(false);
                setSelectedVenue(null);
                setVenueEditData({
                    name: '',
                    address: '',
                    city: '',
                    country: '',
                    latitude: '',
                    longitude: '',
                    capacity: '',
                    surface: '',
                    website: ''
                });
                
                // Refresh venues list to reflect changes
                await fetchVenues();
                // Also refresh stats to update venue coverage metrics
                await fetchStats();
            } else {
                setError('Failed to update venue: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            setError('Error updating venue: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DashboardIcon />
                Admin Dashboard
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
                    {success}
                </Alert>
            )}

            {/* Stats Overview */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Teams
                            </Typography>
                            <Typography variant="h4">
                                {stats?.teams.total || 0}
                            </Typography>
                            <Typography variant="body2">
                                {stats?.teams.mappingCoverage}% with API mapping
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Venues
                            </Typography>
                            <Typography variant="h4">
                                {stats?.venues.total || 0}
                            </Typography>
                            <Typography variant="body2">
                                {stats?.venues.coordinateCoverage}% with coordinates
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Unmapped Teams
                            </Typography>
                            <Typography variant="h4" color="warning.main">
                                {stats?.unmappedTeams.count || 0}
                            </Typography>
                            <Typography variant="body2">
                                Need attention
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card>
                        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<RefreshIcon />}
                                onClick={() => {
                                    fetchStats();
                                    fetchUnmappedTeams();
                                    fetchVenues();
                                    fetchDataFreshness();
                                }}
                            >
                                Refresh Data
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<ClearIcon />}
                                onClick={clearUnmappedCache}
                                color="warning"
                            >
                                Clear Cache
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Tabs */}
            <Paper>
                <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
                    <Tab label="Unmapped Teams" icon={<WarningIcon />} />
                    <Tab label="Venue Issues" icon={<StadiumIcon />} />
                    <Tab label="Data Freshness" icon={<ScheduleIcon />} />
                    <Tab label="Subscriptions" icon={<GroupIcon />} />
                </Tabs>

                {/* Unmapped Teams Tab */}
                <TabPanel value={currentTab} index={0}>
                    <Typography variant="h6" gutterBottom>
                        Unmapped Teams ({unmappedTeams.length})
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        These teams were encountered during API searches but couldn't be mapped to database teams.
                    </Typography>
                    
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>API Name</TableCell>
                                    <TableCell>Occurrences</TableCell>
                                    <TableCell>First Seen</TableCell>
                                    <TableCell>Last Seen</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {unmappedTeams.map((team, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <strong>{team.apiName}</strong>
                                        </TableCell>
                                        <TableCell>
                                            <Chip 
                                                label={team.occurrences} 
                                                size="small" 
                                                color={team.occurrences > 5 ? "error" : "warning"}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {new Date(team.firstSeen).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(team.lastSeen).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={() => {
                                                    setSelectedUnmappedTeam(team);
                                                    setMappingData({
                                                        name: team.apiName,
                                                        city: '',
                                                        country: '',
                                                        leagueId: ''
                                                    });
                                                    setMapTeamDialog(true);
                                                }}
                                            >
                                                Map Team
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </TabPanel>

                {/* Venue Issues Tab */}
                <TabPanel value={currentTab} index={1}>
                    <Typography variant="h6" gutterBottom>
                        Venues with Issues ({venues.length})
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Venues that may need attention (missing coordinates, generic names, etc.)
                    </Typography>
                    
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>City</TableCell>
                                    <TableCell>Country</TableCell>
                                    <TableCell>Coordinates</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {venues.map((venue) => (
                                    <TableRow key={venue._id}>
                                        <TableCell>{venue.name}</TableCell>
                                        <TableCell>{venue.city}</TableCell>
                                        <TableCell>{venue.country}</TableCell>
                                        <TableCell>
                                            {venue.location?.coordinates ? 
                                                `${venue.location.coordinates[1]}, ${venue.location.coordinates[0]}` : 
                                                <Chip label="Missing" color="error" size="small" />
                                            }
                                        </TableCell>
                                        <TableCell>
                                            <IconButton size="small" onClick={() => handleEditVenue(venue)}>
                                                <EditIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </TabPanel>

                {/* Data Freshness Tab */}
                <TabPanel value={currentTab} index={2}>
                    <Typography variant="h6" gutterBottom>
                        Data Freshness Monitor
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Monitor API data currency and detect new seasons across major leagues.
                    </Typography>
                    
                    {dataFreshness && (
                        <>
                            {/* Overall Health Card */}
                            <Paper sx={{ p: 2, mb: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {dataFreshness.overall.status === 'healthy' ? (
                                            <CheckCircleIcon color="success" />
                                        ) : (
                                            <ErrorIcon color="error" />
                                        )}
                                        <Typography variant="h6">
                                            System Health: {dataFreshness.overall.healthPercentage}%
                                        </Typography>
                                    </Box>
                                    <Chip 
                                        label={dataFreshness.overall.status.toUpperCase()} 
                                        color={
                                            dataFreshness.overall.status === 'healthy' ? 'success' :
                                            dataFreshness.overall.status === 'warning' ? 'warning' : 'error'
                                        }
                                    />
                                </Box>
                                <Typography variant="body2" color="textSecondary">
                                    {dataFreshness.overall.upToDateLeagues} of {dataFreshness.overall.totalLeagues} leagues up to date
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Last checked: {new Date(dataFreshness.overall.lastChecked).toLocaleString()}
                                </Typography>
                            </Paper>

                            {/* Recommendations */}
                            {dataFreshness.recommendations && dataFreshness.recommendations.length > 0 && (
                                <Paper sx={{ p: 2, mb: 3 }}>
                                    <Typography variant="h6" gutterBottom>
                                        Recommendations
                                    </Typography>
                                    {dataFreshness.recommendations.map((rec, index) => (
                                        <Alert 
                                            key={index}
                                            severity={rec.priority === 'high' ? 'error' : rec.priority === 'medium' ? 'warning' : 'info'}
                                            sx={{ mb: 1 }}
                                        >
                                            <Typography variant="body2" fontWeight="bold">
                                                {rec.message}
                                            </Typography>
                                            <Typography variant="body2">
                                                Action: {rec.action}
                                            </Typography>
                                        </Alert>
                                    ))}
                                </Paper>
                            )}

                            {/* League Status Table */}
                            <TableContainer component={Paper}>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>League</TableCell>
                                            <TableCell>Country</TableCell>
                                            <TableCell>Current Season</TableCell>
                                            <TableCell>Expected Season</TableCell>
                                            <TableCell>Last Update</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {dataFreshness.leagues.map((league) => (
                                            <TableRow key={league.leagueId}>
                                                <TableCell>
                                                    <strong>{league.leagueName}</strong>
                                                </TableCell>
                                                <TableCell>{league.country}</TableCell>
                                                <TableCell>{league.currentSeasonInDB}</TableCell>
                                                <TableCell>{league.expectedSeason}</TableCell>
                                                <TableCell>
                                                    {league.lastDataUpdate ? 
                                                        new Date(league.lastDataUpdate).toLocaleDateString() : 
                                                        'Never'
                                                    }
                                                </TableCell>
                                                <TableCell>
                                                    {league.isUpToDate ? (
                                                        <Chip 
                                                            label="Up to Date" 
                                                            color="success" 
                                                            size="small" 
                                                            icon={<CheckCircleIcon />}
                                                        />
                                                    ) : (
                                                        <Tooltip title={league.issues.join('; ')}>
                                                            <Chip 
                                                                label="Issues Found" 
                                                                color="error" 
                                                                size="small"
                                                                icon={<ErrorIcon />}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        size="small"
                                                        startIcon={<RefreshIcon />}
                                                        onClick={() => refreshLeagueData(league.leagueId)}
                                                        disabled={league.isUpToDate}
                                                    >
                                                        Refresh
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </>
                    )}
                </TabPanel>

                {/* Subscription Management Tab */}
                <TabPanel value={currentTab} index={3}>
                    <Typography variant="h6" gutterBottom>
                        Subscription Management
                    </Typography>
                    
                    {/* Subscription Statistics */}
                    {subscriptionStats && (
                        <Grid container spacing={3} sx={{ mb: 3 }}>
                            <Grid item xs={12} md={3}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" color="primary">
                                            {subscriptionStats.totalUsers}
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Total Users
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" color="success.main">
                                            {subscriptionStats.tierStats.freemium}
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Freemium Users
                                        </Typography>
                                        <Typography variant="caption" display="block">
                                            Premier League only
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" color="warning.main">
                                            {subscriptionStats.tierStats.pro}
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Pro Users
                                        </Typography>
                                        <Typography variant="caption" display="block">
                                            Premier League + Championship
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" color="error.main">
                                            {subscriptionStats.tierStats.planner}
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Planner Users
                                        </Typography>
                                        <Typography variant="caption" display="block">
                                            All leagues + premium features
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    )}

                    {/* Search and Filter Controls */}
                    <Paper sx={{ p: 2, mb: 3 }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} md={4}>
                                <TextField
                                    label="Search Users"
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    placeholder="Email, first name, last name..."
                                    fullWidth
                                    size="small"
                                />
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Filter by Tier</InputLabel>
                                    <Select
                                        value={selectedTier}
                                        label="Filter by Tier"
                                        onChange={(e) => setSelectedTier(e.target.value)}
                                    >
                                        <MenuItem value="">All Tiers</MenuItem>
                                        <MenuItem value="freemium">Freemium</MenuItem>
                                        <MenuItem value="pro">Pro</MenuItem>
                                        <MenuItem value="planner">Planner</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <Button
                                    variant="outlined"
                                    onClick={() => {
                                        setUserSearch('');
                                        setSelectedTier('');
                                        setUserPage(1);
                                    }}
                                    fullWidth
                                >
                                    Clear Filters
                                </Button>
                            </Grid>
                        </Grid>
                    </Paper>

                    {/* Users Table */}
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>User</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Current Tier</TableCell>
                                    <TableCell>Start Date</TableCell>
                                    <TableCell>End Date</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user._id}>
                                        <TableCell>
                                            <Box>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {user.profile?.firstName && user.profile?.lastName 
                                                        ? `${user.profile.firstName} ${user.profile.lastName}`
                                                        : 'No Name'
                                                    }
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary">
                                                    Joined: {new Date(user.createdAt).toLocaleDateString()}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={user.subscription?.tier || 'freemium'}
                                                color={
                                                    user.subscription?.tier === 'planner' ? 'error' :
                                                    user.subscription?.tier === 'pro' ? 'warning' : 'success'
                                                }
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {user.subscription?.startDate 
                                                ? new Date(user.subscription.startDate).toLocaleDateString()
                                                : 'N/A'
                                            }
                                        </TableCell>
                                        <TableCell>
                                            {user.subscription?.endDate 
                                                ? new Date(user.subscription.endDate).toLocaleDateString()
                                                : 'Never'
                                            }
                                        </TableCell>
                                        <TableCell>
                                            <FormControl size="small" sx={{ minWidth: 120 }}>
                                                <Select
                                                    value={user.subscription?.tier || 'freemium'}
                                                    onChange={(e) => updateUserSubscription(user._id, e.target.value)}
                                                >
                                                    <MenuItem value="freemium">Freemium</MenuItem>
                                                    <MenuItem value="pro">Pro</MenuItem>
                                                    <MenuItem value="planner">Planner</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Pagination */}
                    {userPagination && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <Button
                                disabled={userPage === 1}
                                onClick={() => setUserPage(userPage - 1)}
                            >
                                Previous
                            </Button>
                            <Typography sx={{ mx: 2, alignSelf: 'center' }}>
                                Page {userPage} of {userPagination.pages} ({userPagination.total} users)
                            </Typography>
                            <Button
                                disabled={userPage >= userPagination.pages}
                                onClick={() => setUserPage(userPage + 1)}
                            >
                                Next
                            </Button>
                        </Box>
                    )}
                </TabPanel>
            </Paper>

            {/* Map Team Dialog */}
            <Dialog 
                open={mapTeamDialog} 
                onClose={() => setMapTeamDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Map Team: {selectedUnmappedTeam?.apiName}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Team Name"
                            value={mappingData.name}
                            onChange={(e) => setMappingData({...mappingData, name: e.target.value})}
                            required
                            fullWidth
                        />
                        <TextField
                            label="City"
                            value={mappingData.city}
                            onChange={(e) => setMappingData({...mappingData, city: e.target.value})}
                            fullWidth
                        />
                        <TextField
                            label="Country"
                            value={mappingData.country}
                            onChange={(e) => setMappingData({...mappingData, country: e.target.value})}
                            fullWidth
                        />
                        <TextField
                            label="League"
                            value={mappingData.leagueId}
                            onChange={(e) => setMappingData({...mappingData, leagueId: e.target.value})}
                            fullWidth
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setMapTeamDialog(false)}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleMapTeam}
                        variant="contained"
                        disabled={!mappingData.name}
                    >
                        Map Team
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Venue Edit Dialog */}
            <Dialog 
                open={venueEditDialog} 
                onClose={() => setVenueEditDialog(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    Edit Venue: {selectedVenue?.name}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Venue Name"
                            value={venueEditData.name}
                            onChange={(e) => setVenueEditData({...venueEditData, name: e.target.value})}
                            required
                            fullWidth
                        />
                        <TextField
                            label="Address"
                            value={venueEditData.address}
                            onChange={(e) => setVenueEditData({...venueEditData, address: e.target.value})}
                            fullWidth
                            multiline
                            rows={2}
                        />
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                label="City"
                                value={venueEditData.city}
                                onChange={(e) => setVenueEditData({...venueEditData, city: e.target.value})}
                                fullWidth
                            />
                            <TextField
                                label="Country"
                                value={venueEditData.country}
                                onChange={(e) => setVenueEditData({...venueEditData, country: e.target.value})}
                                fullWidth
                            />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                label="Latitude"
                                value={venueEditData.latitude}
                                onChange={(e) => setVenueEditData({...venueEditData, latitude: e.target.value})}
                                type="number"
                                inputProps={{ step: "any" }}
                                fullWidth
                                helperText="GPS coordinate (e.g., 51.5074)"
                            />
                            <TextField
                                label="Longitude"
                                value={venueEditData.longitude}
                                onChange={(e) => setVenueEditData({...venueEditData, longitude: e.target.value})}
                                type="number"
                                inputProps={{ step: "any" }}
                                fullWidth
                                helperText="GPS coordinate (e.g., -0.1278)"
                            />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                label="Capacity"
                                value={venueEditData.capacity}
                                onChange={(e) => setVenueEditData({...venueEditData, capacity: e.target.value})}
                                type="number"
                                fullWidth
                                helperText="Stadium capacity"
                            />
                            <TextField
                                label="Surface"
                                value={venueEditData.surface}
                                onChange={(e) => setVenueEditData({...venueEditData, surface: e.target.value})}
                                fullWidth
                                helperText="e.g., Grass, Artificial"
                            />
                        </Box>
                        <TextField
                            label="Website"
                            value={venueEditData.website}
                            onChange={(e) => setVenueEditData({...venueEditData, website: e.target.value})}
                            fullWidth
                            helperText="Official venue website URL"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setVenueEditDialog(false)}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSaveVenue}
                        variant="contained"
                        disabled={!venueEditData.name || loading}
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdminDashboard; 