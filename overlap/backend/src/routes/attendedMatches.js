const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const User = require('../models/User');
const { getVenueForTeam } = require('../data/venues');
const auth = require('../middleware/auth');
const router = express.Router();

// Configure multer for photo uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/matches');
        
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueName = `match-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit for videos
    },
    fileFilter: (req, file, cb) => {
        // Allow both images and videos
        const allowedImageTypes = /jpeg|jpg|png|heic/;
        const allowedVideoTypes = /mp4|mov|avi|mkv|webm/;
        const extname = path.extname(file.originalname).toLowerCase();
        
        const isImage = allowedImageTypes.test(extname) && file.mimetype.startsWith('image/');
        const isVideo = allowedVideoTypes.test(extname) && file.mimetype.startsWith('video/');
        
        if (isImage || isVideo) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, JPG, PNG, HEIC) and video files (MP4, MOV, AVI, MKV, WEBM) are allowed'));
        }
    }
});

/**
 * GET /api/matches/attended
 * Get all attended matches for the authenticated user
 */
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('attendedMatches');
        
        // Sort by date (most recent first)
        const sortedMatches = user.attendedMatches.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        res.json({
            success: true,
            data: sortedMatches
        });
    } catch (error) {
        console.error('Error fetching attended matches:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attended matches'
        });
    }
});

/**
 * GET /api/matches/attended/:id
 * Get a specific attended match by ID
 */
router.get('/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('attendedMatches');
        const match = user.attendedMatches.id(req.params.id);
        
        if (!match) {
            return res.status(404).json({
                success: false,
                message: 'Attended match not found'
            });
        }
        
        res.json({
            success: true,
            data: match
        });
    } catch (error) {
        console.error('Error fetching attended match:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attended match'
        });
    }
});

/**
 * POST /api/matches/attended
 * Add a new attended match
 */
router.post('/', auth, upload.array('photos', 10), async (req, res) => {
    try {
        console.log('📝 POST /api/matches/attended - Request received');
        console.log('🔍 Request body keys:', Object.keys(req.body));
        console.log('📸 Files uploaded:', req.files ? req.files.length : 0);
        
        // Parse JSON strings from FormData
        const {
            matchType,
            competition,
            date,
            userScore,
            userNotes
        } = req.body;

        // Parse JSON objects with error handling
        let homeTeam = null;
        let awayTeam = null;
        let venue = null;
        let apiMatchData = null;

        try {
            homeTeam = req.body.homeTeam ? JSON.parse(req.body.homeTeam) : null;
            awayTeam = req.body.awayTeam ? JSON.parse(req.body.awayTeam) : null;
            venue = req.body.venue ? JSON.parse(req.body.venue) : null;
            apiMatchData = req.body.apiMatchData ? JSON.parse(req.body.apiMatchData) : null;
        } catch (parseError) {
            console.error('❌ JSON parsing error:', parseError);
            return res.status(400).json({
                success: false,
                message: 'Invalid JSON data in request'
            });
        }

        // Validate required fields
        if (!homeTeam || !homeTeam.name) {
            return res.status(400).json({
                success: false,
                message: 'Home team is required'
            });
        }

        if (!awayTeam || !awayTeam.name) {
            return res.status(400).json({
                success: false,
                message: 'Away team is required'
            });
        }

        // Generate unique match ID
        const matchId = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;

        // For API matches, try to enrich venue data from cache
        if (matchType === 'api' && homeTeam.name) {
            const cachedVenue = getVenueForTeam(homeTeam.name);
            if (cachedVenue && venue) {
                venue.city = venue.city || cachedVenue.city;
                venue.country = venue.country || cachedVenue.country;
                venue.coordinates = venue.coordinates || cachedVenue.coordinates;
            }
        }

        // Handle uploaded photos
        const photos = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                photos.push({
                    filename: `/uploads/matches/${file.filename}`,
                    uploadDate: new Date(),
                    caption: '' // Empty caption for now, can be added later
                });
            }
        }

        // Create attended match object
        const attendedMatch = {
            matchId,
            matchType,
            homeTeam,
            awayTeam,
            venue: venue || { name: '', city: '', country: '' },
            competition: competition || '',
            date: date ? new Date(date) : null,
            userScore: userScore || '',
            userNotes: userNotes || '',
            photos,
            attendedDate: new Date(),
            apiMatchData
        };

        // Add to user's attended matches
        const user = await User.findById(req.user.id);
        user.attendedMatches.push(attendedMatch);
        await user.save();

        // Return the newly created match
        const newMatch = user.attendedMatches[user.attendedMatches.length - 1];

        res.status(201).json({
            success: true,
            data: newMatch,
            message: 'Attended match added successfully'
        });

    } catch (error) {
        console.error('Error adding attended match:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add attended match',
            error: error.message
        });
    }
});

/**
 * PUT /api/matches/attended/:id
 * Update an attended match
 */
router.put('/:id', auth, upload.array('photos', 10), async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const match = user.attendedMatches.id(req.params.id);
        
        if (!match) {
            return res.status(404).json({
                success: false,
                message: 'Attended match not found'
            });
        }

        // Handle regular field updates
        const allowedUpdates = ['userScore', 'userNotes', 'venue', 'competition', 'date', 'photos'];
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                if (field === 'date') {
                    match[field] = new Date(req.body[field]);
                } else if (field === 'venue' && typeof req.body[field] === 'string') {
                    // Parse venue JSON if it's a string (from FormData)
                    try {
                        match[field] = JSON.parse(req.body[field]);
                    } catch (e) {
                        match[field] = req.body[field];
                    }
                } else if (field === 'photos' && typeof req.body[field] === 'string') {
                    // Handle existing photos from FormData
                    try {
                        match[field] = JSON.parse(req.body[field]);
                    } catch (e) {
                        match[field] = req.body[field];
                    }
                } else {
                    match[field] = req.body[field];
                }
            }
        });

        // Handle existing photos update (when photos are removed)
        if (req.body.existingPhotos) {
            try {
                const existingPhotos = JSON.parse(req.body.existingPhotos);
                // Update the photos array to only include the remaining existing photos
                match.photos = existingPhotos.map(filename => ({
                    filename: `/uploads/matches/${filename}`,
                    uploadDate: new Date(),
                    caption: ''
                }));
            } catch (e) {
                console.error('Error parsing existing photos:', e);
            }
        }

        // Handle new photo uploads
        if (req.files && req.files.length > 0) {
            const newPhotos = [];
            for (const file of req.files) {
                newPhotos.push({
                    filename: `/uploads/matches/${file.filename}`,
                    uploadDate: new Date(),
                    caption: ''
                });
            }
            
            // Add new photos to existing ones
            if (!match.photos) match.photos = [];
            match.photos.push(...newPhotos);
        }

        await user.save();

        res.json({
            success: true,
            data: match,
            message: 'Attended match updated successfully'
        });

    } catch (error) {
        console.error('Error updating attended match:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update attended match'
        });
    }
});

/**
 * POST /api/matches/attended/:id/photos
 * Add photos to an existing attended match
 */
router.post('/:id/photos', auth, upload.array('photos', 10), async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const match = user.attendedMatches.id(req.params.id);
        
        if (!match) {
            return res.status(404).json({
                success: false,
                message: 'Attended match not found'
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No photos uploaded'
            });
        }

        // Add new photos
        const newPhotos = [];
        for (const file of req.files) {
            const photo = {
                filename: `/uploads/matches/${file.filename}`,
                uploadDate: new Date(),
                caption: req.body.caption || ''
            };
            match.photos.push(photo);
            newPhotos.push(photo);
        }

        await user.save();

        res.json({
            success: true,
            data: newPhotos,
            message: `${newPhotos.length} photo(s) added successfully`
        });

    } catch (error) {
        console.error('Error adding photos:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add photos'
        });
    }
});

/**
 * DELETE /api/matches/attended/:id/photos/:photoId
 * Delete a specific photo from an attended match
 */
router.delete('/:id/photos/:photoId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const match = user.attendedMatches.id(req.params.id);
        
        if (!match) {
            return res.status(404).json({
                success: false,
                message: 'Attended match not found'
            });
        }

        const photo = match.photos.id(req.params.photoId);
        if (!photo) {
            return res.status(404).json({
                success: false,
                message: 'Photo not found'
            });
        }

        // Delete physical file
        try {
            const filePath = path.join(__dirname, '../../uploads/matches', req.user.id, req.params.id, photo.filename);
            await fs.unlink(filePath);
        } catch (fileError) {
            console.warn('Could not delete physical file:', fileError.message);
        }

        // Remove from database
        match.photos.pull(photo._id);
        await user.save();

        res.json({
            success: true,
            message: 'Photo deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete photo'
        });
    }
});

/**
 * DELETE /api/matches/attended/:id
 * Delete an attended match
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const match = user.attendedMatches.id(req.params.id);
        
        if (!match) {
            return res.status(404).json({
                success: false,
                message: 'Attended match not found'
            });
        }

        // Delete all associated photos
        try {
            const matchDir = path.join(__dirname, '../../uploads/matches', req.user.id, req.params.id);
            await fs.rm(matchDir, { recursive: true, force: true });
        } catch (fileError) {
            console.warn('Could not delete match directory:', fileError.message);
        }

        // Remove from database
        user.attendedMatches.pull(match._id);
        await user.save();

        res.json({
            success: true,
            message: 'Attended match deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting attended match:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete attended match'
        });
    }
});

/**
 * GET /api/matches/attended/:id/photos/:filename
 * Serve photo files
 */
router.get('/:id/photos/:filename', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const match = user.attendedMatches.id(req.params.id);
        
        if (!match) {
            return res.status(404).json({
                success: false,
                message: 'Attended match not found'
            });
        }

        // Check if photo exists in match
        const photo = match.photos.find(p => p.filename === req.params.filename);
        if (!photo) {
            return res.status(404).json({
                success: false,
                message: 'Photo not found'
            });
        }

        const filePath = path.join(__dirname, '../../uploads/matches', req.user.id, req.params.id, req.params.filename);
        res.sendFile(filePath);

    } catch (error) {
        console.error('Error serving photo:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to serve photo'
        });
    }
});

module.exports = router; 