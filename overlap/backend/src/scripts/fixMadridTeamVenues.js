const mongoose = require('mongoose');
const Team = require('../models/Team');
const Venue = require('../models/Venue');
require('dotenv').config();
async function fixMadridTeamVenues() {
    try {
        const mongoUrl = process.env.MONGO_PUBLIC_URL;
        if (!mongoUrl) {
            console.error('❌ MONGO_PUBLIC_URL environment variable not set');
            process.exit(1);
        }
        if (mongoUrl.includes('railway') || mongoUrl.includes('mongo:')) {
        }
        await mongoose.connect(mongoUrl);
        // Fix Real Madrid - should be Estadio Santiago Bernabéu
        const realMadrid = await Team.findOne({ name: /real madrid/i });
        const bernabeu = await Venue.findOne({ 
            name: { $regex: /santiago bernab/i },
            city: /madrid/i
        });
        if (realMadrid && bernabeu && bernabeu.coordinates) {
            realMadrid.venue = {
                venueId: bernabeu.venueId,
                name: bernabeu.name,
                coordinates: bernabeu.coordinates
            };
            await realMadrid.save();
        }
        // Fix Rayo Vallecano - should be Estadio de Vallecas
        const rayoval = await Team.findOne({ name: /rayo/i });
        const vallecas = await Venue.findOne({ 
            name: { $regex: /vallecas/i },
            city: /madrid/i
        });
        if (rayoval && vallecas && vallecas.coordinates) {
            rayoval.venue = {
                venueId: vallecas.venueId,
                name: vallecas.name,
                coordinates: vallecas.coordinates
            };
            await rayoval.save();
        }
        // Verify Atletico Madrid has correct venue
        const atletico = await Team.findOne({ name: /atletico madrid/i });
        const metropolitano = await Venue.findOne({ 
            name: { $regex: /metropolitano/i },
            city: /madrid/i
        });
        if (atletico && metropolitano) {
        }
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}
fixMadridTeamVenues();
