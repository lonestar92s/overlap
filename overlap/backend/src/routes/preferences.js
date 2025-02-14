const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Get user preferences
router.get('/', auth, async (req, res) => {
    try {
        res.json({ preferences: req.user.preferences });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update user preferences
router.put('/', auth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
        'defaultLocation',
        'favoriteTeams',
        'favoriteLeagues',
        'defaultSearchRadius'
    ];

    // Validate update fields
    const isValidOperation = updates.every(update => 
        allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
        return res.status(400).json({ error: 'Invalid updates' });
    }

    try {
        // Update each field in preferences
        updates.forEach(update => {
            req.user.preferences[update] = req.body[update];
        });

        await req.user.save();
        res.json({ preferences: req.user.preferences });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add favorite team
router.post('/teams', auth, async (req, res) => {
    try {
        const { teamName } = req.body;
        
        if (!req.user.preferences.favoriteTeams.includes(teamName)) {
            req.user.preferences.favoriteTeams.push(teamName);
            await req.user.save();
        }
        
        res.json({ favoriteTeams: req.user.preferences.favoriteTeams });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Remove favorite team
router.delete('/teams/:teamName', auth, async (req, res) => {
    try {
        const teamName = decodeURIComponent(req.params.teamName);
        req.user.preferences.favoriteTeams = req.user.preferences.favoriteTeams
            .filter(team => team !== teamName);
        
        await req.user.save();
        res.json({ favoriteTeams: req.user.preferences.favoriteTeams });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add favorite league
router.post('/leagues', auth, async (req, res) => {
    try {
        const { leagueId } = req.body;
        
        if (!req.user.preferences.favoriteLeagues.includes(leagueId)) {
            req.user.preferences.favoriteLeagues.push(leagueId);
            await req.user.save();
        }
        
        res.json({ favoriteLeagues: req.user.preferences.favoriteLeagues });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Remove favorite league
router.delete('/leagues/:leagueId', auth, async (req, res) => {
    try {
        const leagueId = req.params.leagueId;
        req.user.preferences.favoriteLeagues = req.user.preferences.favoriteLeagues
            .filter(league => league !== leagueId);
        
        await req.user.save();
        res.json({ favoriteLeagues: req.user.preferences.favoriteLeagues });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 