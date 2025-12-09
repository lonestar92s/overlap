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
    FormHelperText,
    IconButton,
    Tooltip,
    CircularProgress,
    Tabs,
    Tab,
    Collapse
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
    Schedule as ScheduleIcon,
    SportsSoccer as SportsSoccerIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon
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

// League Onboarding Wizard Component
const LeagueOnboardingWizard = ({ getAuthHeaders, onSuccess, onError }) => {
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        country: '',
        countryCode: '',
        tier: null
    });
    const [suggestedShortName, setSuggestedShortName] = useState('');
    const [loading, setLoading] = useState(false);
    const [onboarding, setOnboarding] = useState(false);
    const [progress, setProgress] = useState(null);
    const [result, setResult] = useState(null);

    const handleInputChange = (field, value) => {
        const newData = { ...formData, [field]: value };
        setFormData(newData);
        
        // Auto-suggest short name when name changes
        if (field === 'name' && value) {
            fetchSuggestedShortName(value);
        }
    };

    const fetchSuggestedShortName = async (leagueName) => {
        try {
            const response = await fetch(
                `${getBackendUrl()}/api/admin/leagues/suggest-short-name?name=${encodeURIComponent(leagueName)}`,
                {
                    headers: getAuthHeaders()
                }
            );
            const data = await response.json();
            if (data.success) {
                setSuggestedShortName(data.shortName);
            }
        } catch (error) {
            // Silently fail - not critical
        }
    };

    const handleOnboard = async () => {
        if (!formData.id || !formData.name || !formData.country) {
            onError('Please fill in all required fields (ID, Name, Country)');
            return;
        }

        setLoading(true);
        setOnboarding(true);
        setProgress({ step: 'starting', message: 'Starting onboarding process...' });
        setResult(null);

        try {
            const response = await fetch(`${getBackendUrl()}/api/admin/leagues/onboard`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(formData)
            });

            // Check if response is OK before parsing JSON
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
            }

            // Check content type before parsing
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}`);
            }

            const data = await response.json();

            if (data.success) {
                setResult({
                    success: true,
                    message: data.message,
                    stats: data.stats,
                    shortName: data.shortName,
                    warning: data.warning
                });
                setProgress({ step: 'complete', message: 'Onboarding completed successfully!' });
                onSuccess();
            } else {
                setResult({
                    success: false,
                    message: data.message,
                    stats: data.stats
                });
                setProgress({ step: 'error', message: data.message });
                onError(data.message);
            }
        } catch (error) {
            const errorMsg = 'Failed to onboard league: ' + error.message;
            setResult({ success: false, message: errorMsg });
            setProgress({ step: 'error', message: errorMsg });
            onError(errorMsg);
        } finally {
            setLoading(false);
            setOnboarding(false);
        }
    };

    const handleReset = () => {
        setFormData({ id: '', name: '', country: '', countryCode: '', tier: null });
        setSuggestedShortName('');
        setProgress(null);
        setResult(null);
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Onboard New League
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                Add a new league to the system. The system will automatically import teams, venues, and geocode stadium locations.
            </Typography>

            {!onboarding && !result && (
                <Paper sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="API-Football League ID *"
                            value={formData.id}
                            onChange={(e) => handleInputChange('id', e.target.value)}
                            type="number"
                            required
                            fullWidth
                            helperText="The league ID from API-Football (e.g., 39 for Premier League)"
                        />
                        <TextField
                            label="League Name *"
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            required
                            fullWidth
                            helperText="Full league name (e.g., 'Premier League', 'La Liga')"
                        />
                        {suggestedShortName && (
                            <Alert severity="info" sx={{ mb: 1 }}>
                                Suggested short name: <strong>{suggestedShortName}</strong>
                            </Alert>
                        )}
                        <TextField
                            label="Country *"
                            value={formData.country}
                            onChange={(e) => handleInputChange('country', e.target.value)}
                            required
                            fullWidth
                            helperText="Country name (e.g., 'England', 'Spain', 'France')"
                        />
                        <TextField
                            label="Country Code"
                            value={formData.countryCode}
                            onChange={(e) => handleInputChange('countryCode', e.target.value.toUpperCase())}
                            fullWidth
                            helperText="ISO 2-letter country code (e.g., 'GB', 'ES', 'FR'). Auto-detected if not provided."
                            inputProps={{ maxLength: 2 }}
                        />
                        <FormControl fullWidth>
                            <InputLabel>League Tier (Optional)</InputLabel>
                            <Select
                                value={formData.tier ?? ''}
                                label="League Tier (Optional)"
                                onChange={(e) => handleInputChange('tier', e.target.value === '' ? null : parseInt(e.target.value))}
                            >
                                <MenuItem value="">Not Specified (Default: 1)</MenuItem>
                                <MenuItem value={1}>Tier 1 (Top Division)</MenuItem>
                                <MenuItem value={2}>Tier 2 (Second Division)</MenuItem>
                                <MenuItem value={3}>Tier 3 (Third Division)</MenuItem>
                            </Select>
                            <FormHelperText>Optional. Mainly for league divisions. Cup competitions can leave this as default.</FormHelperText>
                        </FormControl>
                        <Button
                            variant="contained"
                            onClick={handleOnboard}
                            disabled={loading || !formData.id || !formData.name || !formData.country}
                            startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
                            sx={{ mt: 2 }}
                        >
                            {loading ? 'Onboarding...' : 'Onboard League'}
                        </Button>
                    </Box>
                </Paper>
            )}

            {onboarding && progress && (
                <Paper sx={{ p: 3, mt: 2 }}>
                    <Typography variant="h6" gutterBottom>
                        Onboarding in Progress...
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            {progress.message}
                        </Typography>
                        {progress.total && (
                            <Box sx={{ mt: 2 }}>
                                <Typography variant="body2" color="textSecondary">
                                    Progress: {progress.current || 0} / {progress.total} teams
                                </Typography>
                                <Box sx={{ mt: 1, width: '100%' }}>
                                    <CircularProgress />
                                </Box>
                            </Box>
                        )}
                    </Box>
                </Paper>
            )}

            {result && (
                <Paper sx={{ p: 3, mt: 2 }}>
                    <Alert 
                        severity={result.success ? 'success' : 'error'} 
                        sx={{ mb: 2 }}
                        action={
                            <Button size="small" onClick={handleReset}>
                                Onboard Another
                            </Button>
                        }
                    >
                        {result.message}
                    </Alert>
                    
                    {result.success && result.stats && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="h6" gutterBottom>
                                Import Statistics
                            </Typography>
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                                <Grid item xs={12} md={4}>
                                    <Card>
                                        <CardContent>
                                            <Typography color="textSecondary" gutterBottom>
                                                League
                                            </Typography>
                                            <Typography variant="h5">
                                                {result.stats.league.created > 0 && 'Created'}
                                                {result.stats.league.updated > 0 && 'Updated'}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Card>
                                        <CardContent>
                                            <Typography color="textSecondary" gutterBottom>
                                                Teams
                                            </Typography>
                                            <Typography variant="h5">
                                                {result.stats.teams.created + result.stats.teams.updated}
                                            </Typography>
                                            <Typography variant="body2" color="textSecondary">
                                                {result.stats.teams.created} created, {result.stats.teams.updated} updated
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Card>
                                        <CardContent>
                                            <Typography color="textSecondary" gutterBottom>
                                                Venues
                                            </Typography>
                                            <Typography variant="h5">
                                                {result.stats.venues.created + result.stats.venues.updated}
                                            </Typography>
                                            <Typography variant="body2" color="textSecondary">
                                                {result.stats.venues.created} created, {result.stats.venues.updated} updated
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                            
                            {result.shortName && (
                                <Alert severity="success" sx={{ mt: 2 }}>
                                    <Typography variant="body2">
                                        <strong>✅ League Successfully Onboarded!</strong>
                                        <br />The league has been automatically added to the database and will appear in:
                                        <br />• Search results
                                        <br />• League picker (mobile app)
                                        <br />• Match recommendations
                                        <br />
                                        <br />No manual configuration needed - the system uses dynamic league loading from the database.
                                        <br />Suggested short name: <strong>{result.shortName}</strong>
                                    </Typography>
                                </Alert>
                            )}
                            
                            {result.warning && (
                                <Alert severity="warning" sx={{ mt: 2 }}>
                                    {result.warning}
                                </Alert>
                            )}
                        </Box>
                    )}
                </Paper>
            )}
        </Box>
    );
};

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

    // Onboarded leagues state
    const [onboardedLeagues, setOnboardedLeagues] = useState([]);
    const [leagueSearch, setLeagueSearch] = useState('');
    const [leagueCountryFilter, setLeagueCountryFilter] = useState('');
    const [leaguePage, setLeaguePage] = useState(1);
    const [leaguePagination, setLeaguePagination] = useState(null);
    const [leagueLoading, setLeagueLoading] = useState(false);
    const [expandedLeagues, setExpandedLeagues] = useState(new Set());
    const [leagueTeams, setLeagueTeams] = useState({});
    const [loadingTeams, setLoadingTeams] = useState({});

    // Venues state
    const [venueSearch, setVenueSearch] = useState('');
    const [venueCountryFilter, setVenueCountryFilter] = useState('');
    const [venueHasIssuesFilter, setVenueHasIssuesFilter] = useState(false);
    const [venuePage, setVenuePage] = useState(1);
    const [venuePagination, setVenuePagination] = useState(null);
    const [venueLoading, setVenueLoading] = useState(false);

    // League season year edit state
    const [leagueEditDialog, setLeagueEditDialog] = useState(false);
    const [selectedLeague, setSelectedLeague] = useState(null);
    const [leagueSeasonYear, setLeagueSeasonYear] = useState('');

    // Feedback state
    const [feedback, setFeedback] = useState([]);
    const [feedbackSearch, setFeedbackSearch] = useState('');
    const [feedbackTypeFilter, setFeedbackTypeFilter] = useState('');
    const [feedbackPage, setFeedbackPage] = useState(1);
    const [feedbackPagination, setFeedbackPagination] = useState(null);
    const [feedbackLoading, setFeedbackLoading] = useState(false);
    const [feedbackSortBy, setFeedbackSortBy] = useState('created_at');
    const [feedbackOrder, setFeedbackOrder] = useState('desc');

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

    const fetchVenues = async (page = venuePage) => {
        try {
            setVenueLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20'
            });
            
            if (venueSearch) {
                params.append('search', venueSearch);
            }
            
            if (venueCountryFilter) {
                params.append('country', venueCountryFilter);
            }
            
            if (venueHasIssuesFilter) {
                params.append('hasIssues', 'true');
            }
            
            const response = await fetch(`${getBackendUrl()}/api/admin/venues?${params}`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                setVenues(data.data.venues);
                setVenuePagination(data.data.pagination);
            } else {
                setError('Failed to fetch venues');
            }
        } catch (error) {
            console.error('Error fetching venues:', error);
            setError('Error fetching venues: ' + error.message);
        } finally {
            setVenueLoading(false);
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
                // Set subscription stats from the combined response
                setSubscriptionStats(data.data.stats);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setError('Failed to fetch users and subscription data');
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

    // Add useEffect to load data on mount
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                await fetchUsers();
            } catch (error) {
                setError('Failed to load dashboard data');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [userPage, userSearch, selectedTier]); // Re-fetch when these values change

    // Fetch leagues when search, filter, or page changes
    useEffect(() => {
        if (currentTab === 5) {
            fetchOnboardedLeagues();
        }
    }, [leaguePage]); // Only refetch on page change, not on search/filter (user clicks Search button)

    // Fetch venues when tab changes or page changes
    useEffect(() => {
        if (currentTab === 1) {
            fetchVenues();
        }
    }, [venuePage]); // Only refetch on page change, not on search/filter (user clicks Search button)

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

    // Fetch onboarded leagues
    const fetchFeedback = async (page = feedbackPage) => {
        try {
            setFeedbackLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '50',
                sortBy: feedbackSortBy,
                order: feedbackOrder
            });
            
            if (feedbackSearch) {
                params.append('search', feedbackSearch);
            }
            
            if (feedbackTypeFilter) {
                params.append('type', feedbackTypeFilter);
            }
            
            const response = await fetch(`${getBackendUrl()}/api/admin/feedback?${params}`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                setFeedback(data.data.feedback || []);
                setFeedbackPagination(data.data.pagination);
            } else {
                setError('Failed to fetch feedback');
            }
        } catch (error) {
            console.error('Error fetching feedback:', error);
            setError('Error fetching feedback: ' + error.message);
        } finally {
            setFeedbackLoading(false);
        }
    };

    const fetchOnboardedLeagues = async (page = leaguePage) => {
        try {
            setLeagueLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20'
            });
            
            if (leagueSearch) {
                params.append('search', leagueSearch);
            }
            
            if (leagueCountryFilter) {
                params.append('country', leagueCountryFilter);
            }
            
            const response = await fetch(`${getBackendUrl()}/api/admin/leagues?${params}`, {
                headers: getAuthHeaders()
            });
            
            const data = await response.json();
            if (data.success) {
                setOnboardedLeagues(data.data);
                setLeaguePagination(data.pagination);
            } else {
                setError('Failed to fetch leagues');
            }
        } catch (error) {
            setError('Error fetching leagues: ' + error.message);
        } finally {
            setLeagueLoading(false);
        }
    };

    // Fetch teams for a league
    const fetchLeagueTeams = async (leagueId) => {
        // If teams already loaded, don't fetch again
        if (leagueTeams[leagueId]) {
            return;
        }

        try {
            setLoadingTeams(prev => ({ ...prev, [leagueId]: true }));
            const response = await fetch(`${getBackendUrl()}/api/admin/leagues/${leagueId}/teams`, {
                headers: getAuthHeaders()
            });
            
            const data = await response.json();
            if (data.success) {
                setLeagueTeams(prev => ({ ...prev, [leagueId]: data.data }));
            } else {
                setError('Failed to fetch teams for league');
            }
        } catch (error) {
            setError('Error fetching teams: ' + error.message);
        } finally {
            setLoadingTeams(prev => ({ ...prev, [leagueId]: false }));
        }
    };

    // Toggle league expansion
    const toggleLeagueExpansion = (leagueId) => {
        const newExpanded = new Set(expandedLeagues);
        if (newExpanded.has(leagueId)) {
            newExpanded.delete(leagueId);
        } else {
            newExpanded.add(leagueId);
            // Fetch teams when expanding
            fetchLeagueTeams(leagueId);
        }
        setExpandedLeagues(newExpanded);
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
                
                // Refresh venues list to reflect changes (use current page and filters)
                await fetchVenues(venuePage);
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

    // League season year edit handlers
    const handleEditLeagueSeasonYear = (league) => {
        setSelectedLeague(league);
        setLeagueSeasonYear(league.seasonYear?.toString() || '');
        setLeagueEditDialog(true);
    };

    const handleSaveLeagueSeasonYear = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${getBackendUrl()}/api/admin/leagues/${selectedLeague.id}/season-year`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    seasonYear: parseInt(leagueSeasonYear)
                })
            });
            
            const data = await response.json();
            if (data.success) {
                setSuccess(`✅ Successfully updated season year for ${selectedLeague.name} to ${leagueSeasonYear}`);
                setLeagueEditDialog(false);
                setSelectedLeague(null);
                setLeagueSeasonYear('');
                
                // Refresh leagues list
                await fetchOnboardedLeagues(leaguePage);
            } else {
                setError('Failed to update season year: ' + (data.message || 'Unknown error'));
            }
        } catch (error) {
            setError('Error updating season year: ' + error.message);
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
                <Tabs value={currentTab} onChange={(e, newValue) => {
                    setCurrentTab(newValue);
                    // Fetch venues when switching to the Venue Issues tab
                    if (newValue === 1) {
                        fetchVenues();
                    }
                    // Fetch leagues when switching to the Onboarded Leagues tab
                    if (newValue === 5) {
                        fetchOnboardedLeagues();
                    }
                    // Fetch feedback when switching to the Feedback tab
                    if (newValue === 6) {
                        fetchFeedback();
                    }
                }}>
                    <Tab label="Unmapped Teams" icon={<WarningIcon />} />
                    <Tab label="Venue Issues" icon={<StadiumIcon />} />
                    <Tab label="Data Freshness" icon={<ScheduleIcon />} />
                    <Tab label="Subscriptions" icon={<GroupIcon />} />
                    <Tab label="League Onboarding" icon={<SportsSoccerIcon />} />
                    <Tab label="Onboarded Leagues" icon={<SportsSoccerIcon />} />
                    <Tab label="Feedback" icon={<ErrorIcon />} />
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
                        Venues
                        {venuePagination && ` (${venuePagination.total} total)`}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        View all venues. Venues are sorted alphabetically by name.
                    </Typography>

                    {/* Search and Filter Controls */}
                    <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                        <TextField
                            label="Search Venues"
                            value={venueSearch}
                            onChange={(e) => {
                                setVenueSearch(e.target.value);
                                setVenuePage(1); // Reset to first page on search
                            }}
                            placeholder="Search by name or city..."
                            size="small"
                            sx={{ minWidth: 250 }}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    fetchVenues();
                                }
                            }}
                        />
                        <TextField
                            label="Filter by Country"
                            value={venueCountryFilter}
                            onChange={(e) => {
                                setVenueCountryFilter(e.target.value);
                                setVenuePage(1); // Reset to first page on filter
                            }}
                            placeholder="e.g., England, Spain..."
                            size="small"
                            sx={{ minWidth: 200 }}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    fetchVenues();
                                }
                            }}
                        />
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>Filter by Issues</InputLabel>
                            <Select
                                value={venueHasIssuesFilter ? 'true' : 'false'}
                                label="Filter by Issues"
                                onChange={(e) => {
                                    setVenueHasIssuesFilter(e.target.value === 'true');
                                    setVenuePage(1);
                                }}
                            >
                                <MenuItem value="false">All Venues</MenuItem>
                                <MenuItem value="true">Venues with Issues</MenuItem>
                            </Select>
                        </FormControl>
                        <Button
                            variant="contained"
                            onClick={() => fetchVenues()}
                            disabled={venueLoading}
                            startIcon={venueLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                        >
                            {venueLoading ? 'Loading...' : 'Search'}
                        </Button>
                        {(venueSearch || venueCountryFilter || venueHasIssuesFilter) && (
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setVenueSearch('');
                                    setVenueCountryFilter('');
                                    setVenueHasIssuesFilter(false);
                                    setVenuePage(1);
                                    fetchVenues(1);
                                }}
                                startIcon={<ClearIcon />}
                            >
                                Clear Filters
                            </Button>
                        )}
                    </Box>

                    {/* Venues Table */}
                    {venueLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress />
                        </Box>
                    ) : venues.length === 0 ? (
                        <Alert severity="info">
                            No venues found. {venueSearch || venueCountryFilter || venueHasIssuesFilter ? 'Try adjusting your search filters.' : 'No venues in the database.'}
                        </Alert>
                    ) : (
                        <>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell><strong>Name</strong></TableCell>
                                            <TableCell><strong>City</strong></TableCell>
                                            <TableCell><strong>Country</strong></TableCell>
                                            <TableCell><strong>Coordinates</strong></TableCell>
                                            <TableCell><strong>Capacity</strong></TableCell>
                                            <TableCell><strong>Actions</strong></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {venues.map((venue) => (
                                            <TableRow key={venue._id}>
                                                <TableCell>{venue.name}</TableCell>
                                                <TableCell>{venue.city || 'N/A'}</TableCell>
                                                <TableCell>{venue.country || 'N/A'}</TableCell>
                                                <TableCell>
                                                    {venue.location?.coordinates ? 
                                                        `${venue.location.coordinates[1]}, ${venue.location.coordinates[0]}` : 
                                                        <Chip label="Missing" color="error" size="small" />
                                                    }
                                                </TableCell>
                                                <TableCell>
                                                    {venue.capacity ? venue.capacity.toLocaleString() : 'N/A'}
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

                            {/* Pagination */}
                            {venuePagination && venuePagination.pages > 1 && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 3, gap: 2 }}>
                                    <Button
                                        variant="outlined"
                                        disabled={venuePage === 1 || venueLoading}
                                        onClick={() => {
                                            const newPage = venuePage - 1;
                                            setVenuePage(newPage);
                                            fetchVenues(newPage);
                                        }}
                                    >
                                        Previous
                                    </Button>
                                    <Typography>
                                        Page {venuePage} of {venuePagination.pages} ({venuePagination.total} venues)
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        disabled={venuePage >= venuePagination.pages || venueLoading}
                                        onClick={() => {
                                            const newPage = venuePage + 1;
                                            setVenuePage(newPage);
                                            fetchVenues(newPage);
                                        }}
                                    >
                                        Next
                                    </Button>
                                </Box>
                            )}
                        </>
                    )}
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

                {/* League Onboarding Tab */}
                <TabPanel value={currentTab} index={4}>
                    <LeagueOnboardingWizard 
                        getAuthHeaders={getAuthHeaders}
                        onSuccess={() => {
                            setSuccess('League successfully onboarded!');
                            fetchStats();
                            fetchOnboardedLeagues(); // Refresh leagues list
                        }}
                        onError={(error) => setError(error)}
                    />
                </TabPanel>

                {/* Onboarded Leagues Tab */}
                <TabPanel value={currentTab} index={5}>
                    <Typography variant="h6" gutterBottom>
                        Onboarded Leagues
                        {leaguePagination && ` (${leaguePagination.total} total)`}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        View all leagues that have been onboarded to the system. Leagues are sorted alphabetically.
                    </Typography>

                    {/* Search and Filter Controls */}
                    <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                        <TextField
                            label="Search Leagues"
                            value={leagueSearch}
                            onChange={(e) => {
                                setLeagueSearch(e.target.value);
                                setLeaguePage(1); // Reset to first page on search
                            }}
                            placeholder="Search by name, short name, or ID..."
                            size="small"
                            sx={{ minWidth: 250 }}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    fetchOnboardedLeagues();
                                }
                            }}
                        />
                        <TextField
                            label="Filter by Country"
                            value={leagueCountryFilter}
                            onChange={(e) => {
                                setLeagueCountryFilter(e.target.value);
                                setLeaguePage(1); // Reset to first page on filter
                            }}
                            placeholder="e.g., England, Spain..."
                            size="small"
                            sx={{ minWidth: 200 }}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    fetchOnboardedLeagues();
                                }
                            }}
                        />
                        <Button
                            variant="contained"
                            onClick={fetchOnboardedLeagues}
                            disabled={leagueLoading}
                            startIcon={leagueLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                        >
                            {leagueLoading ? 'Loading...' : 'Search'}
                        </Button>
                        {(leagueSearch || leagueCountryFilter) && (
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setLeagueSearch('');
                                    setLeagueCountryFilter('');
                                    setLeaguePage(1);
                                    fetchOnboardedLeagues();
                                }}
                                startIcon={<ClearIcon />}
                            >
                                Clear Filters
                            </Button>
                        )}
                    </Box>

                    {/* Leagues Table */}
                    {leagueLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress />
                        </Box>
                    ) : onboardedLeagues.length === 0 ? (
                        <Alert severity="info">
                            No leagues found. {leagueSearch || leagueCountryFilter ? 'Try adjusting your search filters.' : 'Start by onboarding a league.'}
                        </Alert>
                    ) : (
                        <>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell></TableCell>
                                            <TableCell><strong>ID</strong></TableCell>
                                            <TableCell><strong>League Name</strong></TableCell>
                                            <TableCell><strong>Short Name</strong></TableCell>
                                            <TableCell><strong>Country</strong></TableCell>
                                            <TableCell><strong>Country Code</strong></TableCell>
                                            <TableCell><strong>Tier</strong></TableCell>
                                            <TableCell><strong>Season Year</strong></TableCell>
                                            <TableCell><strong>Status</strong></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {onboardedLeagues.map((league) => {
                                            const isExpanded = expandedLeagues.has(league.id);
                                            const teams = leagueTeams[league.id] || [];
                                            const isLoading = loadingTeams[league.id];
                                            
                                            return (
                                                <React.Fragment key={league.id}>
                                                    <TableRow 
                                                        sx={{ 
                                                            cursor: 'pointer',
                                                            '&:hover': { backgroundColor: 'action.hover' }
                                                        }}
                                                        onClick={() => toggleLeagueExpansion(league.id)}
                                                    >
                                                        <TableCell>
                                                            <IconButton 
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleLeagueExpansion(league.id);
                                                                }}
                                                            >
                                                                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                            </IconButton>
                                                        </TableCell>
                                                        <TableCell>{league.id}</TableCell>
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                {league.emblem && (
                                                                    <img 
                                                                        src={league.emblem} 
                                                                        alt={league.name}
                                                                        style={{ width: 24, height: 24, objectFit: 'contain' }}
                                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                                    />
                                                                )}
                                                                <strong>{league.name}</strong>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell>{league.shortName}</TableCell>
                                                        <TableCell>{league.country}</TableCell>
                                                        <TableCell>
                                                            <Chip label={league.countryCode} size="small" />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip 
                                                                label={`Tier ${league.tier}`} 
                                                                size="small" 
                                                                color={league.tier === 1 ? 'primary' : league.tier === 2 ? 'secondary' : 'default'}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                {league.seasonYear || 'N/A'}
                                                                <IconButton 
                                                                    size="small" 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleEditLeagueSeasonYear(league);
                                                                    }}
                                                                    sx={{ ml: 0.5 }}
                                                                >
                                                                    <EditIcon fontSize="small" />
                                                                </IconButton>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip 
                                                                label={league.isActive ? 'Active' : 'Inactive'} 
                                                                size="small" 
                                                                color={league.isActive ? 'success' : 'default'}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                    <TableRow>
                                                        <TableCell 
                                                            style={{ paddingBottom: 0, paddingTop: 0 }} 
                                                            colSpan={9}
                                                        >
                                                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                                                <Box sx={{ margin: 2 }}>
                                                                    <Typography variant="h6" gutterBottom>
                                                                        Teams ({teams.length})
                                                                    </Typography>
                                                                    {isLoading ? (
                                                                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                                                            <CircularProgress size={24} />
                                                                        </Box>
                                                                    ) : teams.length === 0 ? (
                                                                        <Alert severity="info">No teams found for this league.</Alert>
                                                                    ) : (
                                                                        <TableContainer>
                                                                            <Table size="small">
                                                                                <TableHead>
                                                                                    <TableRow>
                                                                                        <TableCell><strong>Team Name</strong></TableCell>
                                                                                        <TableCell><strong>City</strong></TableCell>
                                                                                        <TableCell><strong>Country</strong></TableCell>
                                                                                        <TableCell><strong>Venue</strong></TableCell>
                                                                                    </TableRow>
                                                                                </TableHead>
                                                                                <TableBody>
                                                                                    {teams.map((team) => (
                                                                                        <TableRow key={team.id}>
                                                                                            <TableCell>
                                                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                                                    {team.logo && (
                                                                                                        <img 
                                                                                                            src={team.logo} 
                                                                                                            alt={team.name}
                                                                                                            style={{ width: 20, height: 20, objectFit: 'contain' }}
                                                                                                            onError={(e) => { e.target.style.display = 'none'; }}
                                                                                                        />
                                                                                                    )}
                                                                                                    {team.name}
                                                                                                </Box>
                                                                                            </TableCell>
                                                                                            <TableCell>{team.city || 'N/A'}</TableCell>
                                                                                            <TableCell>{team.country || 'N/A'}</TableCell>
                                                                                            <TableCell>{team.venue?.name || 'N/A'}</TableCell>
                                                                                        </TableRow>
                                                                                    ))}
                                                                                </TableBody>
                                                                            </Table>
                                                                        </TableContainer>
                                                                    )}
                                                                </Box>
                                                            </Collapse>
                                                        </TableCell>
                                                    </TableRow>
                                                </React.Fragment>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {/* Pagination */}
                            {leaguePagination && leaguePagination.pages > 1 && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 3, gap: 2 }}>
                                    <Button
                                        variant="outlined"
                                        disabled={leaguePage === 1 || leagueLoading}
                                        onClick={() => {
                                            const newPage = leaguePage - 1;
                                            setLeaguePage(newPage);
                                            fetchOnboardedLeagues(newPage);
                                        }}
                                    >
                                        Previous
                                    </Button>
                                    <Typography>
                                        Page {leaguePage} of {leaguePagination.pages} ({leaguePagination.total} leagues)
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        disabled={leaguePage >= leaguePagination.pages || leagueLoading}
                                        onClick={() => {
                                            const newPage = leaguePage + 1;
                                            setLeaguePage(newPage);
                                            fetchOnboardedLeagues(newPage);
                                        }}
                                    >
                                        Next
                                    </Button>
                                </Box>
                            )}
                        </>
                    )}
                </TabPanel>

                {/* Feedback Tab */}
                <TabPanel value={currentTab} index={6}>
                    <Typography variant="h6" gutterBottom>
                        User Feedback
                        {feedbackPagination && ` (${feedbackPagination.total} total)`}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        View and manage user feedback, bug reports, feature requests, and ratings. Feedback is sorted chronologically (newest first).
                    </Typography>

                    {/* Search and Filter Controls */}
                    <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                        <TextField
                            label="Search Feedback"
                            value={feedbackSearch}
                            onChange={(e) => {
                                setFeedbackSearch(e.target.value);
                                setFeedbackPage(1);
                            }}
                            placeholder="Search by message, user email, or name..."
                            size="small"
                            sx={{ minWidth: 250 }}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    fetchFeedback();
                                }
                            }}
                        />
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>Filter by Type</InputLabel>
                            <Select
                                value={feedbackTypeFilter}
                                label="Filter by Type"
                                onChange={(e) => {
                                    setFeedbackTypeFilter(e.target.value);
                                    setFeedbackPage(1);
                                }}
                            >
                                <MenuItem value="">All Types</MenuItem>
                                <MenuItem value="bug">Bug Reports</MenuItem>
                                <MenuItem value="feature">Feature Requests</MenuItem>
                                <MenuItem value="general">General Feedback</MenuItem>
                                <MenuItem value="rating">Ratings</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel>Sort By</InputLabel>
                            <Select
                                value={feedbackSortBy}
                                label="Sort By"
                                onChange={(e) => {
                                    setFeedbackSortBy(e.target.value);
                                    fetchFeedback();
                                }}
                            >
                                <MenuItem value="created_at">Date</MenuItem>
                                <MenuItem value="type">Type</MenuItem>
                                <MenuItem value="userEmail">User Email</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <InputLabel>Order</InputLabel>
                            <Select
                                value={feedbackOrder}
                                label="Order"
                                onChange={(e) => {
                                    setFeedbackOrder(e.target.value);
                                    fetchFeedback();
                                }}
                            >
                                <MenuItem value="desc">Newest First</MenuItem>
                                <MenuItem value="asc">Oldest First</MenuItem>
                            </Select>
                        </FormControl>
                        <Button
                            variant="contained"
                            onClick={() => fetchFeedback()}
                            disabled={feedbackLoading}
                            startIcon={feedbackLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                        >
                            {feedbackLoading ? 'Loading...' : 'Search'}
                        </Button>
                        {(feedbackSearch || feedbackTypeFilter) && (
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setFeedbackSearch('');
                                    setFeedbackTypeFilter('');
                                    setFeedbackPage(1);
                                    fetchFeedback(1);
                                }}
                                startIcon={<ClearIcon />}
                            >
                                Clear Filters
                            </Button>
                        )}
                    </Box>

                    {/* Feedback Table */}
                    {feedbackLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress />
                        </Box>
                    ) : feedback.length === 0 ? (
                        <Alert severity="info">
                            No feedback found. {feedbackSearch || feedbackTypeFilter ? 'Try adjusting your search filters.' : 'No feedback has been submitted yet.'}
                        </Alert>
                    ) : (
                        <>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell><strong>Date</strong></TableCell>
                                            <TableCell><strong>Type</strong></TableCell>
                                            <TableCell><strong>User</strong></TableCell>
                                            <TableCell><strong>Message</strong></TableCell>
                                            <TableCell><strong>Status</strong></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {feedback.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    {new Date(item.createdAt).toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={item.type || 'general'} 
                                                        size="small" 
                                                        color={
                                                            item.type === 'bug' ? 'error' :
                                                            item.type === 'feature' ? 'primary' :
                                                            item.type === 'rating' ? 'success' : 'default'
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Box>
                                                        <Typography variant="body2">
                                                            {item.userName || 'Unknown'}
                                                        </Typography>
                                                        <Typography variant="caption" color="textSecondary">
                                                            {item.userEmail || 'No email'}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ maxWidth: 400 }}>
                                                        {item.message || 'No message'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={item.status || 'new'} 
                                                        size="small" 
                                                        color={item.status === 'resolved' ? 'success' : 'default'}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            {/* Pagination */}
                            {feedbackPagination && feedbackPagination.pages > 1 && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, gap: 1 }}>
                                    <Button
                                        disabled={feedbackPage === 1}
                                        onClick={() => {
                                            setFeedbackPage(feedbackPage - 1);
                                            fetchFeedback(feedbackPage - 1);
                                        }}
                                    >
                                        Previous
                                    </Button>
                                    <Typography sx={{ alignSelf: 'center', px: 2 }}>
                                        Page {feedbackPagination.page} of {feedbackPagination.pages}
                                    </Typography>
                                    <Button
                                        disabled={feedbackPage >= feedbackPagination.pages}
                                        onClick={() => {
                                            setFeedbackPage(feedbackPage + 1);
                                            fetchFeedback(feedbackPage + 1);
                                        }}
                                    >
                                        Next
                                    </Button>
                                </Box>
                            )}
                        </>
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

            {/* League Season Year Edit Dialog */}
            <Dialog 
                open={leagueEditDialog} 
                onClose={() => setLeagueEditDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Edit Season Year: {selectedLeague?.name}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Season Year"
                            value={leagueSeasonYear}
                            onChange={(e) => setLeagueSeasonYear(e.target.value)}
                            type="number"
                            required
                            fullWidth
                            inputProps={{ min: 2000, max: 2100 }}
                            helperText="The year the season starts (e.g., 2024 for 2024-2025 season)"
                        />
                        {leagueSeasonYear && (
                            <Alert severity="info">
                                Season will be set to: {leagueSeasonYear}-08-01 to {parseInt(leagueSeasonYear) + 1}-05-31
                            </Alert>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLeagueEditDialog(false)}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSaveLeagueSeasonYear}
                        variant="contained"
                        disabled={!leagueSeasonYear || loading || !/^\d{4}$/.test(leagueSeasonYear)}
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogActions>
            </Dialog>
                <Typography variant="h6" gutterBottom>
                    User Feedback
                    {feedbackPagination && ` (${feedbackPagination.total} total)`}
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    View and manage user feedback, bug reports, feature requests, and ratings. Feedback is sorted chronologically (newest first).
                </Typography>

                {/* Search and Filter Controls */}
                <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                    <TextField
                        label="Search Feedback"
                        value={feedbackSearch}
                        onChange={(e) => {
                            setFeedbackSearch(e.target.value);
                            setFeedbackPage(1);
                        }}
                        placeholder="Search by message, user email, or name..."
                        size="small"
                        sx={{ minWidth: 250 }}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                fetchFeedback();
                            }
                        }}
                    />
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>Filter by Type</InputLabel>
                        <Select
                            value={feedbackTypeFilter}
                            label="Filter by Type"
                            onChange={(e) => {
                                setFeedbackTypeFilter(e.target.value);
                                setFeedbackPage(1);
                            }}
                        >
                            <MenuItem value="">All Types</MenuItem>
                            <MenuItem value="bug">Bug Reports</MenuItem>
                            <MenuItem value="feature">Feature Requests</MenuItem>
                            <MenuItem value="general">General Feedback</MenuItem>
                            <MenuItem value="rating">Ratings</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>Sort By</InputLabel>
                        <Select
                            value={feedbackSortBy}
                            label="Sort By"
                            onChange={(e) => {
                                setFeedbackSortBy(e.target.value);
                                fetchFeedback();
                            }}
                        >
                            <MenuItem value="created_at">Date</MenuItem>
                            <MenuItem value="type">Type</MenuItem>
                            <MenuItem value="userEmail">User Email</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Order</InputLabel>
                        <Select
                            value={feedbackOrder}
                            label="Order"
                            onChange={(e) => {
                                setFeedbackOrder(e.target.value);
                                fetchFeedback();
                            }}
                        >
                            <MenuItem value="desc">Newest First</MenuItem>
                            <MenuItem value="asc">Oldest First</MenuItem>
                        </Select>
                    </FormControl>
                    <Button
                        variant="contained"
                        onClick={() => fetchFeedback()}
                        disabled={feedbackLoading}
                        startIcon={feedbackLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                    >
                        {feedbackLoading ? 'Loading...' : 'Search'}
                    </Button>
                    {(feedbackSearch || feedbackTypeFilter) && (
                        <Button
                            variant="outlined"
                            onClick={() => {
                                setFeedbackSearch('');
                                setFeedbackTypeFilter('');
                                setFeedbackPage(1);
                                fetchFeedback(1);
                            }}
                            startIcon={<ClearIcon />}
                        >
                            Clear Filters
                        </Button>
                    )}
                </Box>

                {/* Feedback Table */}
                {feedbackLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                ) : feedback.length === 0 ? (
                    <Alert severity="info">
                        No feedback found. {feedbackSearch || feedbackTypeFilter ? 'Try adjusting your search filters.' : 'No feedback has been submitted yet.'}
                    </Alert>
                ) : (
                    <>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell><strong>Date</strong></TableCell>
                                        <TableCell><strong>Type</strong></TableCell>
                                        <TableCell><strong>User</strong></TableCell>
                                        <TableCell><strong>Message</strong></TableCell>
                                        <TableCell><strong>Status</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {feedback.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                {new Date(item.createdAt).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <Chip 
                                                    label={item.type || 'general'} 
                                                    size="small" 
                                                    color={
                                                        item.type === 'bug' ? 'error' :
                                                        item.type === 'feature' ? 'primary' :
                                                        item.type === 'rating' ? 'success' : 'default'
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Box>
                                                    <Typography variant="body2">
                                                        {item.userName || 'Unknown'}
                                                    </Typography>
                                                    <Typography variant="caption" color="textSecondary">
                                                        {item.userEmail || 'No email'}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ maxWidth: 400 }}>
                                                    {item.message || 'No message'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip 
                                                    label={item.status || 'new'} 
                                                    size="small" 
                                                    color={item.status === 'resolved' ? 'success' : 'default'}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {/* Pagination */}
                        {feedbackPagination && feedbackPagination.pages > 1 && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, gap: 1 }}>
                                <Button
                                    disabled={feedbackPage === 1}
                                    onClick={() => {
                                        setFeedbackPage(feedbackPage - 1);
                                        fetchFeedback(feedbackPage - 1);
                                    }}
                                >
                                    Previous
                                </Button>
                                <Typography sx={{ alignSelf: 'center', px: 2 }}>
                                    Page {feedbackPagination.page} of {feedbackPagination.pages}
                                </Typography>
                                <Button
                                    disabled={feedbackPage >= feedbackPagination.pages}
                                    onClick={() => {
                                        setFeedbackPage(feedbackPage + 1);
                                        fetchFeedback(feedbackPage + 1);
                                    }}
                                >
                                    Next
                                </Button>
                            </Box>
                        )}
                    </>
                )}
            </TabPanel>
        </Box>
    );
};

export default AdminDashboard; 