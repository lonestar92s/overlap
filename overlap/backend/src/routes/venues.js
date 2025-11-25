const express = require('express');
const Venue = require('../models/Venue');
const axios = require('axios');
const https = require('https');

const router = express.Router();

// API-Sports configuration
const API_SPORTS_KEY = process.env.API_SPORTS_KEY;
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

/**
 * GET /api/venues/search
 * Search venues by name, city, or country
 * Returns results from database first, then falls back to API if needed
 */
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;
        
        // Sanitize and validate query input
        const { sanitizeSearchQuery } = require('../utils/security');
        const validation = sanitizeSearchQuery(query, 100);
        
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: validation.error || 'Invalid search query'
            });
        }

        const sanitizedQuery = validation.sanitized;

        // Search in database
        const dbVenues = await Venue.find({
            $or: [
                { name: { $regex: sanitizedQuery, $options: 'i' } },
                { city: { $regex: sanitizedQuery, $options: 'i' } },
                { country: { $regex: sanitizedQuery, $options: 'i' } },
                { aliases: { $regex: sanitizedQuery, $options: 'i' } }
            ],
            isActive: true
        })
        .select('name venueId city country countryCode capacity image coordinates location')
        .limit(20);

        // Format database results
        const formattedVenues = dbVenues.map(venue => ({
            id: venue.venueId,
            name: venue.name,
            city: venue.city,
            country: venue.country,
            countryCode: venue.countryCode,
            capacity: venue.capacity,
            image: venue.image,
            coordinates: venue.coordinates || venue.location?.coordinates || null
        }));

        // If we have good results from DB, return them
        if (dbVenues.length >= 5) {
            return res.json({
                success: true,
                results: formattedVenues,
                count: formattedVenues.length,
                source: 'database'
            });
        }

        // Otherwise, try API-Sports (if API key is available)
        if (API_SPORTS_KEY) {
            try {
                const apiResponse = await axios.get(`${API_SPORTS_BASE_URL}/venues`, {
                    params: { search: query },
                    headers: {
                        'x-apisports-key': API_SPORTS_KEY
                    },
                    httpsAgent,
                    timeout: 10000
                });

                const apiVenues = apiResponse.data.response || [];
                
                // Save API venues to database (on-demand caching)
                if (apiVenues.length > 0) {
                    // Use setImmediate to avoid blocking the response
                    setImmediate(async () => {
                        try {
                            for (const venueData of apiVenues) {
                                try {
                                    // Check if venue already exists
                                    const existingVenue = await Venue.findOne({ venueId: venueData.id });
                                    
                                    if (!existingVenue) {
                                        // Extract coordinates
                                        let coordinates = null;
                                        let location = null;
                                        
                                        if (venueData.lat && venueData.lng) {
                                            coordinates = [parseFloat(venueData.lng), parseFloat(venueData.lat)];
                                            location = {
                                                type: 'Point',
                                                coordinates: coordinates
                                            };
                                        }

                                        await Venue.create({
                                            venueId: venueData.id,
                                            name: venueData.name,
                                            city: venueData.city || '',
                                            country: venueData.country || '',
                                            countryCode: getCountryCode(venueData.country || ''),
                                            address: venueData.address || '',
                                            capacity: venueData.capacity || null,
                                            surface: venueData.surface || null,
                                            image: venueData.image || null,
                                            coordinates: coordinates,
                                            location: location,
                                            isActive: true,
                                            lastUpdated: new Date()
                                        });
                                        
                                        console.log(`💾 Saved new venue to DB: ${venueData.name}`);
                                    }
                                } catch (saveError) {
                                    // Ignore save errors (might be duplicates, etc.)
                                    console.log(`⚠️ Could not save venue ${venueData.name}: ${saveError.message}`);
                                }
                            }
                        } catch (bulkError) {
                            console.error('Error saving API venues to DB:', bulkError.message);
                        }
                    });
                }

                // Format API results
                const apiFormattedVenues = apiVenues.map(venue => ({
                    id: venue.id,
                    name: venue.name,
                    city: venue.city || '',
                    country: venue.country || '',
                    countryCode: getCountryCode(venue.country || ''),
                    capacity: venue.capacity || null,
                    image: venue.image || null,
                    coordinates: venue.lat && venue.lng 
                        ? [parseFloat(venue.lng), parseFloat(venue.lat)]
                        : null
                }));

                // Combine and deduplicate results
                const allVenues = [
                    ...formattedVenues.map(v => ({ ...v, source: 'database' })),
                    ...apiFormattedVenues.map(v => ({ ...v, source: 'api' }))
                ];

                // Remove duplicates based on venue ID
                const uniqueVenues = Array.from(
                    new Map(allVenues.map(venue => [venue.id, venue])).values()
                ).slice(0, 20);

                return res.json({
                    success: true,
                    results: uniqueVenues,
                    count: uniqueVenues.length,
                    source: 'mixed'
                });

            } catch (apiError) {
                // If API call fails, return database results
                console.error('API search failed:', apiError.message);
                return res.json({
                    success: true,
                    results: formattedVenues,
                    count: formattedVenues.length,
                    source: 'database'
                });
            }
        } else {
            // No API key, just return database results
            return res.json({
                success: true,
                results: formattedVenues,
                count: formattedVenues.length,
                source: 'database'
            });
        }

    } catch (error) {
        console.error('Venue search error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search venues'
        });
    }
});

// Helper function to get country code
function getCountryCode(countryName) {
    const mapping = {
        'England': 'GB',
        'Spain': 'ES',
        'Germany': 'DE',
        'France': 'FR',
        'Italy': 'IT',
        'Portugal': 'PT',
        'Netherlands': 'NL',
        'Belgium': 'BE',
        'Turkey': 'TR',
        'Scotland': 'GB',
        'Switzerland': 'CH',
        'USA': 'US',
        'United States': 'US',
        'Brazil': 'BR',
        'Mexico': 'MX',
        'Saudi Arabia': 'SA',
        'Japan': 'JP',
        'Europe': 'INT',
        'International': 'INT'
    };
    return mapping[countryName] || 'INT';
}

module.exports = router;

