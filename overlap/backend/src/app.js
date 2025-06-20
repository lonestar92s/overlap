const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const transportationRoutes = require('./routes/transportation');
const matchesRoutes = require('./routes/matches');
const searchRoutes = require('./routes/search');

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

// Use routes
app.use('/api', transportationRoutes);
app.use('/api/search', searchRoutes);
app.use('/v4', matchesRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 