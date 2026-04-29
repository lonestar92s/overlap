const mongoose = require('mongoose');
require('dotenv').config();
async function testNLPDebug() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        // Test the natural language search endpoint directly
        const { processNaturalLanguageQuery } = require('./src/routes/search');
        const result = await processNaturalLanguageQuery('Arsenal vs Chelsea matches in London next month');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}
testNLPDebug();
