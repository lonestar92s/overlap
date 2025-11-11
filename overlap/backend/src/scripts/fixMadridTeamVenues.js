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
            console.log('⚠️  WARNING: Connecting to Railway/production database');
            console.log('   This will update production data!\n');
        }
        
        await mongoose.connect(mongoUrl);
        console.log('📦 Connected to MongoDB\n');

        // Fix Real Madrid - should be Estadio Santiago Bernabéu
        const realMadrid = await Team.findOne({ name: /real madrid/i });
        const bernabeu = await Venue.findOne({ 
            name: { $regex: /santiago bernab/i },
            city: /madrid/i
        });

        if (realMadrid && bernabeu && bernabeu.coordinates) {
            console.log(`🔧 Fixing Real Madrid`);
            console.log(`   Current venue: ${realMadrid.venue?.name || 'None'}`);
            console.log(`   Correct venue: ${bernabeu.name}`);
            console.log(`   Coordinates: [${bernabeu.coordinates[0]}, ${bernabeu.coordinates[1]}]`);
            
            realMadrid.venue = {
                name: bernabeu.name,
                coordinates: bernabeu.coordinates
            };
            await realMadrid.save();
            console.log(`   ✅ Updated Real Madrid\n`);
        }

        // Fix Rayo Vallecano - should be Estadio de Vallecas
        const rayoval = await Team.findOne({ name: /rayo/i });
        const vallecas = await Venue.findOne({ 
            name: { $regex: /vallecas/i },
            city: /madrid/i
        });

        if (rayoval && vallecas && vallecas.coordinates) {
            console.log(`🔧 Fixing Rayo Vallecano`);
            console.log(`   Current venue: ${rayoval.venue?.name || 'None'}`);
            console.log(`   Correct venue: ${vallecas.name}`);
            console.log(`   Coordinates: [${vallecas.coordinates[0]}, ${vallecas.coordinates[1]}]`);
            
            rayoval.venue = {
                name: vallecas.name,
                coordinates: vallecas.coordinates
            };
            await rayoval.save();
            console.log(`   ✅ Updated Rayo Vallecano\n`);
        }

        // Verify Atletico Madrid has correct venue
        const atletico = await Team.findOne({ name: /atletico madrid/i });
        const metropolitano = await Venue.findOne({ 
            name: { $regex: /metropolitano/i },
            city: /madrid/i
        });

        if (atletico && metropolitano) {
            console.log(`✅ Atletico Madrid venue: ${atletico.venue?.name}`);
            console.log(`   Coordinates: ${atletico.venue?.coordinates ? `[${atletico.venue.coordinates[0]}, ${atletico.venue.coordinates[1]}]` : 'None'}`);
        }

        console.log(`\n📊 Summary: Fixed Madrid team venues`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📦 Disconnected from MongoDB');
    }
}

fixMadridTeamVenues();

