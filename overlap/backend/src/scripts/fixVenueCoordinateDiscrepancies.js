/**
 * Fix venue coordinate discrepancies from venue-city-discrepancies.json
 *
 * Rule 1: If swapped (lat/lon) coordinates place the venue in the correct city
 *         (within 15km of geocoded), update the database.
 * Rule 2: Otherwise, log to manual-review.json for manual inspection.
 *
 * Apply geocoded coords (from initial check - no new API calls):
 *   Uses stored geocoded coords to fix venues. Updates Railway MongoDB when
 *   MONGO_URL/MONGODB_URI points to Railway.
 *
 * Run:
 *   node src/scripts/fixVenueCoordinateDiscrepancies.js [--dry-run]              # Swap fix preview
 *   node src/scripts/fixVenueCoordinateDiscrepancies.js --apply                   # Apply swap fixes
 *   node src/scripts/fixVenueCoordinateDiscrepancies.js --apply-geocoded         # Preview geocoded fix
 *   node src/scripts/fixVenueCoordinateDiscrepancies.js --apply-geocoded --apply  # Apply geocoded
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const venueService = require('../services/venueService');

const DISCREPANCIES_PATH = path.join(__dirname, '../../venue-city-discrepancies.json');
const MANUAL_REVIEW_PATH = path.join(__dirname, '../../venue-manual-review.json');
const SWAP_FIX_THRESHOLD_KM = 15;

/**
 * Haversine distance in km
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
 * Process discrepancies: try swap, auto-fix or add to manual review
 */
async function processDiscrepancies(discrepancies, dryRun) {
    const toFix = [];
    const manualReview = [];

    for (const d of discrepancies) {
        const hasGeocoded = d.geocodedLat != null && d.geocodedLon != null;

        if (!hasGeocoded) {
            manualReview.push({
                ...d,
                fixAction: 'manual_review',
                reason: 'No geocoded coords to verify swap (geocode failed)'
            });
            continue;
        }

        // Swapped: treat stored as [lat, lon], swap to [lon, lat]
        // Stored in DB is [lon, lat], so storedLon, storedLat.
        // If they were entered as [lat, lon], then swap = [storedLat, storedLon] as [lon, lat]
        const swappedLon = d.storedLat;
        const swappedLat = d.storedLon;
        const swappedCoords = [swappedLon, swappedLat];

        const distanceToGeocoded = calculateDistanceKm(
            swappedLat, swappedLon,
            d.geocodedLat, d.geocodedLon
        );

        if (distanceToGeocoded <= SWAP_FIX_THRESHOLD_KM) {
            const inBounds = venueService.isWithinCountryBounds(swappedCoords, d.country);
            if (inBounds) {
                toFix.push({
                    ...d,
                    swappedLon,
                    swappedLat,
                    swappedDistanceKm: Math.round(distanceToGeocoded * 100) / 100,
                    fixAction: 'auto_fix_swap'
                });
            } else {
                manualReview.push({
                    ...d,
                    swappedLon,
                    swappedLat,
                    swappedDistanceKm: Math.round(distanceToGeocoded * 100) / 100,
                    fixAction: 'manual_review',
                    reason: 'Swapped coords within city but outside country bounds'
                });
            }
        } else {
            manualReview.push({
                ...d,
                swappedLon,
                swappedLat,
                swappedDistanceKm: Math.round(distanceToGeocoded * 100) / 100,
                fixAction: 'manual_review',
                reason: `Swapped coords ${distanceToGeocoded.toFixed(1)}km from city (threshold ${SWAP_FIX_THRESHOLD_KM}km)`,
                geocodedAvailable: true
            });
        }
    }

    return { toFix, manualReview };
}

/**
 * Apply fixes to MongoDB
 */
async function applyFixes(toFix, dryRun) {
    let fixed = 0;
    let failed = 0;

    for (const item of toFix) {
        const venue = await Venue.findOne({ venueId: item.venueId });
        if (!venue) {
            console.warn(`   ⚠️ Venue not found: ${item.name} (venueId ${item.venueId})`);
            failed++;
            continue;
        }

        const newCoords = [item.swappedLon, item.swappedLat];

        if (dryRun) {
            console.log(`   [DRY-RUN] Would fix: ${item.name} (${item.city})`);
            console.log(`      Old: [${item.storedLon?.toFixed(6)}, ${item.storedLat?.toFixed(6)}]`);
            console.log(`      New: [${item.swappedLon?.toFixed(6)}, ${item.swappedLat?.toFixed(6)}]`);
            fixed++;
        } else {
            venue.coordinates = newCoords;
            venue.location = { type: 'Point', coordinates: newCoords };
            venue.lastUpdated = new Date();
            await venue.save();
            fixed++;
        }
    }

    return { fixed, failed };
}

/**
 * Apply geocoded coordinates from manual-review.json (no API calls - uses cached data)
 */
async function applyGeocodedFromManualReview(dryRun) {
    if (!fs.existsSync(MANUAL_REVIEW_PATH)) {
        console.error(`❌ Manual review file not found: ${MANUAL_REVIEW_PATH}`);
        console.error('   Run fixVenueCoordinateDiscrepancies.js first (without --apply-geocoded).');
        process.exit(1);
    }

    const manualReview = JSON.parse(fs.readFileSync(MANUAL_REVIEW_PATH, 'utf8'));
    const toFix = manualReview.filter(d => d.geocodedLat != null && d.geocodedLon != null);
    const skipped = manualReview.length - toFix.length;

    console.log(`\n📋 Loaded ${manualReview.length} from manual-review.json`);
    console.log(`   With geocoded coords: ${toFix.length}`);
    console.log(`   Skipped (geocode failed): ${skipped}\n`);

    if (toFix.length === 0) {
        console.log('   No venues to fix.\n');
        return;
    }

    const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGO_PUBLIC_URL;
    if (!mongoUri) {
        console.error('❌ MONGODB_URI, MONGO_URL, or MONGO_PUBLIC_URL required');
        process.exit(1);
    }

    if (dryRun) {
        console.log(`   Sample fixes (first 5):\n`);
        for (let i = 0; i < Math.min(5, toFix.length); i++) {
            const item = toFix[i];
            console.log(`   [DRY-RUN] Would fix: ${item.name} (${item.city})`);
            console.log(`      Old: [${item.storedLon?.toFixed(6)}, ${item.storedLat?.toFixed(6)}]`);
            console.log(`      New: [${item.geocodedLon?.toFixed(6)}, ${item.geocodedLat?.toFixed(6)}]`);
        }
        console.log(`\n[DRY-RUN] Would fix ${toFix.length} venues with geocoded coords.`);
        console.log(`   Run with --apply-geocoded --apply to apply.\n`);
    } else {
        await mongoose.connect(mongoUri);
        const dbName = mongoose.connection.db?.databaseName || 'unknown';
        console.log(`🔗 Connected to MongoDB: ${dbName}\n`);

        let fixed = 0;
        let failed = 0;

        for (const item of toFix) {
            const venue = await Venue.findOne({ venueId: item.venueId });
            if (!venue) {
                console.warn(`   ⚠️ Venue not found: ${item.name} (venueId ${item.venueId})`);
                failed++;
                continue;
            }

            const newCoords = [item.geocodedLon, item.geocodedLat];
            venue.coordinates = newCoords;
            venue.location = { type: 'Point', coordinates: newCoords };
            venue.lastUpdated = new Date();
            await venue.save();
            fixed++;
        }

        await mongoose.disconnect();
        console.log(`\n✅ Fixed ${fixed} venues. Failed: ${failed}\n`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const applyGeocoded = args.includes('--apply-geocoded');
    const dryRun = !args.includes('--apply');

    if (applyGeocoded) {
        await applyGeocodedFromManualReview(dryRun);
        return;
    }

    if (!fs.existsSync(DISCREPANCIES_PATH)) {
        console.error(`❌ Discrepancies file not found: ${DISCREPANCIES_PATH}`);
        console.error('   Run checkVenuesCityAsSourceOfTruth.js first.');
        process.exit(1);
    }

    const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.MONGO_PUBLIC_URL;
    if (!mongoUri) {
        console.error('❌ MONGODB_URI, MONGO_URL, or MONGO_PUBLIC_URL required');
        process.exit(1);
    }

    const discrepancies = JSON.parse(fs.readFileSync(DISCREPANCIES_PATH, 'utf8'));
    console.log(`\n📋 Loaded ${discrepancies.length} discrepancies\n`);

    const { toFix, manualReview } = await processDiscrepancies(discrepancies, dryRun);

    console.log(`✅ Auto-fix (swap): ${toFix.length}`);
    console.log(`📝 Manual review:   ${manualReview.length}\n`);

    if (toFix.length > 0) {
        await mongoose.connect(mongoUri);
        const { fixed, failed } = await applyFixes(toFix, dryRun);
        await mongoose.disconnect();

        if (dryRun) {
            console.log(`\n[DRY-RUN] Would fix ${fixed} venues. Run with --apply to apply.\n`);
        } else {
            console.log(`\n✅ Fixed ${fixed} venues. Failed: ${failed}\n`);
        }
    }

    fs.writeFileSync(MANUAL_REVIEW_PATH, JSON.stringify(manualReview, null, 2));
    console.log(`📄 Manual review list saved to: ${MANUAL_REVIEW_PATH}\n`);
}

main().catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
});
