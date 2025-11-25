const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { WorkOS } = require('@workos-inc/node');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const subscriptionService = require('../services/subscriptionService');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Initialize WorkOS client lazily (only when needed)
// This prevents the server from crashing if WorkOS keys are not set
let workos = null;
const getWorkOSClient = () => {
    if (!workos) {
        if (!process.env.WORKOS_API_KEY) {
            throw new Error('WORKOS_API_KEY is not configured. WorkOS features are disabled.');
        }
        workos = new WorkOS(process.env.WORKOS_API_KEY, {
            clientId: process.env.WORKOS_CLIENT_ID,
        });
    }
    return workos;
};

// Check if WorkOS is configured (for conditional feature enabling)
const isWorkOSConfigured = () => {
    return !!(process.env.WORKOS_API_KEY && process.env.WORKOS_CLIENT_ID);
};

// Register a new user
router.post('/register', [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errors.array()
            });
        }

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
router.post('/login', [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errors.array()
            });
        }

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
        if (!isWorkOSConfigured()) {
            return res.status(503).json({ error: 'WorkOS is not configured. Please configure WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.' });
        }

        const redirectUri = process.env.WORKOS_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/workos/callback`;
        const workosClient = getWorkOSClient();
        
        const authorizationUrl = workosClient.userManagement.getAuthorizationUrl({
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
        if (!isWorkOSConfigured()) {
            return res.status(503).json({ error: 'WorkOS is not configured. Please configure WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.' });
        }

        const { code } = req.query;

        if (!code) {
            return res.status(400).json({ error: 'No authorization code provided' });
        }

        const workosClient = getWorkOSClient();

        // Exchange code for user
        const { user: workosUser } = await workosClient.userManagement.authenticateWithCode({
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

// Password Reset Routes

// Request password reset (for local users)
router.post('/forgot-password', [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address')
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { email } = req.body;

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        
        // For security, always return success even if user doesn't exist
        // This prevents email enumeration attacks
        
        if (!user) {
            return res.json({ 
                message: 'If an account with that email exists, a password reset link has been sent.',
                // In production, you might want to return this only for existing users
                // but for security, we return this message regardless
            });
        }

        // Check if user is a WorkOS user (they should use WorkOS password reset)
        if (user.authProvider === 'workos' || user.authProvider === 'google' || user.workosUserId) {
            return res.json({
                message: 'This account uses social login. Please use the password reset option in the login page or contact Google support if you need to reset your Google password.',
                useWorkOS: true
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        await user.save({ validateBeforeSave: false });

        // In production, send email with reset link
        // For now, we'll log it and return instructions
        const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
        
        console.log('Password reset link:', resetUrl);
        console.log('Email:', user.email);
        
        // TODO: Integrate email service (nodemailer, SendGrid, etc.)
        // await sendPasswordResetEmail(user.email, resetUrl);

        res.json({
            message: 'If an account with that email exists, a password reset link has been sent.',
            // In development, include the reset token for testing
            ...(process.env.NODE_ENV !== 'production' && { 
                resetToken, 
                resetUrl,
                note: 'Development mode: Reset token shown for testing'
            })
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
});

// Reset password (for local users)
router.post('/reset-password/:token', [
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { token } = req.params;
        const { password } = req.body;

        // Hash the token to compare with stored hash
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Check if user is a WorkOS user
        if (user.authProvider === 'workos' || user.authProvider === 'google' || user.workosUserId) {
            return res.status(400).json({ 
                error: 'This account uses social login. Password cannot be reset here.' 
            });
        }

        // Update password
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        user.authProvider = 'local'; // Ensure it's marked as local auth
        
        await user.save();

        // Generate new token for automatic login
        const authToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Password has been reset successfully',
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                profile: user.profile,
                preferences: user.preferences,
                subscription: user.subscription
            },
            token: authToken
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Get WorkOS password reset URL (for WorkOS users)
router.get('/workos/forgot-password', async (req, res) => {
    try {
        if (!isWorkOSConfigured()) {
            return res.status(503).json({ error: 'WorkOS is not configured. Please configure WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.' });
        }

        // WorkOS handles password reset through their hosted UI
        // We redirect to their login page with a password reset parameter
        const redirectUri = process.env.WORKOS_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/workos/callback`;
        const workosClient = getWorkOSClient();
        
        // WorkOS AuthKit has a built-in "Forgot Password" link in their hosted UI
        // We can redirect to the login page which includes this option
        const authorizationUrl = workosClient.userManagement.getAuthorizationUrl({
            provider: 'authkit',
            redirectUri: redirectUri,
            clientId: process.env.WORKOS_CLIENT_ID,
        });

        res.json({ 
            message: 'Redirect to WorkOS login page to use password reset',
            url: authorizationUrl
        });
    } catch (error) {
        console.error('WorkOS forgot password error:', error);
        res.status(500).json({ error: 'Failed to initiate WorkOS password reset' });
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