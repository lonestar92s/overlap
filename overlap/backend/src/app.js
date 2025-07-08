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
const tripsRoutes = require('./routes/trips');
const leaguesRoutes = require('./routes/leagues');
const adminRouter = require('./routes/admin');

// Configure dotenv with explicit path
const envPath = path.resolve(__dirname, '../.env');
console.log('Loading .env file from:', envPath);
dotenv.config({ path: envPath });

// Log environment status
console.log('Environment check:', {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    rapidApiKey: process.env.RAPIDAPI_KEY ? 'Present' : 'Missing',
    envPath: envPath,
    envFileExists: require('fs').existsSync(envPath)
});

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
    mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch((error) => console.error('❌ MongoDB connection error:', error));
} else {
    console.log('⚠️  MONGODB_URI not found - auth features will be disabled');
}

// Mount routes
app.use('/api/matches', matchesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/leagues', leaguesRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/attended-matches', attendedMatchesRoutes);
app.use('/api/admin', adminRouter);
app.use('/api/search', searchRoutes);
app.use('/api/transportation', transportationRoutes);

// Set up unmapped team logging after routes are loaded
const teamService = require('./services/teamService');
teamService.setUnmappedLogger(adminRouter.logUnmappedTeam);

const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT} and accessible from all network interfaces`);
    console.log(`Local access: http://localhost:${PORT}`);
    console.log(`Network access: http://[YOUR-IP-ADDRESS]:${PORT}`);
}); 