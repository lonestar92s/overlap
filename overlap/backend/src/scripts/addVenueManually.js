const mongoose = require('mongoose');
const Venue = require('../models/Venue');

// Helper function to get country code
function getCountryCode(country) {
    const countryMap = {
        'England': 'GB',
        'Scotland': 'GB',
        'Wales': 'GB',
        'Northern Ireland': 'GB',
        'Spain': 'ES',
        'Germany': 'DE',
        'Italy': 'IT',
        'France': 'FR',
        'Netherlands': 'NL',
        'Portugal': 'PT',
        'USA': 'US',
        'Canada': 'CA',
        'Australia': 'AU',
        'Japan': 'JP',
        'Saudi Arabia': 'SA'
    };
    return countryMap[country] || 'XX';
}

/**
 * Manually add a venue to the database
 * 
 * Usage:
 * node src/scripts/addVenueManually.js
 * 
 * Or set environment variables:
 * VENUE_NAME="Brick Community Stadium"
 * VENUE_CITY="Wigan"
 * VENUE_COUNTRY="England"
 * VENUE_LAT=53.5454
 * VENUE_LON=-2.6319
 * VENUE_ID=12345 (optional, will auto-generate if not provided)
 */
async function addVenueManually() {
    try {
        const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL;
        
        if (!MONGODB_URI) {
            console.error('❌ MONGODB_URI not found in environment variables');
            process.exit(1);
        }

        // Get venue data from environment variables or use defaults for testing
        const venueData = {
            venueId: process.env.VENUE_ID ? parseInt(process.env.VENUE_ID) : null,
            name: process.env.VENUE_NAME || 'Example Venue',
            city: process.env.VENUE_CITY || 'London',
            country: process.env.VENUE_COUNTRY || 'England',
            lat: parseFloat(process.env.VENUE_LAT || '0'),
            lon: parseFloat(process.env.VENUE_LON || '0'),
            address: process.env.VENUE_ADDRESS || null,
            capacity: process.env.VENUE_CAPACITY ? parseInt(process.env.VENUE_CAPACITY) : null
        };

        // Validate required fields
        if (!venueData.name || venueData.name === 'Example Venue') {
            console.error('❌ VENUE_NAME is required');
            console.log('\nUsage:');
            console.log('  VENUE_NAME="Brick Community Stadium" \\');
            console.log('  VENUE_CITY="Wigan" \\');
            console.log('  VENUE_COUNTRY="England" \\');
            console.log('  VENUE_LAT=53.5454 \\');
            console.log('  VENUE_LON=-2.6319 \\');
            console.log('  VENUE_ID=12345 \\');
            console.log('  node src/scripts/addVenueManually.js');
            process.exit(1);
        }

        if (venueData.lat === 0 || venueData.lon === 0) {
            console.error('❌ VENUE_LAT and VENUE_LON are required');
            process.exit(1);
        }

        // Connect to MongoDB
        const safeUri = MONGODB_URI.replace(/mongodb:\/\/([^:]+):([^@]+)@/, 'mongodb://***:***@');
        const isRailway = MONGODB_URI.includes('railway') || MONGODB_URI.includes('rlwy.net');
        console.log(`🔌 Connecting to MongoDB: ${isRailway ? '✅ Railway' : '⚠️ LOCAL'} - ${safeUri}`);
        
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Generate venueId if not provided (use a high number to avoid conflicts)
        if (!venueData.venueId) {
            // Find the highest venueId and add 1
            const maxVenue = await Venue.findOne().sort({ venueId: -1 }).select('venueId').lean();
            venueData.venueId = (maxVenue?.venueId || 50000) + 1;
            console.log(`📝 Generated venueId: ${venueData.venueId}`);
        }

        // Check if venue already exists
        const existingVenue = await Venue.findOne({
            $or: [
                { venueId: venueData.venueId },
                {
                    name: { $regex: new RegExp(`^${venueData.name}$`, 'i') },
                    city: { $regex: new RegExp(`^${venueData.city}$`, 'i') }
                }
            ]
        });

        if (existingVenue) {
            console.log(`⚠️  Venue already exists:`);
            console.log(`   Name: ${existingVenue.name}`);
            console.log(`   City: ${existingVenue.city}`);
            console.log(`   ID: ${existingVenue.venueId}`);
            console.log(`   Coordinates: ${existingVenue.coordinates ? JSON.stringify(existingVenue.coordinates) : 'None'}`);
            
            // Ask if user wants to update
            console.log('\n💡 To update this venue, use the updateVenueManually script or update via MongoDB directly');
            await mongoose.disconnect();
            return;
        }

        // Create coordinates array [longitude, latitude]
        const coordinates = [venueData.lon, venueData.lat];
        const countryCode = getCountryCode(venueData.country);

        // Create venue document
        const newVenue = new Venue({
            venueId: venueData.venueId,
            name: venueData.name,
            city: venueData.city,
            country: venueData.country,
            countryCode: countryCode,
            coordinates: coordinates,
            location: {
                type: 'Point',
                coordinates: coordinates
            },
            address: venueData.address || null,
            capacity: venueData.capacity || null,
            isActive: true,
            lastUpdated: new Date()
        });

        await newVenue.save();

        console.log('✅ Successfully added venue:');
        console.log(`   Name: ${newVenue.name}`);
        console.log(`   City: ${newVenue.city}`);
        console.log(`   Country: ${newVenue.country}`);
        console.log(`   Venue ID: ${newVenue.venueId}`);
        console.log(`   Coordinates: [${coordinates[0]}, ${coordinates[1]}]`);
        console.log(`   Country Code: ${countryCode}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 11000) {
            console.error('   Duplicate venueId - this venue ID already exists');
        }
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the script
addVenueManually();

