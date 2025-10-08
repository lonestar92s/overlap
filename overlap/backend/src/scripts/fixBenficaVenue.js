const mongoose = require('mongoose');
const Venue = require('../models/Venue');

async function fixBenficaVenue() {
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
            console.log('✅ Venue ID:', venue.venueId);
            console.log('✅ Venue coordinates:', venue.location?.coordinates);
            
            // The venue exists, so the issue might be in the venue lookup logic
            // Let's check if the venue service can find it by the full name
            const venueService = require('../services/venueService');
            const foundByName = await venueService.getVenueByName('Estádio do Sport Lisboa e Benfica', 'Lisbon');
            
            if (foundByName) {
                console.log('✅ Venue service can find it by full name');
            } else {
                console.log('❌ Venue service cannot find it by full name');
                console.log('💡 This suggests the venue lookup by name is failing');
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

fixBenficaVenue();
