const mongoose = require('mongoose');
const Venue = require('../models/Venue');

async function checkVenue() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        console.log('Connected to MongoDB');

        // Try exact match
        const exactMatch = await Venue.findOne({ name: 'Fratton Park' });
        console.log('\nExact match search:');
        console.log(exactMatch || 'No exact match found');

        // Try case-insensitive match
        const caseInsensitive = await Venue.findOne({ 
            name: { $regex: new RegExp('^Fratton Park$', 'i') } 
        });
        console.log('\nCase-insensitive search:');
        console.log(caseInsensitive || 'No case-insensitive match found');

        // Try partial match
        const partialMatch = await Venue.findOne({ 
            name: { $regex: new RegExp('Fratton', 'i') } 
        });
        console.log('\nPartial match search:');
        console.log(partialMatch || 'No partial match found');

        // List all venues in Portsmouth
        const portsmouthVenues = await Venue.find({ 
            city: { $regex: new RegExp('Portsmouth', 'i') } 
        });
        console.log('\nAll venues in Portsmouth:');
        console.log(portsmouthVenues);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDatabase connection closed');
    }
}

checkVenue(); 