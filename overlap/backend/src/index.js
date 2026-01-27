require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const preferencesRoutes = require('./routes/preferences');
const app = express();
// Middleware
app.use(cors());
app.use(express.json());
// Connect to MongoDB
const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI;
if (mongoUri) {
    // Log which MongoDB we're connecting to (but hide credentials)
    const safeUri = mongoUri.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://***:***@');
    const isRailway = mongoUri.includes('railway') || mongoUri.includes('rlwy.net') || mongoUri.includes('proxy.rlwy.net');
    const isLocal = mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1');
    mongoose.connect(mongoUri)
    .then(() => {
        const dbName = mongoose.connection.db?.databaseName || 'unknown';
        // Warn if connecting to local in production
        if (isLocal && process.env.NODE_ENV === 'production') {
            console.error('⚠️ WARNING: Connecting to LOCAL MongoDB in PRODUCTION! This should not happen.');
        }
    })
    .catch((error) => console.error('MongoDB connection error:', error));
} else {
    console.error('❌ MongoDB URI not found - MONGODB_URI or MONGO_URL environment variable must be set');
}
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/preferences', preferencesRoutes);
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
}); 