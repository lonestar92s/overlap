const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const transportationRoutes = require('./routes/transportation');
const matchesRoutes = require('./routes/matches');

// Configure dotenv with explicit path
const envPath = path.resolve(__dirname, '../.env');
console.log('Loading .env file from:', envPath);
dotenv.config({ path: envPath });

// Log environment status
console.log('Environment variables loaded:', {
    port: process.env.PORT || '3001 (default)',
    googleApiKey: process.env.GOOGLE_API_KEY ? 'Present' : 'Missing',
    nodeEnv: process.env.NODE_ENV || 'not set'
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
app.use('/v4', matchesRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 