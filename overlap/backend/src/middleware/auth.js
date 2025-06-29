const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new Error();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded.userId });

        if (!user) {
            throw new Error();
        }

        req.token = token;
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Please authenticate.' });
    }
};

// Admin middleware - requires authentication + admin role
const adminAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new Error('No token provided');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded.userId });

        if (!user) {
            throw new Error('User not found');
        }

        if (user.role !== 'admin') {
            return res.status(403).json({ 
                error: 'Access denied. Admin privileges required.' 
            });
        }

        req.token = token;
        req.user = user;
        next();
    } catch (error) {
        if (error.message === 'User not found' || error.message === 'No token provided') {
            res.status(401).json({ error: 'Please authenticate.' });
        } else {
            res.status(401).json({ error: 'Please authenticate.' });
        }
    }
};

// Optional authentication - doesn't require token but populates user if valid token provided
const authenticateToken = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded.userId });

        if (!user) {
            req.user = null;
            return next();
        }

        req.token = token;
        req.user = { id: user._id, ...user.toObject() };
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

module.exports = { auth, adminAuth, authenticateToken };
