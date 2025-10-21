const mongoose = require('mongoose');
const Venue = require('../models/Venue');

async function addBenficaVenueAlias() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/overlap', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('📦 Connected to MongoDB');
        
        // Find the Estádio da Luz venue
        const venue = await Venue.findOne({ 
            name: 'Estádio da Luz' 
        });
        
        if (venue) {
            console.log('✅ Found venue:', venue.name);
            
            // Add the full official name as an alias
            if (!venue.aliases) {
                venue.aliases = [];
            }
            
            const fullName = 'Estádio do Sport Lisboa e Benfica';
            if (!venue.aliases.includes(fullName)) {
                venue.aliases.push(fullName);
                await venue.save();
                console.log(`✅ Added alias "${fullName}" to Estádio da Luz`);
            } else {
                console.log(`⏭️  Alias "${fullName}" already exists`);
            }
            
            // Add other common variations
            const otherAliases = [
                'Stadium of Light',
                'Benfica Stadium',
                'Estadio da Luz',
                'Estadio do Sport Lisboa e Benfica'
            ];
            
            for (const alias of otherAliases) {
                if (!venue.aliases.includes(alias)) {
                    venue.aliases.push(alias);
                    console.log(`✅ Added alias "${alias}"`);
                }
            }
            
            await venue.save();
            console.log('✅ Final venue aliases:', venue.aliases);
            
            // Test the venue service lookup
            const venueService = require('../services/venueService');
            const foundByName = await venueService.getVenueByName('Estádio do Sport Lisboa e Benfica', 'Lisbon');
            
            if (foundByName) {
                console.log('✅ Venue service can now find it by full name!');
                console.log('✅ Found venue:', foundByName.name);
            } else {
                console.log('❌ Venue service still cannot find it by full name');
            }
            
        } else {
            console.log('❌ Estádio da Luz venue not found in database');
            
            // List all venues in Lisbon
            const lisbonVenues = await Venue.find({ city: 'Lisbon' });
            console.log('🔍 Venues in Lisbon:', lisbonVenues.map(v => v.name));
        }
        
        console.log('✨ Fix completed');
    } catch (error) {
        console.error('❌ Fix failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

addBenficaVenueAlias();


