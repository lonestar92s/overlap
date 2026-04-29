/**
 * Check Railway MongoDB venues: compare stored lat/long against venue city (source of truth).
 * Lists all discrepancies where the pin location doesn't match the venue's city/country.
 *
 * Run: node src/scripts/checkVenuesCityAsSourceOfTruth.js
 *
 * Requires: LOCATIONIQ_API_KEY, MONGODB_URI or MONGO_URL
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const geocodingService = require('../services/geocodingService');
const venueService = require('../services/venueService');

const DISCREPANCY_THRESHOLD_KM = 15; // Stadiums can be in suburbs; flag if >15km from city-based geocode
const RATE_LIMIT_MS = 1100; // LocationIQ free tier: 1 req/sec; use 1.1s to avoid 429

/**
 * Calculate distance between two coordinates in km (haversine)
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Get coordinates from venue (coordinates or location.coordinates)
 */
function getVenueCoords(venue) {
    const coords = venue.coordinates || venue.location?.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length !== 2) return null;
    const [lon, lat] = coords;
    if (typeof lon !== 'number' || typeof lat !== 'number' ||
        lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
    return coords;
}

/**
 * Detect discrepancies: stored coords vs city-as-source-of-truth (geocoded)
 */
async function detectDiscrepancies() {
    const discrepancies = [];

    const venues = await Venue.find({
        isActive: { $ne: false },
        city: { $exists: true, $ne: '', $ne: null }
    }).lean();

    const withCoords = venues.filter(v => getVenueCoords(v));
    console.log(`\n📊 Checking ${withCoords.length} venues with coordinates (city as source of truth)...\n`);

    for (let i = 0; i < withCoords.length; i++) {
        const venue = withCoords[i];
        const storedCoords = getVenueCoords(venue);
        const [storedLon, storedLat] = storedCoords;

        // Geocode using city as source of truth
        const geocodedCoords = await geocodingService.geocodeVenueCoordinates(
            venue.name,
            venue.city,
            venue.country
        );

        // Rate limit
        await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

        if (!geocodedCoords) {
            // Geocoding failed - still check country bounds
            const inBounds = venueService.isWithinCountryBounds(storedCoords, venue.country);
            if (!inBounds) {
                discrepancies.push({
                    venueId: venue.venueId,
                    name: venue.name,
                    city: venue.city,
                    country: venue.country,
                    storedLat,
                    storedLon,
                    geocodedLat: null,
                    geocodedLon: null,
                    distanceKm: null,
                    reason: 'geocode_failed',
                    message: `Stored coords outside ${venue.country} bounds; geocoding failed`
                });
            }
            continue;
        }

        const [geocodedLon, geocodedLat] = geocodedCoords;
        const distanceKm = calculateDistanceKm(storedLat, storedLon, geocodedLat, geocodedLon);

        // Discrepancy: stored coords far from city-based geocode
        if (distanceKm > DISCREPANCY_THRESHOLD_KM) {
            discrepancies.push({
                venueId: venue.venueId,
                name: venue.name,
                city: venue.city,
                country: venue.country,
                storedLat,
                storedLon,
                geocodedLat,
                geocodedLon,
                distanceKm: Math.round(distanceKm * 100) / 100,
                reason: 'distance_mismatch',
                message: `Stored coords ${distanceKm.toFixed(1)}km from city-based geocode`
            });
        }

        // Also flag if outside country bounds (even if distance is ok)
        const inBounds = venueService.isWithinCountryBounds(storedCoords, venue.country);
        if (!inBounds && distanceKm <= DISCREPANCY_THRESHOLD_KM) {
            discrepancies.push({
                venueId: venue.venueId,
                name: venue.name,
                city: venue.city,
                country: venue.country,
                storedLat,
                storedLon,
                geocodedLat,
                geocodedLon,
                distanceKm: Math.round(distanceKm * 100) / 100,
                reason: 'outside_country_bounds',
                message: `Stored coords outside ${venue.country} bounds`
            });
        }

        if ((i + 1) % 50 === 0) {
            console.log(`   Processed ${i + 1}/${withCoords.length} venues...`);
        }
    }

    return discrepancies;
}

/**
 * Print and save discrepancy report
 */
function reportDiscrepancies(discrepancies) {
    if (discrepancies.length === 0) {
        console.log('✅ No discrepancies found. All venue coordinates match city/country.\n');
        return;
    }

    console.log(`\n⚠️  Found ${discrepancies.length} discrepancy(ies):\n`);
    console.log('─'.repeat(100));

    discrepancies.forEach((d, i) => {
        console.log(`\n${i + 1}. ${d.name} (${d.city}, ${d.country})`);
        console.log(`   Venue ID: ${d.venueId}`);
        console.log(`   Stored:     lat=${d.storedLat?.toFixed(6) ?? 'N/A'}, lon=${d.storedLon?.toFixed(6) ?? 'N/A'}`);
        console.log(`   Geocoded:   lat=${d.geocodedLat?.toFixed(6) ?? 'N/A'}, lon=${d.geocodedLon?.toFixed(6) ?? 'N/A'}`);
        if (d.distanceKm != null) console.log(`   Distance:   ${d.distanceKm} km`);
        console.log(`   Reason:     ${d.message}`);
    });

    console.log('\n' + '─'.repeat(100));
    console.log(`\n📄 Full report saved to: venue-city-discrepancies.json\n`);

    const fs = require('fs');
    const reportPath = require('path').join(__dirname, '../../venue-city-discrepancies.json');
    fs.writeFileSync(reportPath, JSON.stringify(discrepancies, null, 2));
}

async function main() {
    const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGO_PUBLIC_URL;
    if (!mongoUri) {
        console.error('❌ MONGODB_URI, MONGO_URL, or MONGO_PUBLIC_URL required');
        process.exit(1);
    }
    if (!process.env.LOCATIONIQ_API_KEY) {
        console.error('❌ LOCATIONIQ_API_KEY required for geocoding');
        process.exit(1);
    }

    try {
        await mongoose.connect(mongoUri);
        const dbName = mongoose.connection.db?.databaseName || 'unknown';
        console.log(`\n🔗 Connected to MongoDB: ${dbName}\n`);

        const discrepancies = await detectDiscrepancies();
        reportDiscrepancies(discrepancies);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

main();
