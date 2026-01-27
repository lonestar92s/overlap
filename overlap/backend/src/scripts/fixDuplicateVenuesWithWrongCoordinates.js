/**
 * Script to find and fix duplicate venue records with wrong coordinates
 * 
 * This script:
 * 1. Finds venues with duplicate names
 * 2. Identifies which ones have coordinates outside country bounds
 * 3. Keeps venues with valid coordinates
 * 4. Deletes or marks as inactive venues with invalid coordinates
 * 
 * Run with: node src/scripts/fixDuplicateVenuesWithWrongCoordinates.js [--dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Venue = require('../models/Venue');
// Country bounds for validation
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
    'Wales': { minLat: 51.3, maxLat: 53.5, minLng: -5.3, maxLng: -2.7 },
    'Mexico': { minLat: 14.5, maxLat: 32.7, minLng: -118.4, maxLng: -86.7 },
    'USA': { minLat: 24.5, maxLat: 49.4, minLng: -125.0, maxLng: -66.9 },
    'Brazil': { minLat: -33.7, maxLat: 5.3, minLng: -73.9, maxLng: -32.4 }
};
/**
 * Validate if coordinates are within country bounds
 */
function isWithinCountryBounds(coordinates, country) {
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        return false;
    }
    const [lon, lat] = coordinates;
    if (typeof lon !== 'number' || typeof lat !== 'number' ||
        lon < -180 || lon > 180 || lat < -90 || lat > 90) {
        return false;
    }
    const bounds = COUNTRY_BOUNDS[country];
    if (!bounds) {
        // Country not in our bounds list - assume valid (could be a new country)
        return true;
    }
    return lat >= bounds.minLat && lat <= bounds.maxLat &&
           lon >= bounds.minLng && lon <= bounds.maxLng;
}
/**
 * Normalize venue name for comparison
 */
function normalizeVenueName(name) {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/^the\s+/, '')
        .replace(/[.,'"]/g, '')
        .trim();
}
/**
 * Find duplicate venues by name
 */
async function findDuplicateVenues() {
    const allVenues = await Venue.find({ isActive: { $ne: false } }).lean();
    const venueMap = new Map();
    // Group venues by normalized name
    for (const venue of allVenues) {
        const normalizedName = normalizeVenueName(venue.name);
        if (!venueMap.has(normalizedName)) {
            venueMap.set(normalizedName, []);
        }
        venueMap.get(normalizedName).push(venue);
    }
    // Find duplicates (venues with same normalized name)
    const duplicates = [];
    for (const [normalizedName, venues] of venueMap.entries()) {
        if (venues.length > 1) {
            duplicates.push({
                normalizedName,
                venues: venues.sort((a, b) => {
                    // Sort by: has coordinates, then by country match
                    const aHasCoords = !!(a.coordinates || a.location?.coordinates);
                    const bHasCoords = !!(b.coordinates || b.location?.coordinates);
                    if (aHasCoords !== bHasCoords) {
                        return bHasCoords ? 1 : -1;
                    }
                    return 0;
                })
            });
        }
    }
    return duplicates;
}
/**
 * Analyze duplicates and identify which ones to keep/remove
 */
function analyzeDuplicates(duplicates) {
    const issues = [];
    for (const { normalizedName, venues } of duplicates) {
        const validVenues = [];
        const invalidVenues = [];
        const noCoordsVenues = [];
        for (const venue of venues) {
            const coordinates = venue.coordinates || venue.location?.coordinates;
            if (!coordinates) {
                noCoordsVenues.push(venue);
                continue;
            }
            if (isWithinCountryBounds(coordinates, venue.country)) {
                validVenues.push(venue);
            } else {
                invalidVenues.push(venue);
            }
        }
        // Only report if there are issues (invalid coordinates or multiple valid ones)
        if (invalidVenues.length > 0 || (validVenues.length > 1 && noCoordsVenues.length === 0)) {
            issues.push({
                normalizedName,
                validVenues,
                invalidVenues,
                noCoordsVenues,
                total: venues.length
            });
        }
    }
    return issues;
}
/**
 * Fix duplicate venues
 */
async function fixDuplicates(issues, dryRun = true) {
    let fixedCount = 0;
    let deletedCount = 0;
    let keptCount = 0;
    for (const issue of issues) {
        // Strategy 1: If we have valid venues, delete invalid ones
        if (issue.validVenues.length > 0 && issue.invalidVenues.length > 0) {
            for (const invalidVenue of issue.invalidVenues) {
                const coords = invalidVenue.coordinates || invalidVenue.location?.coordinates;
                const [lon, lat] = coords || [null, null];
                if (!dryRun) {
                    await Venue.deleteOne({ _id: invalidVenue._id });
                    deletedCount++;
                } else {
                    deletedCount++;
                }
            }
            // Keep the first valid venue (prefer one with venueId if available)
            const validVenue = issue.validVenues.find(v => v.venueId) || issue.validVenues[0];
            keptCount++;
        }
        // Strategy 2: If we have multiple valid venues, keep the best one
        else if (issue.validVenues.length > 1) {
            // Prefer venue with venueId, then most complete data
            const sortedValid = issue.validVenues.sort((a, b) => {
                if (!!a.venueId !== !!b.venueId) return b.venueId ? 1 : -1;
                const aCompleteness = (a.capacity ? 1 : 0) + (a.address ? 1 : 0) + (a.image ? 1 : 0);
                const bCompleteness = (b.capacity ? 1 : 0) + (b.address ? 1 : 0) + (b.image ? 1 : 0);
                return bCompleteness - aCompleteness;
            });
            const keepVenue = sortedValid[0];
            const removeVenues = sortedValid.slice(1);
            for (const removeVenue of removeVenues) {
                if (!dryRun) {
                    await Venue.deleteOne({ _id: removeVenue._id });
                    deletedCount++;
                } else {
                    deletedCount++;
                }
            }
            keptCount++;
        }
        // Strategy 3: If we only have invalid venues, try to fix them
        else if (issue.invalidVenues.length > 0 && issue.validVenues.length === 0) {
            for (const invalidVenue of issue.invalidVenues) {
                const coords = invalidVenue.coordinates || invalidVenue.location?.coordinates;
                const [lon, lat] = coords || [null, null];
            }
        }
        // Strategy 4: If we have no coords venues and valid venues, delete no coords ones
        if (issue.noCoordsVenues.length > 0 && issue.validVenues.length > 0) {
            for (const noCoordsVenue of issue.noCoordsVenues) {
                if (!dryRun) {
                    await Venue.deleteOne({ _id: noCoordsVenue._id });
                    deletedCount++;
                } else {
                    deletedCount++;
                }
            }
        }
    }
    if (dryRun) {
    } else {
    }
}
/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run') || args.includes('-d');
    try {
        const MONGODB_URI = process.env.MONGODB_URI;
        if (!MONGODB_URI) {
            console.error('❌ MONGODB_URI environment variable is required');
            process.exit(1);
        }
        await mongoose.connect(MONGODB_URI);
        // Find duplicates
        const duplicates = await findDuplicateVenues();
        if (duplicates.length === 0) {
            await mongoose.disconnect();
            return;
        }
        // Analyze duplicates
        const issues = analyzeDuplicates(duplicates);
        if (issues.length === 0) {
            await mongoose.disconnect();
            return;
        }
        // Show summary
        for (const issue of issues.slice(0, 10)) { // Show first 10
        }
        if (issues.length > 10) {
        }
        // Fix duplicates
        await fixDuplicates(issues, dryRun);
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}
// Run if called directly
if (require.main === module) {
    main();
}
module.exports = { findDuplicateVenues, analyzeDuplicates, fixDuplicates };
