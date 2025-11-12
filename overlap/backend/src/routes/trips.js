const express = require('express');
const { auth, authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const axios = require('axios');
const { isTripCompleted } = require('../utils/tripUtils');

const router = express.Router();

// API-Sports configuration
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';
const API_SPORTS_KEY = process.env.API_SPORTS_KEY;

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
        const { name, description, notes, matches, flights } = req.body;
        
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

        if (!req.user) {
            // No user authenticated - create a temporary trip response
            // In a real app, you might want to store this locally or create a guest session
            const tempTrip = {
                _id: `temp_${Date.now()}`,
                name: tripName,
                description: description || '',
                notes: notes || '',
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
        const { name, description, notes } = req.body;
        
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
        const { ticketsAcquired, flight, accommodation, notes } = req.body;
        
        console.log('📋 BACKEND - Updating match planning details');
        console.log('📋 BACKEND - Trip ID:', req.params.id);
        console.log('📋 BACKEND - Match ID:', req.params.matchId);
        console.log('📋 BACKEND - Planning data:', { ticketsAcquired, flight, accommodation, notes });
        
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

module.exports = router; 