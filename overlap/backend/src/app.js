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
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token'],
    credentials: true
}));

app.use(express.json());

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

// Use routes
app.use('/api', transportationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/v4', matchesRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 