const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const transportationRoutes = require('./routes/transportation');
const matchesRoutes = require('./routes/matches');
const searchRoutes = require('./routes/search');
const authRoutes = require('./routes/auth');
const preferencesRoutes = require('./routes/preferences');
const teamsRoutes = require('./routes/teams');
const attendedMatchesRoutes = require('./routes/attendedMatches');
const memoriesRoutes = require('./routes/memories');
const tripsRoutes = require('./routes/trips');
const leaguesRoutes = require('./routes/leagues');
const surveysRoutes = require('./routes/surveys');
const adminRouter = require('./routes/admin');


// Configure dotenv with explicit path
const envPath = path.resolve(__dirname, '../.env');

dotenv.config({ path: envPath });



const app = express();

// Configure CORS with more detailed options
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Allow localhost and local network IPs
        if (origin.match(/^http:\/\/localhost:\d+$/) || 
            origin.match(/^http:\/\/192\.168\.\d+\.\d+:\d+$/) ||
            origin.match(/^http:\/\/10\.\d+\.\d+\.\d+:\d+$/) ||
            origin.match(/^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/)) {
            return callback(null, true);
        }
        
        // Allow Expo tunnel domains
        if (origin.match(/^https:\/\/.*\.exp\.direct$/) ||
            origin.match(/^https:\/\/.*\.exp\.dev$/)) {
            return callback(null, true);
        }
        
        // Reject other origins
        callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token'],
    credentials: true
}));

app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Connect to MongoDB
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
    .then(() => {})
    .catch((error) => {});
} else {
    // MongoDB URI not found - auth features will be disabled
}

// Mount routes
app.use('/api/matches', matchesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/leagues', leaguesRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/matches/attended', attendedMatchesRoutes);
app.use('/api/memories', memoriesRoutes);
app.use('/api/admin', adminRouter);
app.use('/api/search', searchRoutes);
app.use('/api/transportation', transportationRoutes);

// Test endpoint to check environment variables
app.get('/api/debug/env', (req, res) => {
    res.json({
        LOCATIONIQ_API_KEY: process.env.LOCATIONIQ_API_KEY ? 'SET' : 'MISSING',
        MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'MISSING',
        API_SPORTS_KEY: process.env.API_SPORTS_KEY ? 'SET' : 'MISSING',
        NODE_ENV: process.env.NODE_ENV,
        allEnvVars: Object.keys(process.env).filter(key => key.includes('LOCATION'))
    });
});

// Set up unmapped team logging after routes are loaded
const teamService = require('./services/teamService');
teamService.setUnmappedLogger(adminRouter.logUnmappedTeam);

const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
    // Server is running
}); 