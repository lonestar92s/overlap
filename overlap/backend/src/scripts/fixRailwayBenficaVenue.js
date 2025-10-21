const mongoose = require('mongoose');
const Venue = require('../models/Venue');

async function fixRailwayBenficaVenue() {
    try {
        // Connect to Railway MongoDB
        const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI;
        
        if (!mongoUrl) {
            console.error('❌ No MongoDB URL found. Please set MONGO_URL or MONGODB_URI');
            process.exit(1);
        }

        console.log('🔌 Connecting to Railway MongoDB...');
        await mongoose.connect(mongoUrl);
        console.log('✅ Connected to Railway MongoDB');
        
        // Check if Benfica venue already exists
        const existingVenue = await Venue.findOne({ 
            $or: [
                { name: 'Estádio da Luz' },
                { venueId: 1265 },
                { aliases: 'Estádio do Sport Lisboa e Benfica' }
            ]
        });
        
        if (existingVenue) {
            console.log('✅ Benfica venue already exists:');
            console.log(`   Name: ${existingVenue.name}`);
            console.log(`   Venue ID: ${existingVenue.venueId}`);
            console.log(`   Aliases: ${existingVenue.aliases ? existingVenue.aliases.join(', ') : 'None'}`);
            
            // Update if needed
            if (existingVenue.venueId !== 1265) {
                existingVenue.venueId = 1265;
                await existingVenue.save();
                console.log('✅ Updated venue ID to 1265');
            }
            
            if (!existingVenue.aliases || !existingVenue.aliases.includes('Estádio do Sport Lisboa e Benfica')) {
                existingVenue.aliases = [
                    'Estádio do Sport Lisboa e Benfica',
                    'Stadium of Light',
                    'Benfica Stadium',
                    'Estadio da Luz',
                    'Estadio do Sport Lisboa e Benfica'
                ];
                await existingVenue.save();
                console.log('✅ Updated aliases');
            }
            
        } else {
            console.log('🏗️  Creating new Benfica venue...');
            
            // Create new Benfica venue
            const benficaVenue = new Venue({
                venueId: 1265,
                name: 'Estádio da Luz',
                aliases: [
                    'Estádio do Sport Lisboa e Benfica',
                    'Stadium of Light',
                    'Benfica Stadium',
                    'Estadio da Luz',
                    'Estadio do Sport Lisboa e Benfica'
                ],
                city: 'Lisboa',
                country: 'Portugal',
                countryCode: 'PT',
                coordinates: [-9.1856, 38.7525], // Estádio da Luz coordinates
                location: {
                    type: 'Point',
                    coordinates: [-9.1856, 38.7525]
                },
                capacity: 64647,
                surface: 'Natural grass',
                isActive: true,
                lastUpdated: new Date()
            });
            
            await benficaVenue.save();
            console.log('✅ Created Benfica venue with correct data:');
            console.log(`   Name: ${benficaVenue.name}`);
            console.log(`   Venue ID: ${benficaVenue.venueId}`);
            console.log(`   City: ${benficaVenue.city}`);
            console.log(`   Coordinates: [${benficaVenue.coordinates.join(', ')}]`);
            console.log(`   Aliases: ${benficaVenue.aliases.join(', ')}`);
        }
        
        // Verify the venue was created/updated correctly
        console.log('\n🔍 Verifying Benfica venue...');
        const verifyVenue = await Venue.findOne({ venueId: 1265 });
        if (verifyVenue) {
            console.log('✅ Verification successful:');
            console.log(`   Name: ${verifyVenue.name}`);
            console.log(`   Venue ID: ${verifyVenue.venueId}`);
            console.log(`   Aliases: ${verifyVenue.aliases.join(', ')}`);
            console.log(`   Coordinates: [${verifyVenue.coordinates.join(', ')}]`);
        } else {
            console.log('❌ Verification failed - venue not found');
        }
        
        console.log('\n✨ Railway database fix completed');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from Railway MongoDB');
    }
}

fixRailwayBenficaVenue();

