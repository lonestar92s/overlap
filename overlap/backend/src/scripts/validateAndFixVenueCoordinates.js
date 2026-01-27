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
        return null;
    }
    // Re-geocode the venue
    const newCoordinates = await geocodingService.geocodeVenueCoordinates(
        venue.name,
        venue.city,
        venue.country
    );
    if (!newCoordinates) {
        return null;
    }
    const [newLon, newLat] = newCoordinates;
    // Validate new coordinates
    if (!isWithinCountryBounds(newCoordinates, venue.country)) {
    }
    if (dryRun) {
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
            }
        }
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
        if (command === 'detect') {
            // Detect incorrect coordinates
            const issues = await detectIncorrectCoordinates();
            if (issues.length > 0) {
                issues.forEach((item, index) => {
                    item.issues.forEach(issue => {
                    });
                });
                // Save report to file
                const fs = require('fs');
                const reportPath = './venue-coordinate-issues.json';
                fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));
            } else {
            }
        } else if (command === 'fix') {
            // Fix all incorrect coordinates
            const issues = await detectIncorrectCoordinates();
            if (issues.length === 0) {
                return;
            }
            if (dryRun) {
            } else {
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
        } else if (command === 'fix-one') {
            // Fix a specific venue by ID or name
            const identifier = args[1];
            if (!identifier) {
                return;
            }
            let venue;
            if (mongoose.Types.ObjectId.isValid(identifier)) {
                venue = await Venue.findById(identifier);
            } else {
                venue = await Venue.findOne({ name: { $regex: new RegExp(identifier, 'i') } });
            }
            if (!venue) {
                return;
            }
            await fixVenueCoordinates(venue._id, dryRun);
        } else {
        }
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}
main();
