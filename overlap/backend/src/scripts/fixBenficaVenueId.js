const mongoose = require('mongoose');
const Venue = require('../models/Venue');

async function fixBenficaVenueId() {
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
            console.log('❌ Current venueId:', venue.venueId);
            
            // Update to the correct venue ID
            venue.venueId = 1265; // Correct Football API venue ID for Benfica
            
            await venue.save();
            console.log('✅ Updated venueId to:', venue.venueId);
            
            // Test the venue service lookup
            const venueService = require('../services/venueService');
            const foundById = await venueService.getVenueByApiId('1265');
            
            if (foundById) {
                console.log('✅ Venue service can now find it by correct ID!');
                console.log('✅ Found venue:', foundById.name);
            } else {
                console.log('❌ Venue service still cannot find it by ID');
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

fixBenficaVenueId();
