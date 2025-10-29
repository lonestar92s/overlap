const express = require('express');
const jwt = require('jsonwebtoken');
const { WorkOS } = require('@workos-inc/node');
const User = require('../models/User');
const subscriptionService = require('../services/subscriptionService');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Initialize WorkOS client
const workos = new WorkOS(process.env.WORKOS_API_KEY, {
    clientId: process.env.WORKOS_CLIENT_ID,
});

// Register a new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, profile, subscriptionTier } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Validate subscription tier
        const validTiers = ['freemium', 'pro', 'planner'];
        const selectedTier = subscriptionTier && validTiers.includes(subscriptionTier) ? subscriptionTier : 'freemium';

        // Create new user
        const user = new User({
            email,
            password,
            profile: profile || {},
            preferences: {
                defaultLocation: {
                    city: '',
                    country: ''
                },
                favoriteTeams: [],
                favoriteLeagues: [],
                defaultSearchRadius: 100,
                currency: 'USD',
                notifications: {
                    email: true,
                    matchReminders: false,
                    priceAlerts: false
                }
            }
        });

        // Set subscription tier using the service
        subscriptionService.updateUserTier(user, selectedTier);

        await user.save();

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                profile: user.profile,
                preferences: user.preferences,
                subscription: user.subscription
            },
            token
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user and include password for comparison
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                profile: user.profile,
                preferences: user.preferences,
                subscription: user.subscription
            },
            token
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get current user
router.get('/me', auth, async (req, res) => {
    try {
        res.json({
            user: {
                id: req.user._id,
                email: req.user.email,
                username: req.user.username,
                role: req.user.role,
                profile: req.user.profile,
                preferences: req.user.preferences,
                subscription: req.user.subscription
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Logout user (optional - client-side token removal)
router.post('/logout', auth, async (req, res) => {
    try {
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// WorkOS Authentication Routes

// Initiate WorkOS login (redirects to WorkOS hosted UI)
router.get('/workos/login', async (req, res) => {
    try {
        const redirectUri = process.env.WORKOS_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/workos/callback`;
        
        const authorizationUrl = workos.userManagement.getAuthorizationUrl({
            provider: 'authkit',
            redirectUri: redirectUri,
            clientId: process.env.WORKOS_CLIENT_ID,
        });

        res.redirect(authorizationUrl);
    } catch (error) {
        console.error('WorkOS login error:', error);
        res.status(500).json({ error: 'Failed to initiate WorkOS login' });
    }
});

// Handle WorkOS callback
router.get('/workos/callback', async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).json({ error: 'No authorization code provided' });
        }

        // Exchange code for user
        const { user: workosUser } = await workos.userManagement.authenticateWithCode({
            code,
            clientId: process.env.WORKOS_CLIENT_ID,
        });

        // Check if user exists by WorkOS ID or email
        let user = await User.findOne({
            $or: [
                { workosUserId: workosUser.id },
                { email: workosUser.email }
            ]
        });

        // Extract username from WorkOS user (firstName + lastName or email prefix)
        let username = workosUser.email.split('@')[0];
        if (workosUser.firstName && workosUser.lastName) {
            username = `${workosUser.firstName}${workosUser.lastName}`.toLowerCase().replace(/\s+/g, '');
        }

        if (user) {
            // Update existing user with WorkOS info
            user.workosUserId = workosUser.id;
            user.authProvider = 'workos';
            if (!user.username && username) {
                user.username = username;
            }
            if (workosUser.firstName) user.profile.firstName = workosUser.firstName;
            if (workosUser.lastName) user.profile.lastName = workosUser.lastName;
            if (workosUser.profilePictureUrl) user.profile.avatar = workosUser.profilePictureUrl;
            
            await user.save();
        } else {
            // Create new user
            const newUser = new User({
                email: workosUser.email,
                username: username,
                workosUserId: workosUser.id,
                authProvider: 'workos',
                profile: {
                    firstName: workosUser.firstName || '',
                    lastName: workosUser.lastName || '',
                    avatar: workosUser.profilePictureUrl || ''
                },
                preferences: {
                    defaultLocation: {
                        city: '',
                        country: ''
                    },
                    favoriteTeams: [],
                    favoriteLeagues: [],
                    defaultSearchRadius: 100,
                    currency: 'USD',
                    notifications: {
                        email: true,
                        matchReminders: false,
                        priceAlerts: false
                    }
                }
            });

            // Set default subscription tier
            subscriptionService.updateUserTier(newUser, 'freemium');
            await newUser.save();
            user = newUser;
        }

        // Generate JWT token (matching your existing auth system)
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // For React Native, we'll return JSON with token
        // The mobile app will handle the redirect differently
        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                profile: user.profile,
                preferences: user.preferences,
                subscription: user.subscription
            },
            token
        });
    } catch (error) {
        console.error('WorkOS callback error:', error);
        res.status(500).json({ error: 'Failed to authenticate with WorkOS' });
    }
});

// WorkOS logout
router.get('/workos/logout', auth, async (req, res) => {
    try {
        // WorkOS logout handled client-side
        // This endpoint just validates and clears local session
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADMIN ROUTES

// Promote user to admin (admin only)
router.post('/admin/promote/:userId', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.role === 'admin') {
            return res.status(400).json({ error: 'User is already an admin' });
        }
        
        user.role = 'admin';
        await user.save();
        
        res.json({
            success: true,
            message: `${user.email} has been promoted to admin`,
            user: {
                id: user._id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Demote admin to user (admin only)
router.post('/admin/demote/:userId', adminAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Prevent self-demotion
        if (userId === req.user._id.toString()) {
            return res.status(400).json({ error: 'Cannot demote yourself' });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.role === 'user') {
            return res.status(400).json({ error: 'User is already a regular user' });
        }
        
        user.role = 'user';
        await user.save();
        
        res.json({
            success: true,
            message: `${user.email} has been demoted to regular user`,
            user: {
                id: user._id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 