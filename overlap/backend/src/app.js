const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // Security headers middleware
const rateLimit = require('express-rate-limit');
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
const attendanceRoutes = require('./routes/attendance');
const memoriesRoutes = require('./routes/memories');
const tripsRoutes = require('./routes/trips');
const leaguesRoutes = require('./routes/leagues');
const venuesRoutes = require('./routes/venues');
const recommendationsRoutes = require('./routes/recommendations');
const adminRouter = require('./routes/admin');


// Configure dotenv with explicit path
const envPath = path.resolve(__dirname, '../.env');

dotenv.config({ path: envPath });



const app = express();

// Security headers middleware (must be before other middleware)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    },
    crossOriginEmbedderPolicy: false, // Allow external resources if needed
    crossOriginResourcePolicy: { policy: "cross-origin" } // Allow CORS resources
}));

// Rate limiting configuration
// General API rate limit - 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter rate limit for auth endpoints - 5 attempts per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes
    message: { error: 'Too many login attempts, please try again later.' },
    skipSuccessfulRequests: true, // Don't count successful requests
    standardHeaders: true,
    legacyHeaders: false,
});

// Configure CORS with more detailed options
app.use(cors({
    origin: function (origin, callback) {
        // In production, be more strict about no-origin requests
        if (!origin) {
            // Allow no-origin in development (for testing)
            if (process.env.NODE_ENV !== 'production') {
                return callback(null, true);
            }
            // In production, allow no-origin but log it (mobile apps don't send origin)
            // This is acceptable for mobile apps, but we should validate via other means
            return callback(null, true);
        }
        
        // Allow localhost and local network IPs in development
        if (process.env.NODE_ENV !== 'production') {
            if (origin.match(/^http:\/\/localhost:\d+$/) || 
                origin.match(/^http:\/\/192\.168\.\d+\.\d+:\d+$/) ||
                origin.match(/^http:\/\/10\.\d+\.\d+\.\d+:\d+$/) ||
                origin.match(/^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+:\d+$/)) {
                return callback(null, true);
            }
        }
        
        // Allow Expo tunnel domains
        if (origin.match(/^https:\/\/.*\.exp\.direct$/) ||
            origin.match(/^https:\/\/.*\.exp\.dev$/)) {
            return callback(null, true);
        }
        
        // In production, check allowed origins from environment variable
        if (process.env.NODE_ENV === 'production') {
            const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
        }
        
        // Reject other origins
        callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' })); // Limit request body size
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Limit URL-encoded body size

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// Log security headers in development (for verification)
// Note: Headers are set by Helmet before response is sent
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        res.on('finish', () => {
            // Log security headers after response is sent
            if (req.path.startsWith('/api/')) {
                const securityHeaders = {
                    'x-content-type-options': res.getHeader('x-content-type-options'),
                    'x-frame-options': res.getHeader('x-frame-options'),
                    'x-xss-protection': res.getHeader('x-xss-protection'),
                    'strict-transport-security': res.getHeader('strict-transport-security'),
                    'content-security-policy': res.getHeader('content-security-policy') ? 'Set' : 'Not set',
                };
                console.log(`🔒 [${req.method} ${req.path}] Security Headers:`, securityHeaders);
            }
        });
        next();
    });
}

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Connect to MongoDB
const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI;
if (mongoUri) {
    // Log which MongoDB we're connecting to (but hide credentials)
    const safeUri = mongoUri.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://***:***@');
    const isRailway = mongoUri.includes('railway') || mongoUri.includes('rlwy.net') || mongoUri.includes('proxy.rlwy.net');
    const isLocal = mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1');
    
    console.log(`🔌 Connecting to MongoDB: ${isRailway ? '✅ Railway' : isLocal ? '⚠️ LOCAL' : '✅ Remote'} - ${safeUri}`);
    
    mongoose.connect(mongoUri)
    .then(() => {
        const dbName = mongoose.connection.db.databaseName;
        console.log(`✅ Connected to MongoDB database: ${dbName}`);
        
        // Warn if connecting to local in production
        if (isLocal && process.env.NODE_ENV === 'production') {
            console.error('⚠️ WARNING: Connecting to LOCAL MongoDB in PRODUCTION! This should not happen.');
        }
    })
    .catch((error) => {
        console.error('❌ MongoDB connection error:', error.message);
    });
} else {
    console.error('❌ MongoDB URI not found - MONGODB_URI or MONGO_URL environment variable must be set');
    console.error('⚠️ Auth and database features will be disabled');
}

// Mount routes
app.use('/api/matches', matchesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/leagues', leaguesRoutes);
app.use('/api/venues', venuesRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/matches/attended', attendedMatchesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/memories', memoriesRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/admin', adminRouter);
app.use('/api/search', searchRoutes);
app.use('/api/transportation', transportationRoutes);

// Test endpoint to check environment variables (only in development)
if (process.env.NODE_ENV !== 'production') {
    app.get('/api/debug/env', (req, res) => {
        res.json({
            NODE_ENV: process.env.NODE_ENV,
            // Don't expose which keys are set in production
            message: 'Debug endpoint - only available in development'
        });
    });
}

// Set up unmapped team logging after routes are loaded
const teamService = require('./services/teamService');
teamService.setUnmappedLogger(adminRouter.logUnmappedTeam);

const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
    // Server is running
}); 