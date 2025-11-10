require('dotenv').config();

const express = require('express');
const axios = require('axios');
const https = require('https');
const router = express.Router();
const transportationService = require('../services/transportationService');

// Create HTTPS agent with SSL certificate check disabled (for development only)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Add common configuration for Google API requests
const googleApiConfig = {
    headers: {
        'Referer': 'http://localhost:3000'
    },
    httpsAgent
};

// Note: Amadeus token management is now handled by the AmadeusProvider class

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

// Search airports by keyword
router.get('/airports/search', async (req, res) => {
    try {
        const { query, limit = 10 } = req.query;

        if (!query) {
            return res.status(400).json({
                error: 'Missing required parameter',
                message: 'query parameter is required'
            });
        }

        const airports = await transportationService.searchAirports(query, Number(limit));

        res.json({
            success: true,
            data: airports,
            count: airports.length
        });
    } catch (error) {
        console.error('Error searching airports:', error);
        res.status(500).json({ 
            error: 'Failed to search airports',
            message: error.message
        });
    }
});

// Get nearest airport
router.get('/airports/nearest', async (req, res) => {
    try {
        const { latitude, longitude, radius = 100, limit = 3 } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                error: 'Missing required parameters',
                message: 'latitude and longitude are required'
            });
        }

        console.log('Searching for airports:', {
            latitude,
            longitude,
            radius,
            limit
        });

        const airports = await transportationService.getNearestAirports(
            Number(latitude),
            Number(longitude),
            Number(radius),
            Number(limit)
        );

        // Log found airports
        if (airports.length > 0) {
            console.log('Found airports:', airports.map(airport => ({
                code: airport.code,
                name: airport.name,
                distance: airport.distance
            })));
        }

        res.json({
            success: true,
            data: airports,
            count: airports.length
        });
    } catch (error) {
        console.error('Error fetching nearest airports:', {
            error: error.message
        });
        res.status(500).json({ 
            error: 'Failed to fetch nearest airports',
            message: error.message
        });
    }
});

// Search flights
router.get('/flights/search', async (req, res) => {
    try {
        const { 
            origin, 
            destination, 
            departureDate, 
            returnDate,
            adults = 1, 
            max = 10,
            currency = 'USD',
            nonStop = false
        } = req.query;

        // Validate parameters
        if (!origin || !destination || !departureDate) {
            return res.status(400).json({
                error: 'Missing required parameters',
                message: 'origin, destination, and departureDate are required'
            });
        }

        // Validate that origin and destination are different
        if (origin === destination) {
            return res.status(400).json({
                error: 'Invalid route',
                message: 'Origin and destination airports must be different'
            });
        }

        console.log('Searching flights with params:', {
            origin,
            destination,
            departureDate,
            returnDate,
            adults: Number(adults),
            max: Number(max),
            currency,
            nonStop: nonStop === 'true' || nonStop === true
        });

        // Use transportation service
        const result = await transportationService.searchFlights({
            origin,
            destination,
            departureDate,
            returnDate,
            adults: Number(adults),
            max: Number(max),
            currency,
            nonStop: nonStop === 'true' || nonStop === true
        });

        res.json({
            success: true,
            provider: result.provider,
            data: result.results,
            count: result.count
        });
    } catch (error) {
        console.error('Error searching flights:', {
            error: error.message,
            params: req.query
        });

        res.status(500).json({ 
            error: 'Failed to search flights',
            message: error.message
        });
    }
});

// Get flight status by flight number and date
router.get('/flights/status', async (req, res) => {
    try {
        const { flightNumber, date } = req.query;

        // Validate parameters
        if (!flightNumber || !date) {
            return res.status(400).json({
                error: 'Missing required parameters',
                message: 'flightNumber and date are required'
            });
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({
                error: 'Invalid date format',
                message: 'Date must be in YYYY-MM-DD format'
            });
        }

        console.log('Getting flight status:', {
            flightNumber,
            date
        });

        // Use transportation service
        const result = await transportationService.getFlightStatus(flightNumber, date);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error getting flight status:', {
            error: error.message,
            params: req.query
        });

        res.status(500).json({ 
            error: 'Failed to get flight status',
            message: error.message
        });
    }
});

// Get route cost history
router.get('/routes/cost-history', async (req, res) => {
    try {
        const { origin, destination, type = 'flight', currency = 'USD' } = req.query;

        if (!origin || !destination) {
            return res.status(400).json({
                error: 'Missing required parameters',
                message: 'origin and destination are required'
            });
        }

        const history = await transportationService.getRouteCostHistory(
            origin,
            destination,
            type,
            currency
        );

        if (!history) {
            return res.json({
                success: true,
                data: null,
                message: 'No cost history found for this route'
            });
        }

        res.json({
            success: true,
            data: {
                origin: history.origin,
                destination: history.destination,
                type: history.type,
                currency: history.currency,
                priceHistory: history.priceHistory,
                statistics: history.statistics,
                lastSearched: history.lastSearched,
                searchCount: history.searchCount
            }
        });
    } catch (error) {
        console.error('Error getting route cost history:', error);
        res.status(500).json({ 
            error: 'Failed to get route cost history',
            message: error.message
        });
    }
});

module.exports = router; 