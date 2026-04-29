const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const VenueService = require('../services/venueService');
const TEST_CASES = [
    { name: 'Fratton Park', city: 'Portsmouth' },
    { name: 'Old Trafford', city: 'Manchester' },
    { name: 'Emirates Stadium', city: 'London' },
    { name: 'Anfield', city: 'Liverpool' },
    { name: 'St. James\' Park', city: 'Newcastle upon Tyne' },
    { name: 'The Valley', city: 'London' },
    { name: 'Adams Park', city: 'High Wycombe' },
    { name: 'Memorial Stadium', city: 'Bristol' },
    { name: 'LNER Stadium', city: 'Lincoln' },
    { name: 'Pirelli Stadium', city: 'Burton upon Trent' }
];
async function analyzeVenueLookup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/overlap');
        const venueService = new VenueService();
        // First check what's in our database
        const allVenues = await Venue.find({});
        // Test each venue lookup
        for (const testCase of TEST_CASES) {
            // Check direct database queries
            const exactMatch = await Venue.findOne({ name: testCase.name });
            const caseInsensitive = await Venue.findOne({ 
                name: { $regex: new RegExp(`^${testCase.name}$`, 'i') } 
            });
            const cityMatch = await Venue.findOne({ 
                city: testCase.city 
            });
            // Test venue service lookup
            const venueResult = await venueService.getVenueByName(testCase.name, testCase.city);
            if (venueResult) {
                console.log({
                    name: venueResult.name,
                    city: venueResult.city,
                    coordinates: venueResult.coordinates
                });
            }
        }
        // Analyze potential issues
        const venuesWithoutCoords = allVenues.filter(v => !v.location?.coordinates);
        if (venuesWithoutCoords.length > 0) {
            venuesWithoutCoords.forEach(v => console.log(`  * ${v.name} (${v.city})`));
        }
        const venuesWithoutCity = allVenues.filter(v => !v.city);
        if (venuesWithoutCity.length > 0) {
            venuesWithoutCity.forEach(v => console.log(`  * ${v.name}`));
        }
        const duplicateNames = allVenues.reduce((acc, venue) => {
            const normalized = venue.name.toLowerCase();
            if (!acc[normalized]) acc[normalized] = [];
            acc[normalized].push(venue);
            return acc;
        }, {});
        const duplicates = Object.entries(duplicateNames)
            .filter(([_, venues]) => venues.length > 1);
        if (duplicates.length > 0) {
            duplicates.forEach(([name, venues]) => {
                venues.forEach(v => console.log(`    - ${v.name} (${v.city})`));
            });
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}
analyzeVenueLookup(); 