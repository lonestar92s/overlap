const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../../src/models/User');

const EVAL_USER_ID = '507f1f77bcf86cd799439011';
const EVAL_EMAIL = 'nl-eval-bot@internal.local';

async function ensureNlSearchEvalUser() {
    if (mongoose.connection.readyState === 0) {
        return null;
    }

    let user = await User.findById(EVAL_USER_ID);
    if (!user) {
        user = new User({
            _id: EVAL_USER_ID,
            email: EVAL_EMAIL,
            role: 'admin',
            authProvider: 'workos'
        });
        await user.save();
    }
    return user;
}

function getNlSearchAuthHeader(userId = EVAL_USER_ID) {
    if (process.env.EVAL_AUTH_TOKEN) {
        return `Bearer ${process.env.EVAL_AUTH_TOKEN}`;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is required for NL search auth headers');
    }

    const token = jwt.sign({ userId }, secret, { expiresIn: '1h' });
    return `Bearer ${token}`;
}

module.exports = {
    EVAL_USER_ID,
    ensureNlSearchEvalUser,
    getNlSearchAuthHeader
};
