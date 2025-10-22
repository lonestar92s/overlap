const express = require('express');
const { auth, authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const axios = require('axios');

const router = express.Router();

// API-Sports configuration
const API_SPORTS_BASE_URL = 'https://v3.football.api-sports.io';
const API_SPORTS_KEY = process.env.API_SPORTS_KEY;

// Get all trips for the authenticated user (or empty array if not authenticated)
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
        
        // Sort trips by creation date (most recent first)
        const sortedTrips = user.trips.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({
            success: true,
            trips: sortedTrips
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
        
        res.json({
            success: true,
            trip: trip
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
        const { name, description, matches } = req.body;
        
        if (!name || !name.trim()) {
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
                name: name.trim(),
                description: description || '',
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
            name: name.trim(),
            description: description || '',
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
        const { name, description } = req.body;
        
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
        const user = await User.findById(req.user.id);
        const trip = user.trips.id(req.params.id);
        
        if (!trip) {
            return res.status(404).json({
                success: false,
                message: 'Trip not found'
            });
        }

        trip.deleteOne();
        await user.save();

        res.json({
            success: true,
            message: 'Trip deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting trip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete trip'
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
            const hasNoScore = !match.finalScore;
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
                    
                    // Only store if match is finished and has valid scores
                    if (fixture.fixture.status.short === 'FT' && 
                        score.fulltime.home !== null && 
                        score.fulltime.away !== null) {
                        
                        return {
                            matchId: match.matchId,
                            finalScore: {
                                home: score.fulltime.home,
                                away: score.fulltime.away,
                                halfTime: {
                                    home: score.halftime.home,
                                    away: score.halftime.away
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