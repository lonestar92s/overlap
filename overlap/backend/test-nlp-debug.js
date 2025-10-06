const mongoose = require('mongoose');
require('dotenv').config();

async function testNLPDebug() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        console.log('Connected to MongoDB');

        // Test the natural language search endpoint directly
        const { processNaturalLanguageQuery } = require('./src/routes/search');
        
        console.log('Testing natural language query...');
        const result = await processNaturalLanguageQuery('Arsenal vs Chelsea matches in London next month');
        console.log('Result:', JSON.stringify(result, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testNLPDebug();
