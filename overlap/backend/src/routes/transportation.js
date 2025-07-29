require('dotenv').config();

const express = require('express');
const axios = require('axios');
const https = require('https');
const router = express.Router();

// Create HTTPS agent with SSL certificate check disabled (for development only)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});



// Cache for Amadeus token
let amadeusToken = null;
let tokenExpiration = null;

// Add common configuration for Google API requests
const googleApiConfig = {
    headers: {
        'Referer': 'http://localhost:3000'
    },
    httpsAgent
};

// Get Amadeus token
const getAmadeusToken = async () => {
    if (amadeusToken && tokenExpiration && new Date() < tokenExpiration) {
        return amadeusToken;
    }

    try {
        const response = await axios.post(
            'https://test.api.amadeus.com/v1/security/oauth2/token',
            `grant_type=client_credentials&client_id=${process.env.AMADEUS_CLIENT_ID}&client_secret=${process.env.AMADEUS_CLIENT_SECRET}`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                httpsAgent
            }
        );

        amadeusToken = response.data.access_token;
        tokenExpiration = new Date(Date.now() + response.data.expires_in * 1000);
        return amadeusToken;
    } catch (error) {

        throw error;
    }
};

// Verify Google API key on startup
const verifyGoogleApiKey = () => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        return false;
    }
    return true;
};

// Call verification on module load
verifyGoogleApiKey();

// Get driving directions
router.get('/directions/driving', async (req, res) => {
    try {
        const { origin, destination } = req.query;
        if (!process.env.GOOGLE_API_KEY) {
            throw new Error('Google API key is not configured');
        }



        const response = await axios.get(
            'https://maps.googleapis.com/maps/api/directions/json',
            {
                params: {
                    origin,
                    destination,
                    key: process.env.GOOGLE_API_KEY
                },
                ...googleApiConfig
            }
        );

        if (response.data.status === 'REQUEST_DENIED') {
            console.error('Google API request denied:', response.data.error_message);
            throw new Error(response.data.error_message || 'Request denied by Google API');
        }

        if (response.data.status === 'OK') {
            const route = response.data.routes[0].legs[0];

        } else {

        }

        res.json(response.data);
    } catch (error) {

        res.status(500).json({ 
            error: 'Failed to fetch driving directions',
            details: error.message
        });
    }
});

// Get walking directions
router.get('/directions/walking', async (req, res) => {
    try {
        const { origin, destination } = req.query;
        if (!process.env.GOOGLE_API_KEY) {
            throw new Error('Google API key is not configured');
        }



        const response = await axios.get(
            'https://maps.googleapis.com/maps/api/directions/json',
            {
                params: {
                    origin,
                    destination,
                    mode: 'walking',
                    key: process.env.GOOGLE_API_KEY
                },
                ...googleApiConfig
            }
        );

        if (response.data.status === 'REQUEST_DENIED') {
            console.error('Google API request denied:', response.data.error_message);
            throw new Error(response.data.error_message || 'Request denied by Google API');
        }

        if (response.data.status === 'OK') {
            const route = response.data.routes[0].legs[0];

        } else {

        }

        res.json(response.data);
    } catch (error) {

        res.status(500).json({ 
            error: 'Failed to fetch walking directions',
            details: error.message
        });
    }
});

// Get transit directions
router.get('/directions/transit', async (req, res) => {
    try {
        const { origin, destination } = req.query;
        if (!process.env.GOOGLE_API_KEY) {
            throw new Error('Google API key is not configured');
        }



        const response = await axios.get(
            'https://maps.googleapis.com/maps/api/directions/json',
            {
                params: {
                    origin,
                    destination,
                    mode: 'transit',
                    alternatives: true,
                    transit_mode: 'train|bus|subway|tram',
                    key: process.env.GOOGLE_API_KEY
                },
                ...googleApiConfig
            }
        );

        if (response.data.status === 'REQUEST_DENIED') {
            console.error('Google API request denied:', response.data.error_message);
            throw new Error(response.data.error_message || 'Request denied by Google API');
        }

        if (response.data.status === 'OK') {
            const route = response.data.routes[0].legs[0];
            const transitModes = new Set();
            route.steps.forEach(step => {
                if (step.travel_mode === 'TRANSIT' && step.transit_details?.line?.vehicle?.type) {
                    transitModes.add(step.transit_details.line.vehicle.type.toLowerCase());
                }
            });

            console.log('Transit route found:', {
                distance: route.distance.text,
                duration: route.duration.text,
                steps: route.steps.length,
                transitModes: Array.from(transitModes)
            });
        } else {
            console.log('No transit route found:', {
                status: response.data.status,
                error: response.data.error_message
            });
        }

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching transit directions:', {
            error: error.message,
            googleApiKey: process.env.GOOGLE_API_KEY ? 'Configured' : 'Missing'
        });
        res.status(500).json({ 
            error: 'Failed to fetch transit directions',
            details: error.message
        });
    }
});

// Get intercity rail directions
router.get('/directions/rail', async (req, res) => {
    try {
        const { origin, destination, date } = req.query;
        


        // For now, return a structured response that matches our transportation option format
        // This will make it easy to integrate real rail APIs later
        res.json({
            status: 'OK',
            routes: [{
                legs: [{
                    distance: { text: 'Distance unavailable' },
                    duration: { text: 'Duration unavailable' },
                    steps: [],
                    rail_services: {
                        available: false,
                        message: 'Rail service API not yet integrated'
                    }
                }]
            }]
        });
    } catch (error) {
        console.error('Error fetching rail directions:', {
            error: error.message,
            params: req.query
        });
        res.status(500).json({ 
            error: 'Failed to fetch rail directions',
            details: error.message
        });
    }
});

// Get nearest airport
router.get('/airports/nearest', async (req, res) => {
    try {
        const { latitude, longitude, radius = 100, limit = 3 } = req.query;
        const token = await getAmadeusToken();
        
        console.log('Searching for airports:', {
            latitude,
            longitude,
            radius,
            limit
        });

        const response = await axios.get(
            'https://test.api.amadeus.com/v1/reference-data/locations/airports',
            {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                params: {
                    latitude,
                    longitude,
                    radius: Number(radius),
                    'page[limit]': Number(limit),
                    sort: 'distance'
                },
                httpsAgent
            }
        );

        // Log found airports
        if (response.data.data) {
            console.log('Found airports:', response.data.data.map(airport => ({
                iataCode: airport.iataCode,
                name: airport.name,
                distance: airport.distance?.value
            })));
        }

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching nearest airports:', {
            error: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        res.status(500).json({ 
            error: 'Failed to fetch nearest airports',
            message: error.message,
            details: error.response?.data
        });
    }
});

// Search flights
router.get('/flights/search', async (req, res) => {
    try {
        const { originCode, destinationCode, date, adults = 1, max = 1 } = req.query;

        // Validate parameters
        if (!originCode || !destinationCode || !date) {
            return res.status(400).json({
                error: 'Missing required parameters',
                message: 'originCode, destinationCode, and date are required'
            });
        }

        // Validate that origin and destination are different
        if (originCode === destinationCode) {
            return res.status(400).json({
                error: 'Invalid route',
                message: 'Origin and destination airports must be different'
            });
        }

        // Get fresh token
        const token = await getAmadeusToken();
        
        console.log('Searching flights with params:', {
            originCode,
            destinationCode,
            date,
            adults: Number(adults),
            max: Number(max)
        });

        const response = await axios.get(
            'https://test.api.amadeus.com/v2/shopping/flight-offers',
            {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                params: {
                    originLocationCode: originCode,
                    destinationLocationCode: destinationCode,
                    departureDate: date,
                    adults: Number(adults),
                    max: Number(max),
                    currencyCode: 'USD'
                },
                httpsAgent
            }
        );

        // If no flights found, return empty array instead of error
        if (!response.data.data || response.data.data.length === 0) {
            return res.json({ data: [] });
        }

        res.json(response.data);
    } catch (error) {
        console.error('Error searching flights:', {
            error: error.message,
            response: error.response?.data,
            status: error.response?.status,
            params: req.query
        });

        // Handle specific Amadeus API errors
        if (error.response?.data?.errors) {
            return res.status(error.response.status).json({
                error: 'Amadeus API Error',
                message: error.response.data.errors[0]?.detail || 'Unknown API error',
                details: error.response.data.errors
            });
        }

        res.status(500).json({ 
            error: 'Failed to search flights',
            message: error.message
        });
    }
});

module.exports = router; 