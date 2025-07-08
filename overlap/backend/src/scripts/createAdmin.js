require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const createAdminUser = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Create admin user
        const adminUser = new User({
            email: 'admin@example.com',
            password: 'admin123456',
            role: 'admin'
        });

        await adminUser.save();
        console.log('Admin user created');

        // Generate JWT token
        const token = jwt.sign(
            { userId: adminUser._id },
            process.env.JWT_SECRET
        );

        console.log('Use this token in the Authorization header:');
        console.log('Bearer', token);

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

createAdminUser(); 