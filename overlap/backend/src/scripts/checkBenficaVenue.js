const mongoose = require('mongoose');
const Venue = require('../models/Venue');

async function checkBenficaVenue() {
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
            console.log('📊 Venue data:', JSON.stringify(venue, null, 2));
        } else {
            console.log('❌ Estádio da Luz venue not found in database');
            
            // List all venues in Lisbon
            const lisbonVenues = await Venue.find({ city: 'Lisbon' });
            console.log('🔍 Venues in Lisbon:', lisbonVenues.map(v => ({ name: v.name, venueId: v.venueId })));
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

checkBenficaVenue();

