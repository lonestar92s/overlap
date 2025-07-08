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
        console.log('Connected to MongoDB\n');

        const venueService = new VenueService();
        
        // First check what's in our database
        const allVenues = await Venue.find({});
        console.log(`Total venues in database: ${allVenues.length}\n`);

        // Test each venue lookup
        console.log('Testing venue lookups...\n');
        for (const testCase of TEST_CASES) {
            console.log(`Testing venue: ${testCase.name} (${testCase.city})`);
            
            // Check direct database queries
            const exactMatch = await Venue.findOne({ name: testCase.name });
            const caseInsensitive = await Venue.findOne({ 
                name: { $regex: new RegExp(`^${testCase.name}$`, 'i') } 
            });
            const cityMatch = await Venue.findOne({ 
                city: testCase.city 
            });

            console.log('Database queries:');
            console.log('- Exact match:', exactMatch ? '✅' : '❌');
            console.log('- Case insensitive:', caseInsensitive ? '✅' : '❌');
            console.log('- City match:', cityMatch ? '✅' : '❌');

            // Test venue service lookup
            const venueResult = await venueService.getVenueByName(testCase.name, testCase.city);
            console.log('Venue service lookup:', venueResult ? '✅' : '❌');
            
            if (venueResult) {
                console.log('Found venue:', {
                    name: venueResult.name,
                    city: venueResult.city,
                    coordinates: venueResult.coordinates
                });
            }
            
            console.log('\n-------------------\n');
        }

        // Analyze potential issues
        console.log('\nPotential issues found:');
        const venuesWithoutCoords = allVenues.filter(v => !v.location?.coordinates);
        if (venuesWithoutCoords.length > 0) {
            console.log(`- ${venuesWithoutCoords.length} venues missing coordinates`);
            venuesWithoutCoords.forEach(v => console.log(`  * ${v.name} (${v.city})`));
        }

        const venuesWithoutCity = allVenues.filter(v => !v.city);
        if (venuesWithoutCity.length > 0) {
            console.log(`- ${venuesWithoutCity.length} venues missing city`);
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
            console.log(`- ${duplicates.length} venues with duplicate names:`);
            duplicates.forEach(([name, venues]) => {
                console.log(`  * ${name}:`);
                venues.forEach(v => console.log(`    - ${v.name} (${v.city})`));
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDatabase connection closed');
    }
}

analyzeVenueLookup(); 