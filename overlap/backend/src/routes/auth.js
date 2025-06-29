const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const subscriptionService = require('../services/subscriptionService');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

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

// ADMIN ROUTES

// Get all users (admin only)
router.get('/admin/users', adminAuth, async (req, res) => {
    try {
        const users = await User.find({})
            .select('-password')
            .sort({ createdAt: -1 });
        
        res.json({
            success: true,
            users: users.map(user => ({
                id: user._id,
                email: user.email,
                role: user.role,
                profile: user.profile,
                createdAt: user.createdAt
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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