const express = require('express');
const { auth, authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const axios = require('axios');
const https = require('https');
const { isTripCompleted } = require('../utils/tripUtils');
const geocodingService = require('../services/geocodingService');

const router = express.Router();

// API-Sports configuration
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';
const API_SPORTS_KEY = process.env.API_SPORTS_KEY;

// HTTPS agent for Google API requests
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Google API configuration
const googleApiConfig = {
    headers: {
        'Referer': 'http://localhost:3000'
    },
    httpsAgent
};

// Get all trips for the authenticated user (or empty array if not authenticated)
// Supports query parameter: ?status=active|completed (optional)
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (!req.user) {
            // No user authenticated, return empty trips array
            return res.json({
                success: true,
                trips: []
            });
        }
        
        const user = await User.findById(req.user.id).select('trips');
        let trips = user.trips;
        
        // Filter by completion status if requested
        const statusFilter = req.query.status; // 'active' | 'completed'
        
        if (statusFilter === 'completed') {
            // Return only completed trips (all matches finished)
            trips = trips.filter(trip => isTripCompleted(trip));
        } else if (statusFilter === 'active') {
            // Return only active trips (has uncompleted matches)
            trips = trips.filter(trip => !isTripCompleted(trip));
        }
        // No filter = return all trips (backward compatible)
        
        // Sort trips by creation date (most recent first)
        trips = trips.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Add computed isCompleted field for frontend convenience
        // Convert to plain objects to add the computed field
        trips = trips.map(trip => {
            const tripObj = trip.toObject ? trip.toObject() : trip;
            return {
                ...tripObj,
                isCompleted: isTripCompleted(trip)
            };
        });
        
        res.json({
            success: true,
            trips: trips
        });
    } catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch trips'
        });
    }
});

// Get a specific trip by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('trips');
        const trip = user.trips.id(req.params.id);
        
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }
        
        // Add computed isCompleted field for frontend convenience
        const tripObj = trip.toObject ? trip.toObject() : trip;
        const tripWithStatus = {
            ...tripObj,
            isCompleted: isTripCompleted(trip)
        };
        
        res.json({
            success: true,
            trip: tripWithStatus
        });
    } catch (error) {
        console.error('Error fetching trip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch trip'
        });
    }
});

// Create a new trip (works without authentication)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, description, notes, matches, flights, startDate, endDate } = req.body;
        
        // Auto-generate trip name from flights if not provided
        let tripName = name?.trim();
        if (!tripName && flights && flights.length > 0) {
            const firstFlight = flights[0];
            const lastFlight = flights[flights.length - 1];
            const origin = firstFlight.departure?.airport?.code || 'Origin';
            const destination = lastFlight.arrival?.airport?.code || 'Destination';
            tripName = `${origin} to ${destination} Trip`;
        }
        
        if (!tripName) {
            return res.status(400).json({
                success: false,
                message: 'Trip name is required'
            });
        }

        // Auto-calculate dates from matches if not provided
        let calculatedStartDate = startDate ? new Date(startDate) : null;
        let calculatedEndDate = endDate ? new Date(endDate) : null;
        
        if (!calculatedStartDate && matches && matches.length > 0) {
            const matchDates = matches
                .map(m => m.date ? new Date(m.date) : null)
                .filter(d => d && !isNaN(d.getTime()))
                .sort((a, b) => a - b);
            
            if (matchDates.length > 0) {
                calculatedStartDate = matchDates[0];
                calculatedEndDate = matchDates[matchDates.length - 1];
            }
        }

        if (!req.user) {
            // No user authenticated - create a temporary trip response
            // In a real app, you might want to store this locally or create a guest session
            const tempTrip = {
                _id: `temp_${Date.now()}`,
                name: tripName,
                description: description || '',
                notes: notes || '',
                startDate: calculatedStartDate,
                endDate: calculatedEndDate,
                flights: flights || [],
                matches: matches || [],
                createdAt: new Date(),
                updatedAt: new Date(),
                isTemporary: true
            };

            return res.status(201).json({
                success: true,
                trip: tempTrip,
                message: 'Trip created (temporary - not saved to database)'
            });
        }

        // User is authenticated - save to database
        const user = await User.findById(req.user.id);
        
        const newTrip = {
            name: tripName,
            description: description || '',
            notes: notes || '',
            startDate: calculatedStartDate,
            endDate: calculatedEndDate,
            flights: flights || [],
            matches: matches || [],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        user.trips.push(newTrip);
        await user.save();

        // Return the newly created trip
        const createdTrip = user.trips[user.trips.length - 1];

        res.status(201).json({
            success: true,
            trip: createdTrip,
            message: 'Trip created successfully'
        });
    } catch (error) {
        console.error('Error creating trip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create trip'
        });
    }
});

// Update a trip
router.put('/:id', auth, async (req, res) => {
    try {
        const { name, description, notes, startDate, endDate } = req.body;
        
        const user = await User.findById(req.user.id);
        const trip = user.trips.id(req.params.id);
        
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }

        // Update allowed fields
        if (name !== undefined) trip.name = name.trim();
        if (description !== undefined) trip.description = description;
        if (notes !== undefined) trip.notes = notes;
        if (startDate !== undefined) trip.startDate = startDate ? new Date(startDate) : null;
        if (endDate !== undefined) trip.endDate = endDate ? new Date(endDate) : null;
        trip.updatedAt = new Date();

        await user.save();

        res.json({
            success: true,
            trip: trip,
            message: 'Trip updated successfully'
        });
    } catch (error) {
        console.error('Error updating trip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update trip'
        });
    }
});

// Delete a trip
router.delete('/:id', auth, async (req, res) => {
    try {
        // Use req.user._id for consistency (auth middleware sets req.user to full user document)
        const userId = req.user._id || req.user.id;
        if (!userId) {
            console.error('Delete trip: User ID not found in req.user');
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            console.error('Delete trip: User not found in database:', userId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const tripId = req.params.id;
        console.log('Delete trip: Attempting to delete trip:', { tripId, userId, userTripsCount: user.trips.length });

        // Try to find the trip by ID (Mongoose subdocument lookup)
        let trip = user.trips.id(tripId);
        
        // If not found, try finding by matching _id string (handles ID format mismatches)
        if (!trip) {
            const tripIdStr = String(tripId);
            trip = user.trips.find(t => {
                const tId = String(t._id || t.id || '');
                return tId === tripIdStr || tId.toLowerCase() === tripIdStr.toLowerCase();
            });
        }

        if (!trip) {
            console.error('Delete trip: Trip not found:', {
                requestedTripId: tripId,
                requestedTripIdType: typeof tripId,
                userTripsCount: user.trips.length,
                availableTripIds: user.trips.map((t, idx) => ({
                    index: idx,
                    _id: t._id ? String(t._id) : 'no _id',
                    id: t.id ? String(t.id) : 'no id',
                    name: t.name,
                    _idType: typeof t._id,
                    idType: typeof t.id
                }))
            });
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }

        console.log('Delete trip: Trip found, removing:', {
            tripId: String(trip._id || trip.id),
            tripName: trip.name,
            tripsBeforeDelete: user.trips.length
        });

        // Use pull() to properly remove subdocument from array
        // This is the correct way to remove subdocuments in Mongoose
        const deletedTripId = String(trip._id || trip.id);
        user.trips.pull(trip._id || trip.id);
        await user.save();

        // Clear recommendation cache for deleted trip
        try {
            const recommendationService = require('../services/recommendationService');
            recommendationService.invalidateTripCache(deletedTripId);
            console.log('Delete trip: Cleared recommendation cache for trip:', deletedTripId);
        } catch (cacheError) {
            console.warn('Delete trip: Failed to clear recommendation cache:', cacheError.message);
            // Don't fail the deletion if cache clearing fails
        }

        console.log('Delete trip: Successfully deleted trip:', {
            tripId: deletedTripId,
            tripsAfterDelete: user.trips.length
        });

        res.json({
            success: true,
            message: 'Trip deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting trip:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to delete trip',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Add a match to a trip
router.post('/:id/matches', auth, async (req, res) => {
    try {
        const { matchId, homeTeam, awayTeam, league, venue, venueData, date } = req.body;
        
        console.log('🏟️ BACKEND - Adding match to trip');
        console.log('🏟️ BACKEND - Complete request body:', JSON.stringify(req.body, null, 2));
        console.log('🏟️ BACKEND - Received venueData:', JSON.stringify(venueData, null, 2));
        console.log('🏟️ BACKEND - Received venue string:', venue);
        
        const user = await User.findById(req.user.id);
        const trip = user.trips.id(req.params.id);
        
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }

        // Check if match is already in the trip
        const existingMatch = trip.matches.find(match => match.matchId === matchId);
        if (existingMatch) {
            return res.status(400).json({
                success: false,
                message: 'Match already in trip'
            });
        }

        // Try to geocode venue if coordinates are missing
        let finalVenueData = venueData;
        if (venueData && !venueData.coordinates && venueData.name && venueData.city) {
            try {
                const geocodingService = require('../services/geocodingService');
                const coordinates = await geocodingService.geocodeVenueCoordinates(
                    venueData.name,
                    venueData.city,
                    venueData.country
                );
                
                if (coordinates) {
                    finalVenueData = {
                        ...venueData,
                        coordinates: coordinates
                    };
                    console.log(`✅ Geocoded venue for trip: ${venueData.name} at [${coordinates[0]}, ${coordinates[1]}]`);
                } else {
                    console.log(`⚠️ Could not geocode venue for trip: ${venueData.name}`);
                }
            } catch (error) {
                console.error(`❌ Error geocoding venue ${venueData.name}:`, error);
            }
        }

        const matchToSave = {
            matchId,
            homeTeam,
            awayTeam,
            league,
            venue,
            venueData: finalVenueData || null,  // Save the complete venue object
            date: new Date(date),
            addedAt: new Date(),
            planning: {
                ticketsAcquired: 'no',
                flight: 'no',
                accommodation: 'no',
                notes: ''
            }
        };
        
        console.log('🏟️ BACKEND - About to save match:', JSON.stringify(matchToSave, null, 2));
        
        trip.matches.push(matchToSave);

        trip.updatedAt = new Date();
        await user.save();
        
        // Check what was actually saved
        const savedMatch = trip.matches[trip.matches.length - 1];
        console.log('🏟️ BACKEND - Successfully saved match:', JSON.stringify(savedMatch, null, 2));
        console.log('🏟️ BACKEND - Saved venueData specifically:', JSON.stringify(savedMatch.venueData, null, 2));

        res.json({
            success: true,
            trip: trip,
            message: 'Match added to trip successfully'
        });
    } catch (error) {
        console.error('Error adding match to trip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add match to trip'
        });
    }
});

// Remove a match from a trip
router.delete('/:id/matches/:matchId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const trip = user.trips.id(req.params.id);
        
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }

        trip.matches = trip.matches.filter(match => match.matchId !== req.params.matchId);
        trip.updatedAt = new Date();
        await user.save();

        res.json({
            success: true,
            trip: trip,
            message: 'Match removed from trip successfully'
        });
    } catch (error) {
        console.error('Error removing match from trip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove match from trip'
        });
    }
});

// Add a flight to a trip
router.post('/:id/flights', auth, async (req, res) => {
    try {
        const { flightNumber, airline, departure, arrival, duration, stops } = req.body;

        if (!flightNumber || !departure || !arrival) {
            return res.status(400).json({
                success: false,
                message: 'Flight number, departure, and arrival are required'
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const trip = user.trips.id(req.params.id);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }

        const flightToAdd = {
            flightNumber,
            airline: airline || {},
            departure: {
                airport: departure.airport || {},
                date: departure.date,
                time: departure.time
            },
            arrival: {
                airport: arrival.airport || {},
                date: arrival.date,
                time: arrival.time
            },
            duration: duration || 0,
            stops: stops || 0,
            addedAt: new Date()
        };

        trip.flights.push(flightToAdd);
        trip.updatedAt = new Date();
        await user.save();

        const savedFlight = trip.flights[trip.flights.length - 1];

        res.status(201).json({
            success: true,
            flight: savedFlight,
            message: 'Flight added to trip successfully'
        });
    } catch (error) {
        console.error('Error adding flight to trip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add flight to trip'
        });
    }
});

// Delete a flight from a trip
router.delete('/:id/flights/:flightId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const trip = user.trips.id(req.params.id);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }

        // Try to find the flight by ID
        // Mongoose subdocuments can be accessed by _id string
        let flight = trip.flights.id(req.params.flightId);
        
        // If not found, try finding by matching _id string (case-insensitive, handle ObjectId)
        if (!flight) {
            const flightIdStr = String(req.params.flightId);
            flight = trip.flights.find(f => {
                const fId = String(f._id || f.id || '');
                return fId === flightIdStr || 
                       fId.toLowerCase() === flightIdStr.toLowerCase() ||
                       f._id?.toString() === flightIdStr ||
                       f.id?.toString() === flightIdStr;
            });
        }
        
        if (!flight) {
            console.error('Flight not found:', {
                requestedFlightId: req.params.flightId,
                requestedFlightIdType: typeof req.params.flightId,
                tripFlightsCount: trip.flights.length,
                availableFlightIds: trip.flights.map((f, idx) => ({ 
                    index: idx,
                    _id: f._id ? String(f._id) : 'no _id',
                    id: f.id ? String(f.id) : 'no id',
                    flightNumber: f.flightNumber,
                    _idType: typeof f._id,
                    idType: typeof f.id
                }))
            });
            return res.status(404).json({
                success: false,
                message: 'Flight not found'
            });
        }
        
        console.log('Flight found for deletion:', {
            flightId: String(flight._id || flight.id),
            flightNumber: flight.flightNumber,
            tripFlightsCount: trip.flights.length
        });

        console.log('Attempting to delete flight:', {
            flightId: req.params.flightId,
            flightFound: !!flight,
            flightIdType: typeof flight?._id,
            flightIdValue: String(flight?._id),
            tripFlightsCount: trip.flights.length
        });

        // Remove the flight from the array
        // For Mongoose subdocuments, we can use pull or filter
        trip.flights.pull(flight._id);
        trip.updatedAt = new Date();
        
        console.log('Flight removed from array, saving user...');
        await user.save();
        
        console.log('User saved successfully, flight deleted');

        res.json({
            success: true,
            message: 'Flight deleted from trip successfully'
        });
    } catch (error) {
        console.error('Error deleting flight from trip:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            flightId: req.params.flightId,
            tripId: req.params.id,
            userId: req.user?.id,
            errorMessage: error.message,
            errorName: error.name
        });
        res.status(500).json({
            success: false,
            message: 'Failed to delete flight from trip',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update match planning details
router.put('/:id/matches/:matchId/planning', auth, async (req, res) => {
    try {
        const { ticketsAcquired, flight, accommodation, homeBaseId, notes } = req.body;
        
        console.log('📋 BACKEND - Updating match planning details');
        console.log('📋 BACKEND - Trip ID:', req.params.id);
        console.log('📋 BACKEND - Match ID:', req.params.matchId);
        console.log('📋 BACKEND - Planning data:', { ticketsAcquired, flight, accommodation, homeBaseId, notes });
        
        const user = await User.findById(req.user.id);
        const trip = user.trips.id(req.params.id);
        
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }

        const match = trip.matches.find(m => m.matchId === req.params.matchId);
        if (!match) {
            return res.status(404).json({
                success: false,
                message: 'Match not found in trip'
            });
        }

        // Ensure planning object exists (for matches added before this fix)
        if (!match.planning) {
            match.planning = {
                ticketsAcquired: 'no',
                flight: 'no',
                accommodation: 'no',
                homeBaseId: null,
                notes: ''
            };
        }

        // Update planning details
        if (ticketsAcquired !== undefined) {
            match.planning.ticketsAcquired = ticketsAcquired;
        }
        if (flight !== undefined) {
            match.planning.flight = flight;
        }
        if (accommodation !== undefined) {
            match.planning.accommodation = accommodation;
        }
        if (homeBaseId !== undefined) {
            // Validate homeBaseId if provided
            if (homeBaseId && homeBaseId !== null && homeBaseId !== '') {
                // Check if home base exists in trip
                const homeBase = trip.homeBases.find(hb => {
                    const hbId = String(hb._id || hb.id || '');
                    return hbId === String(homeBaseId) || 
                           hbId.toLowerCase() === String(homeBaseId).toLowerCase() ||
                           hb._id?.toString() === String(homeBaseId) ||
                           hb.id?.toString() === String(homeBaseId);
                });
                
                if (!homeBase) {
                    return res.status(400).json({
                        success: false,
                        message: 'Home base not found in trip'
                    });
                }
                
                // Validate that home base date range includes match date
                const matchDate = new Date(match.date);
                const homeBaseFrom = new Date(homeBase.dateRange.from);
                const homeBaseTo = new Date(homeBase.dateRange.to);
                
                if (matchDate < homeBaseFrom || matchDate > homeBaseTo) {
                    return res.status(400).json({
                        success: false,
                        message: 'Home base date range does not include match date'
                    });
                }
            }
            
            match.planning.homeBaseId = homeBaseId || null;
        }
        if (notes !== undefined) {
            match.planning.notes = notes;
        }

        trip.updatedAt = new Date();
        await user.save();
        
        console.log('📋 BACKEND - Successfully updated match planning:', match.planning);

        res.json({
            success: true,
            trip: trip,
            match: match,
            message: 'Match planning updated successfully'
        });
    } catch (error) {
        console.error('Error updating match planning:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update match planning'
        });
    }
});

// Fetch scores for completed matches in a trip
router.post('/:id/fetch-scores', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const trip = user.trips.id(req.params.id);
        
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }

        // Find completed matches that don't have scores yet
        const completedMatches = trip.matches.filter(match => {
            const matchDate = new Date(match.date);
            const now = new Date();
            const isPast = matchDate < now;
            // Check if finalScore doesn't exist OR if it exists but has null values
            const hasNoScore = !match.finalScore || 
                              (match.finalScore.home === null && match.finalScore.away === null);
            return isPast && hasNoScore;
        });

        if (completedMatches.length === 0) {
            return res.json({
                success: true,
                message: 'No completed matches need score updates',
                updatedMatches: []
            });
        }

        console.log(`🏆 Fetching scores for ${completedMatches.length} completed matches`);
        console.log(`🏆 Match IDs to fetch:`, completedMatches.map(m => m.matchId));

        // Batch fetch scores from API-Sports
        const scorePromises = completedMatches.map(async (match) => {
            try {
                // Use matchId to fetch from API-Sports
                const response = await axios.get(`${API_SPORTS_BASE_URL}/fixtures`, {
                    params: { id: match.matchId },
                    headers: { 'x-apisports-key': API_SPORTS_KEY },
                    timeout: 10000
                });

                if (response.data && response.data.response && response.data.response.length > 0) {
                    const fixture = response.data.response[0];
                    const score = fixture.score;
                    const goals = fixture.goals;
                    
                    console.log(`🔍 Debug fixture ${match.matchId}:`, {
                        status: fixture.fixture.status,
                        goals: goals,
                        score: score
                    });
                    
                    // Only store if match is finished and has valid scores
                    if (fixture.fixture.status.short === 'FT' && 
                        goals.home !== null && 
                        goals.away !== null) {
                        
                        return {
                            matchId: match.matchId,
                            finalScore: {
                                home: goals.home,
                                away: goals.away,
                                halfTime: {
                                    home: score?.halftime?.home || null,
                                    away: score?.halftime?.away || null
                                },
                                status: fixture.fixture.status.short,
                                fetchedAt: new Date()
                            }
                        };
                    }
                }
                return null;
            } catch (error) {
                console.error(`Error fetching score for match ${match.matchId}:`, error.message);
                return null;
            }
        });

        const scoreResults = await Promise.all(scorePromises);
        const validScores = scoreResults.filter(result => result !== null);

        // Update matches with scores
        let updatedCount = 0;
        validScores.forEach(scoreData => {
            const match = trip.matches.find(m => m.matchId === scoreData.matchId);
            if (match) {
                match.finalScore = scoreData.finalScore;
                updatedCount++;
            }
        });

        trip.updatedAt = new Date();
        await user.save();

        console.log(`✅ Updated ${updatedCount} matches with scores`);

        res.json({
            success: true,
            message: `Updated ${updatedCount} matches with scores`,
            updatedMatches: validScores,
            totalCompleted: completedMatches.length
        });

    } catch (error) {
        console.error('Error fetching match scores:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch match scores',
            error: error.message
        });
    }
});

// Add a home base to a trip
router.post('/:id/home-bases', auth, async (req, res) => {
    try {
        const { name, type, address, coordinates, dateRange, notes } = req.body;

        if (!name || !dateRange || !dateRange.from || !dateRange.to) {
            return res.status(400).json({
                success: false,
                message: 'Name and date range (from, to) are required'
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const trip = user.trips.id(req.params.id);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }

        // Validate date range overlaps with trip dates
        const tripStart = trip.matches.length > 0 
            ? new Date(Math.min(...trip.matches.map(m => new Date(m.date))))
            : new Date();
        const tripEnd = trip.matches.length > 0
            ? new Date(Math.max(...trip.matches.map(m => new Date(m.date))))
            : new Date();
        
        const homeBaseFrom = new Date(dateRange.from);
        const homeBaseTo = new Date(dateRange.to);

        if (homeBaseFrom > homeBaseTo) {
            return res.status(400).json({
                success: false,
                message: 'Date range is invalid (from date must be before to date)'
            });
        }

        // Geocode if coordinates not provided but address is available
        let finalCoordinates = coordinates;
        if (!finalCoordinates || !finalCoordinates.lat || !finalCoordinates.lng) {
            if (address && (address.city || address.street)) {
                try {
                    const addressQuery = address.street 
                        ? `${address.street}, ${address.city}, ${address.country}`
                        : `${address.city}, ${address.country}`;
                    
                    const geocoded = await geocodingService.geocodeVenue(
                        addressQuery,
                        address.city,
                        address.country
                    );
                    
                    if (geocoded && geocoded.lat && geocoded.lng) {
                        finalCoordinates = {
                            lat: geocoded.lat,
                            lng: geocoded.lng
                        };
                    }
                } catch (geocodeError) {
                    console.error('Geocoding error:', geocodeError);
                    // Continue without coordinates - user can add manually later
                }
            }
        }

        const homeBaseToAdd = {
            name: name.trim(),
            type: type || 'custom',
            address: {
                street: address?.street || '',
                city: address?.city || '',
                country: address?.country || '',
                postalCode: address?.postalCode || ''
            },
            coordinates: finalCoordinates || { lat: null, lng: null },
            dateRange: {
                from: homeBaseFrom,
                to: homeBaseTo
            },
            notes: notes || '',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        trip.homeBases.push(homeBaseToAdd);
        trip.updatedAt = new Date();
        await user.save();

        const savedHomeBase = trip.homeBases[trip.homeBases.length - 1];

        res.status(201).json({
            success: true,
            homeBase: savedHomeBase,
            message: 'Home base added to trip successfully'
        });
    } catch (error) {
        console.error('Error adding home base to trip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add home base to trip',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update a home base in a trip
router.put('/:id/home-bases/:homeBaseId', auth, async (req, res) => {
    try {
        const { name, type, address, coordinates, dateRange, notes } = req.body;

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const trip = user.trips.id(req.params.id);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }

        let homeBase = trip.homeBases.id(req.params.homeBaseId);
        
        // If not found, try finding by matching _id string
        if (!homeBase) {
            const homeBaseIdStr = String(req.params.homeBaseId);
            homeBase = trip.homeBases.find(hb => {
                const hbId = String(hb._id || hb.id || '');
                return hbId === homeBaseIdStr || 
                       hbId.toLowerCase() === homeBaseIdStr.toLowerCase() ||
                       hb._id?.toString() === homeBaseIdStr ||
                       hb.id?.toString() === homeBaseIdStr;
            });
        }

        if (!homeBase) {
            return res.status(404).json({
                success: false,
                message: 'Home base not found'
            });
        }

        // Update fields if provided
        if (name !== undefined) {
            homeBase.name = name.trim();
        }
        if (type !== undefined) {
            homeBase.type = type;
        }
        if (address !== undefined) {
            homeBase.address = {
                street: address.street || homeBase.address.street || '',
                city: address.city || homeBase.address.city || '',
                country: address.country || homeBase.address.country || '',
                postalCode: address.postalCode || homeBase.address.postalCode || ''
            };
        }
        if (dateRange !== undefined) {
            if (dateRange.from && dateRange.to) {
                const fromDate = new Date(dateRange.from);
                const toDate = new Date(dateRange.to);
                if (fromDate > toDate) {
                    return res.status(400).json({
                        success: false,
                        message: 'Date range is invalid (from date must be before to date)'
                    });
                }
                homeBase.dateRange = {
                    from: fromDate,
                    to: toDate
                };
            }
        }
        if (notes !== undefined) {
            homeBase.notes = notes;
        }

        // Geocode if coordinates not provided but address is available
        if ((!coordinates || !coordinates.lat || !coordinates.lng) && 
            (address?.city || homeBase.address?.city)) {
            try {
                const addressQuery = (address?.street || homeBase.address?.street)
                    ? `${address?.street || homeBase.address.street}, ${address?.city || homeBase.address.city}, ${address?.country || homeBase.address.country}`
                    : `${address?.city || homeBase.address.city}, ${address?.country || homeBase.address.country}`;
                
                const geocoded = await geocodingService.geocodeVenue(
                    addressQuery,
                    address?.city || homeBase.address.city,
                    address?.country || homeBase.address.country
                );
                
                if (geocoded && geocoded.lat && geocoded.lng) {
                    homeBase.coordinates = {
                        lat: geocoded.lat,
                        lng: geocoded.lng
                    };
                }
            } catch (geocodeError) {
                console.error('Geocoding error:', geocodeError);
                // Keep existing coordinates if geocoding fails
            }
        } else if (coordinates && coordinates.lat && coordinates.lng) {
            homeBase.coordinates = {
                lat: coordinates.lat,
                lng: coordinates.lng
            };
        }

        homeBase.updatedAt = new Date();
        trip.updatedAt = new Date();
        await user.save();

        res.json({
            success: true,
            homeBase: homeBase,
            message: 'Home base updated successfully'
        });
    } catch (error) {
        console.error('Error updating home base:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update home base',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Delete a home base from a trip
router.delete('/:id/home-bases/:homeBaseId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const trip = user.trips.id(req.params.id);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }

        let homeBase = trip.homeBases.id(req.params.homeBaseId);
        
        // If not found, try finding by matching _id string
        if (!homeBase) {
            const homeBaseIdStr = String(req.params.homeBaseId);
            homeBase = trip.homeBases.find(hb => {
                const hbId = String(hb._id || hb.id || '');
                return hbId === homeBaseIdStr || 
                       hbId.toLowerCase() === homeBaseIdStr.toLowerCase() ||
                       hb._id?.toString() === homeBaseIdStr ||
                       hb.id?.toString() === homeBaseIdStr;
            });
        }

        if (!homeBase) {
            return res.status(404).json({
                success: false,
                message: 'Home base not found'
            });
        }

        trip.homeBases.pull(homeBase._id);
        trip.updatedAt = new Date();
        await user.save();

        res.json({
            success: true,
            message: 'Home base deleted from trip successfully'
        });
    } catch (error) {
        console.error('Error deleting home base from trip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete home base from trip',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get travel times from home bases to match venues
router.get('/:id/travel-times', auth, async (req, res) => {
    try {
        const { matchId, homeBaseId } = req.query;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const trip = user.trips.id(req.params.id);
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }

        // Filter matches if matchId is provided
        let matchesToProcess = trip.matches || [];
        if (matchId) {
            matchesToProcess = matchesToProcess.filter(m => 
                String(m.matchId) === String(matchId)
            );
        }

        if (matchesToProcess.length === 0) {
            return res.json({
                success: true,
                travelTimes: {}
            });
        }

        // Filter home bases if homeBaseId is provided
        let homeBasesToUse = trip.homeBases || [];
        if (homeBaseId) {
            homeBasesToUse = homeBasesToUse.filter(hb => 
                String(hb._id) === String(homeBaseId)
            );
        }

        if (homeBasesToUse.length === 0) {
            return res.json({
                success: true,
                travelTimes: {},
                message: 'No home bases found for this trip'
            });
        }

        const travelTimes = {};
        const googleApiKey = process.env.GOOGLE_API_KEY;

        if (!googleApiKey) {
            // Return empty travel times instead of error - feature is unavailable but not a failure
            console.warn('Google Maps API key not configured - travel times unavailable');
            return res.json({
                success: true,
                travelTimes: {},
                message: 'Travel times unavailable (Google Maps API key not configured)'
            });
        }

        // Process each match
        for (const match of matchesToProcess) {
            const matchDate = new Date(match.date);
            
            // Find applicable home base(s) for this match date
            const applicableHomeBases = homeBasesToUse.filter(homeBase => {
                if (!homeBase.dateRange || !homeBase.dateRange.from || !homeBase.dateRange.to) {
                    return false;
                }
                const fromDate = new Date(homeBase.dateRange.from);
                const toDate = new Date(homeBase.dateRange.to);
                return matchDate >= fromDate && matchDate <= toDate;
            });

            if (applicableHomeBases.length === 0) {
                // No home base matches this match date
                travelTimes[match.matchId] = null;
                continue;
            }

            // Prefer home base with coordinates, otherwise use first one
            let selectedHomeBase = applicableHomeBases.find(hb => 
                hb.coordinates && 
                typeof hb.coordinates.lat === 'number' && 
                typeof hb.coordinates.lng === 'number'
            ) || applicableHomeBases[0];

            // Check if home base has coordinates
            if (!selectedHomeBase.coordinates || 
                typeof selectedHomeBase.coordinates.lat !== 'number' || 
                typeof selectedHomeBase.coordinates.lng !== 'number') {
                travelTimes[match.matchId] = null;
                continue;
            }

            // Get venue coordinates from match
            let venueCoords = null;
            if (match.venueData && match.venueData.coordinates) {
                const coords = match.venueData.coordinates;
                // Handle array format [longitude, latitude] (GeoJSON)
                if (Array.isArray(coords) && coords.length === 2) {
                    venueCoords = { lat: coords[1], lng: coords[0] };
                }
                // Handle object format { lat, lng }
                else if (typeof coords === 'object' && coords.lat && coords.lng) {
                    venueCoords = { lat: coords.lat, lng: coords.lng };
                }
            }

            if (!venueCoords) {
                travelTimes[match.matchId] = null;
                continue;
            }

            // Calculate travel time using Google Maps Directions API
            try {
                const origin = `${selectedHomeBase.coordinates.lat},${selectedHomeBase.coordinates.lng}`;
                const destination = `${venueCoords.lat},${venueCoords.lng}`;

                const response = await axios.get(
                    'https://maps.googleapis.com/maps/api/directions/json',
                    {
                        params: {
                            origin,
                            destination,
                            mode: 'driving',
                            key: googleApiKey
                        },
                        ...googleApiConfig
                    }
                );

                if (response.data.status === 'OK' && response.data.routes && response.data.routes.length > 0) {
                    const route = response.data.routes[0];
                    const leg = route.legs[0];
                    
                    // Convert duration from seconds to minutes
                    const durationMinutes = Math.round(leg.duration.value / 60);
                    // Convert distance from meters to miles
                    const distanceMiles = (leg.distance.value / 1609.34).toFixed(1);

                    travelTimes[match.matchId] = {
                        duration: durationMinutes, // minutes
                        distance: parseFloat(distanceMiles), // miles
                        homeBaseId: String(selectedHomeBase._id),
                        durationText: leg.duration.text,
                        distanceText: leg.distance.text
                    };
                } else {
                    // API returned error or no route found
                    console.warn(`Directions API error for match ${match.matchId}:`, response.data.status);
                    travelTimes[match.matchId] = null;
                }
            } catch (error) {
                console.error(`Error calculating travel time for match ${match.matchId}:`, error.message);
                travelTimes[match.matchId] = null;
            }
        }

        res.json({
            success: true,
            travelTimes
        });
    } catch (error) {
        console.error('Error fetching travel times:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch travel times',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router; 