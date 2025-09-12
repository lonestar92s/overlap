const express = require('express');
const { auth, authenticateToken } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

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

        const matchToSave = {
            matchId,
            homeTeam,
            awayTeam,
            league,
            venue,
            venueData: venueData || null,  // Save the complete venue object
            date: new Date(date),
            addedAt: new Date()
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

module.exports = router; 