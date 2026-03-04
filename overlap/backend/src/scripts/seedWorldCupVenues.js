/**
 * Seed all FIFA World Cup 2026 venues into the Venue collection.
 * Many of these stadiums (MetLife, Hard Rock, etc.) are not typically used for soccer
 * and may be missing from the database. This script ensures they exist with coordinates
 * so World Cup matches display correctly on the map.
 *
 * Usage:
 *   node src/scripts/seedWorldCupVenues.js
 *
 * Requires: MONGODB_URI or MONGO_URL in environment (or .env)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Venue = require('../models/Venue');

const COUNTRY_CODES = {
    'USA': 'US',
    'Canada': 'CA',
    'Mexico': 'MX'
};

// FIFA World Cup 2026 venues - [lon, lat] per Venue schema
// Names match API-Football responses for getVenueByName lookup
const WORLD_CUP_2026_VENUES = [
    // USA (11 stadiums)
    { name: 'MetLife Stadium', city: 'East Rutherford', country: 'USA', coords: [-74.0744, 40.8136], capacity: 82500, aliases: [] },
    { name: 'SoFi Stadium', city: 'Inglewood', country: 'USA', coords: [-118.339, 33.9535], capacity: 70240, aliases: [] },
    { name: 'AT&T Stadium', city: 'Arlington', country: 'USA', coords: [-97.0931, 32.7473], capacity: 80000, aliases: [] },
    { name: 'Mercedes-Benz Stadium', city: 'Atlanta', country: 'USA', coords: [-84.4008, 33.7554], capacity: 71000, aliases: [] },
    { name: 'NRG Stadium', city: 'Houston', country: 'USA', coords: [-95.4106, 29.6847], capacity: 72220, aliases: [] },
    { name: 'Arrowhead Stadium', city: 'Kansas City', country: 'USA', coords: [-94.4839, 39.0489], capacity: 76416, aliases: [] },
    { name: "Levi's Stadium", city: 'Santa Clara', country: 'USA', coords: [-121.970, 37.4030], capacity: 68500, aliases: [] },
    { name: 'Lumen Field', city: 'Seattle', country: 'USA', coords: [-122.332, 47.5952], capacity: 68740, aliases: [] },
    { name: 'Lincoln Financial Field', city: 'Philadelphia', country: 'USA', coords: [-75.1667, 39.9008], capacity: 69576, aliases: [] },
    { name: 'Gillette Stadium', city: 'Foxborough', country: 'USA', coords: [-71.2642, 42.0909], capacity: 65878, aliases: [] },
    { name: 'Hard Rock Stadium', city: 'Miami Gardens', country: 'USA', coords: [-80.239, 25.958], capacity: 64767, aliases: [] },
    // Canada (2 stadiums)
    { name: 'BMO Field', city: 'Toronto', country: 'Canada', coords: [-79.4186, 43.6325], capacity: 45100, aliases: [] },
    { name: 'BC Place', city: 'Vancouver', country: 'Canada', coords: [-122.4268, 45.5095], capacity: 54500, aliases: [] },
    // Mexico (3 stadiums)
    { name: 'Estadio Azteca', city: 'Mexico City', country: 'Mexico', coords: [-99.1504, 19.3030], capacity: 87523, aliases: [] },
    { name: 'Estadio BBVA Bancomer', city: 'Monterrey', country: 'Mexico', coords: [-100.3535, 25.6843], capacity: 53466, aliases: ['Estadio BBVA'] },
    { name: 'Estadio Akron', city: 'Guadalajara', country: 'Mexico', coords: [-103.462, 20.6778], capacity: 48107, aliases: [] }
];

const VENUE_ID_BASE = 60000; // Reserve 60001-60016 for World Cup venues

async function seedWorldCupVenues() {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL;
    if (!mongoUri) {
        console.error('❌ MONGODB_URI, MONGO_URL, or MONGO_PUBLIC_URL required');
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB\n');
        console.log('Seeding FIFA World Cup 2026 venues...\n');

        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (let i = 0; i < WORLD_CUP_2026_VENUES.length; i++) {
            const v = WORLD_CUP_2026_VENUES[i];
            const venueId = VENUE_ID_BASE + i + 1;
            const countryCode = COUNTRY_CODES[v.country] || 'XX';
            const coordinates = v.coords;

            // Find existing by name+city (case-insensitive) or venueId
            const existing = await Venue.findOne({
                $or: [
                    { venueId },
                    {
                        name: { $regex: new RegExp(`^${v.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                        city: { $regex: new RegExp(`^${v.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
                    }
                ]
            });

            const venueData = {
                name: v.name,
                city: v.city,
                country: v.country,
                countryCode,
                coordinates,
                location: { type: 'Point', coordinates },
                capacity: v.capacity || null,
                aliases: v.aliases || [],
                isActive: true,
                lastUpdated: new Date()
            };

            if (existing) {
                const hasCoords = existing.coordinates?.length === 2 || existing.location?.coordinates?.length === 2;
                if (!hasCoords) {
                    await Venue.updateOne(
                        { _id: existing._id },
                        {
                            $set: {
                                coordinates: venueData.coordinates,
                                location: venueData.location,
                                capacity: venueData.capacity,
                                aliases: venueData.aliases,
                                lastUpdated: venueData.lastUpdated
                            }
                        }
                    );
                    console.log(`  ✓ Updated: ${v.name} (${v.city}) - added coordinates`);
                    updated++;
                } else {
                    console.log(`  - Skipped: ${v.name} (${v.city}) - already has coordinates`);
                    skipped++;
                }
            } else {
                await Venue.create({
                    venueId,
                    ...venueData
                });
                console.log(`  + Created: ${v.name} (${v.city})`);
                created++;
            }
        }

        console.log('\n--- Summary ---');
        console.log(`  Created: ${created}`);
        console.log(`  Updated: ${updated}`);
        console.log(`  Skipped: ${skipped}`);
        console.log(`  Total:   ${WORLD_CUP_2026_VENUES.length}`);
        console.log('\nDone.');
    } catch (err) {
        console.error('❌ Error:', err.message);
        if (err.code === 11000) {
            console.error('   Duplicate venueId - a venue with that ID already exists');
        }
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

seedWorldCupVenues();
