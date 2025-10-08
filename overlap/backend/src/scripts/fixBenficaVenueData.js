const mongoose = require('mongoose');
const Venue = require('../models/Venue');

async function fixBenficaVenueData() {
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
            
            // Fix the venue data
            venue.venueId = 19187; // Use the API venue ID from the match data
            venue.coordinates = venue.location.coordinates; // Use coordinates from location field
            venue.aliases = [
                'Estádio do Sport Lisboa e Benfica',
                'Stadium of Light',
                'Benfica Stadium',
                'Estadio da Luz',
                'Estadio do Sport Lisboa e Benfica'
            ];
            
            await venue.save();
            console.log('✅ Fixed venue data');
            console.log('✅ Added venueId:', venue.venueId);
            console.log('✅ Added aliases:', venue.aliases);
            
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
        }
        
        console.log('✨ Fix completed');
    } catch (error) {
        console.error('❌ Fix failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

fixBenficaVenueData();
