const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const Team = require('../models/Team');
const geocodingService = require('../services/geocodingService');
require('dotenv').config();

// Country coordinate bounds (approximate) for validation
const COUNTRY_BOUNDS = {
    'England': { minLat: 50.0, maxLat: 55.8, minLng: -6.0, maxLng: 2.0 },
    'Germany': { minLat: 47.0, maxLat: 55.0, minLng: 5.0, maxLng: 15.0 },
    'France': { minLat: 41.0, maxLat: 51.0, minLng: -5.0, maxLng: 10.0 },
    'Spain': { minLat: 36.0, maxLat: 44.0, minLng: -10.0, maxLng: 4.0 },
    'Italy': { minLat: 36.0, maxLat: 47.0, minLng: 6.0, maxLng: 19.0 },
    'Netherlands': { minLat: 50.7, maxLat: 53.7, minLng: 3.0, maxLng: 7.3 },
    'Portugal': { minLat: 36.9, maxLat: 42.2, minLng: -9.5, maxLng: -6.2 },
    'Belgium': { minLat: 49.5, maxLat: 51.5, minLng: 2.5, maxLng: 6.4 },
    'Scotland': { minLat: 54.6, maxLat: 60.9, minLng: -8.6, maxLng: -0.7 },
    'Mexico': { minLat: 14.5, maxLat: 32.7, minLng: -118.4, maxLng: -86.7 },
    'USA': { minLat: 24.5, maxLat: 49.4, minLng: -125.0, maxLng: -66.9 },
    'Brazil': { minLat: -33.7, maxLat: 5.3, minLng: -73.9, maxLng: -32.4 }
};

// City coordinate centers (for distance validation)
const CITY_CENTERS = {
    'London': { lat: 51.5074, lng: -0.1278 },
    'Manchester': { lat: 53.4808, lng: -2.2426 },
    'Liverpool': { lat: 53.4084, lng: -2.9916 },
    'Munich': { lat: 48.1351, lng: 11.5820 },
    'Berlin': { lat: 52.5200, lng: 13.4050 },
    'Paris': { lat: 48.8566, lng: 2.3522 },
    'Madrid': { lat: 40.4168, lng: -3.7038 },
    'Barcelona': { lat: 41.3851, lng: 2.1734 },
    'Milan': { lat: 45.4642, lng: 9.1900 },
    'Rome': { lat: 41.9028, lng: 12.4964 }
};

/**
 * Calculate distance between two coordinates in km
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Validate if coordinates are within country bounds
 */
function isWithinCountryBounds(coordinates, country) {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        return false;
    }

    const [lon, lat] = coordinates;
    const bounds = COUNTRY_BOUNDS[country];
    
    if (!bounds) {
        // Country not in our bounds list - skip validation
        return true;
    }

    return lat >= bounds.minLat && lat <= bounds.maxLat &&
           lon >= bounds.minLng && lon <= bounds.maxLng;
}

/**
 * Validate if coordinates are near the city center
 */
function isNearCity(coordinates, city) {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        return false;
    }

    const [lon, lat] = coordinates;
    const cityCenter = CITY_CENTERS[city];
    
    if (!cityCenter) {
        // City not in our list - skip validation
        return true;
    }

    const distance = calculateDistanceKm(lat, lon, cityCenter.lat, cityCenter.lng);
    // Allow up to 50km from city center (stadiums can be in suburbs)
    return distance <= 50;
}

/**
 * Detect incorrect venue coordinates
 */
async function detectIncorrectCoordinates() {
    const issues = [];

    // Get all venues with coordinates
    const venues = await Venue.find({
        coordinates: { $exists: true, $ne: null },
        isActive: true
    }).lean();

    console.log(`🔍 Validating ${venues.length} venues with coordinates...\n`);

    for (const venue of venues) {
        const [lon, lat] = venue.coordinates;
        const issuesForVenue = [];

        // Check 1: Within country bounds
        if (!isWithinCountryBounds(venue.coordinates, venue.country)) {
            issuesForVenue.push({
                type: 'country_bounds',
                message: `Coordinates [${lon}, ${lat}] are outside ${venue.country} bounds`,
                severity: 'high'
            });
        }

        // Check 2: Near city center
        if (venue.city && !isNearCity(venue.coordinates, venue.city)) {
            issuesForVenue.push({
                type: 'city_distance',
                message: `Coordinates are >50km from ${venue.city} center`,
                severity: 'medium'
            });
        }

        // Check 3: Valid coordinate ranges
        if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
            issuesForVenue.push({
                type: 'invalid_range',
                message: `Coordinates [${lon}, ${lat}] are outside valid ranges`,
                severity: 'high'
            });
        }

        if (issuesForVenue.length > 0) {
            issues.push({
                venue: {
                    id: venue._id,
                    venueId: venue.venueId,
                    name: venue.name,
                    city: venue.city,
                    country: venue.country,
                    currentCoordinates: venue.coordinates
                },
                issues: issuesForVenue
            });
        }
    }

    return issues;
}

/**
 * Fix incorrect coordinates by re-geocoding
 */
async function fixVenueCoordinates(venueId, dryRun = true) {
    const venue = await Venue.findById(venueId);
    
    if (!venue) {
        console.log(`❌ Venue not found: ${venueId}`);
        return null;
    }

    console.log(`\n🔧 Fixing coordinates for: ${venue.name}, ${venue.city}, ${venue.country}`);
    console.log(`   Current: [${venue.coordinates?.[0]}, ${venue.coordinates?.[1]}]`);

    // Re-geocode the venue
    const newCoordinates = await geocodingService.geocodeVenueCoordinates(
        venue.name,
        venue.city,
        venue.country
    );

    if (!newCoordinates) {
        console.log(`   ❌ Failed to geocode`);
        return null;
    }

    const [newLon, newLat] = newCoordinates;
    console.log(`   ✅ New coordinates: [${newLon}, ${newLat}]`);

    // Validate new coordinates
    if (!isWithinCountryBounds(newCoordinates, venue.country)) {
        console.log(`   ⚠️  Warning: New coordinates are still outside country bounds`);
    }

    if (dryRun) {
        console.log(`   🔍 DRY RUN: Would update coordinates`);
        return { venue, oldCoordinates: venue.coordinates, newCoordinates };
    } else {
        // Update venue
        venue.coordinates = newCoordinates;
        venue.location = {
            type: 'Point',
            coordinates: newCoordinates
        };
        venue.lastUpdated = new Date();
        await venue.save();

        // Also update team if it references this venue
        const teams = await Team.find({
            'venue.name': venue.name,
            city: venue.city
        });

        for (const team of teams) {
            if (team.venue && !team.venue.coordinates) {
                team.venue.coordinates = newCoordinates;
                await team.save();
                console.log(`   ✅ Updated team: ${team.name}`);
            }
        }

        console.log(`   ✅ Updated venue coordinates`);
        return { venue, oldCoordinates: venue.coordinates, newCoordinates };
    }
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'detect';
    const dryRun = !args.includes('--apply');

    try {
        await mongoose.connect(process.env.MONGO_PUBLIC_URL);
        console.log('✅ Connected to MongoDB\n');

        if (command === 'detect') {
            // Detect incorrect coordinates
            const issues = await detectIncorrectCoordinates();
            
            console.log(`\n📊 Validation Results:`);
            console.log(`   Total venues checked: ${await Venue.countDocuments({ coordinates: { $exists: true, $ne: null } })}`);
            console.log(`   Venues with issues: ${issues.length}\n`);

            if (issues.length > 0) {
                console.log('❌ Issues Found:\n');
                issues.forEach((item, index) => {
                    console.log(`${index + 1}. ${item.venue.name}, ${item.venue.city}, ${item.venue.country}`);
                    console.log(`   Venue ID: ${item.venue.venueId}`);
                    console.log(`   Current coordinates: [${item.venue.currentCoordinates[0]}, ${item.venue.currentCoordinates[1]}]`);
                    item.issues.forEach(issue => {
                        console.log(`   ⚠️  ${issue.severity.toUpperCase()}: ${issue.message}`);
                    });
                    console.log('');
                });

                // Save report to file
                const fs = require('fs');
                const reportPath = './venue-coordinate-issues.json';
                fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));
                console.log(`📄 Report saved to: ${reportPath}`);
            } else {
                console.log('✅ No issues found!');
            }

        } else if (command === 'fix') {
            // Fix all incorrect coordinates
            const issues = await detectIncorrectCoordinates();
            
            if (issues.length === 0) {
                console.log('✅ No issues to fix');
                return;
            }

            console.log(`\n🔧 Fixing ${issues.length} venues...`);
            if (dryRun) {
                console.log('🔍 DRY RUN MODE - No changes will be made\n');
            } else {
                console.log('⚠️  APPLY MODE - Changes will be saved\n');
            }

            let fixed = 0;
            let failed = 0;

            for (const item of issues) {
                const result = await fixVenueCoordinates(item.venue.id, dryRun);
                if (result) {
                    fixed++;
                } else {
                    failed++;
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            console.log(`\n📊 Fix Results:`);
            console.log(`   Fixed: ${fixed}`);
            console.log(`   Failed: ${failed}`);

        } else if (command === 'fix-one') {
            // Fix a specific venue by ID or name
            const identifier = args[1];
            if (!identifier) {
                console.log('❌ Please provide venue ID or name');
                return;
            }

            let venue;
            if (mongoose.Types.ObjectId.isValid(identifier)) {
                venue = await Venue.findById(identifier);
            } else {
                venue = await Venue.findOne({ name: { $regex: new RegExp(identifier, 'i') } });
            }

            if (!venue) {
                console.log(`❌ Venue not found: ${identifier}`);
                return;
            }

            await fixVenueCoordinates(venue._id, dryRun);

        } else {
            console.log('Usage:');
            console.log('  node validateAndFixVenueCoordinates.js detect              # Detect issues');
            console.log('  node validateAndFixVenueCoordinates.js fix [--apply]       # Fix all issues (dry run by default)');
            console.log('  node validateAndFixVenueCoordinates.js fix-one <id|name> [--apply]  # Fix one venue');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

main();


