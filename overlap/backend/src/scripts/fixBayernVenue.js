const mongoose = require('mongoose');
const Team = require('../models/Team');
const Venue = require('../models/Venue');
require('dotenv').config();

async function fixBayernVenue() {
    try {
        await mongoose.connect(process.env.MONGO_PUBLIC_URL);
        console.log('📦 Connected to MongoDB');

        // Find Allianz Arena venue
        const allianzArena = await Venue.findOne({ 
            name: { $regex: /allianz/i } 
        });

        if (!allianzArena) {
            console.error('❌ Allianz Arena venue not found');
            process.exit(1);
        }

        console.log('✅ Found Allianz Arena:', {
            name: allianzArena.name,
            coordinates: allianzArena.coordinates || allianzArena.location?.coordinates,
            city: allianzArena.city
        });

        // Find Bayern Munich team
        const bayern = await Team.findOne({
            $or: [
                { name: /bayern/i },
                { apiName: /bayern/i },
                { aliases: /bayern/i }
            ]
        });

        if (!bayern) {
            console.error('❌ Bayern Munich team not found');
            process.exit(1);
        }

        console.log('✅ Found Bayern Munich:', {
            name: bayern.name,
            apiId: bayern.apiId,
            currentVenue: bayern.venue
        });

        // Update team with venue data
        const coordinates = allianzArena.coordinates || allianzArena.location?.coordinates;
        
        const updateResult = await Team.updateOne(
            { _id: bayern._id },
            {
                $set: {
                    venue: {
                        name: allianzArena.name,
                        city: allianzArena.city || 'Munich',
                        coordinates: coordinates,
                        capacity: allianzArena.capacity
                    },
                    city: allianzArena.city || 'Munich'
                }
            }
        );

        console.log('✅ Update result:', updateResult);

        // Verify the update
        const updatedBayern = await Team.findById(bayern._id);
        console.log('✅ Updated Bayern Munich:', {
            name: updatedBayern.name,
            venue: updatedBayern.venue,
            city: updatedBayern.city
        });

        console.log('✅ Successfully linked Bayern Munich to Allianz Arena');
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📦 Disconnected from MongoDB');
    }
}

fixBayernVenue();

