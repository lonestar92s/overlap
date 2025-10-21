const express = require('express');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const cloudinaryService = require('../services/cloudinaryService');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Configure multer for memory buffer (we'll upload to Cloudinary instead of local storage)
const upload = multer({
  storage: multer.memoryStorage(), // Store in memory temporarily
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
 * GET /api/memories
 * Get all memories (attended matches) for the authenticated user with enhanced data
 */
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('attendedMatches');
    
    // Sort by date (most recent first)
    const sortedMatches = user.attendedMatches.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Debug: Log photo data being sent to frontend
    sortedMatches.forEach((memory, index) => {
      if (memory.photos && memory.photos.length > 0) {
        console.log(`🔍 Memory ${index} photo data:`, {
          memoryId: memory._id || memory.matchId,
          photoCount: memory.photos.length,
          firstPhoto: memory.photos[0],
          hasThumbnailUrl: !!memory.photos[0]?.thumbnailUrl,
          hasUrl: !!memory.photos[0]?.url,
          hasPublicId: !!memory.photos[0]?.publicId
        });
      }
    });
    
    // Calculate statistics
    const stats = calculateMemoryStats(user.attendedMatches);
    
    res.json({
      success: true,
      data: sortedMatches,
      stats
    });
  } catch (error) {
    console.error('Error fetching memories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch memories'
    });
  }
});

/**
 * GET /api/memories/stats
 * Get memory statistics for the authenticated user
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('attendedMatches');
    const stats = calculateMemoryStats(user.attendedMatches);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching memory stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch memory statistics'
    });
  }
});

/**
 * POST /api/memories
 * Create a new memory with photo/video upload to Cloudinary
 */
router.post('/', auth, upload.array('photos', 10), async (req, res) => {
  try {
    const {
      matchType,
      competition,
      date,
      userScore,
      userNotes,
      homeTeam,
      awayTeam,
      venue
    } = req.body;

    // Parse JSON objects
    let homeTeamData = null;
    let awayTeamData = null;
    let venueData = null;

    try {
      homeTeamData = homeTeam ? JSON.parse(homeTeam) : null;
      awayTeamData = awayTeam ? JSON.parse(awayTeam) : null;
      venueData = venue ? JSON.parse(venue) : null;
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON data in request'
      });
    }

    // Validate required fields
    if (!homeTeamData || !homeTeamData.name) {
      return res.status(400).json({
        success: false,
        message: 'Home team is required'
      });
    }

    if (!awayTeamData || !awayTeamData.name) {
      return res.status(400).json({
        success: false,
        message: 'Away team is required'
      });
    }

    // Generate unique match ID
    const matchId = `memory-${Date.now()}-${Math.round(Math.random() * 1E9)}`;

    // Upload photos to Cloudinary
    const photos = [];
    if (req.files && req.files.length > 0) {
      console.log(`📸 Processing ${req.files.length} photo(s) for memory ${matchId}`);
      
      for (const file of req.files) {
        try {
          console.log(`📤 Uploading photo: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
          
          const uploadResult = await cloudinaryService.uploadPhoto(file.buffer, {
            public_id: `${matchId}-${Date.now()}`,
            tags: ['memory', 'football', 'match']
          });

          if (uploadResult.success) {
            console.log(`✅ Photo upload successful:`, {
              publicId: uploadResult.metadata.publicId,
              url: uploadResult.metadata.url,
              coordinates: uploadResult.metadata.coordinates,
              dateTaken: uploadResult.metadata.dateTaken,
              width: uploadResult.metadata.width,
              height: uploadResult.metadata.height
            });
            
            photos.push({
              publicId: uploadResult.metadata.publicId,
              url: uploadResult.metadata.url,
              thumbnailUrl: cloudinaryService.generateThumbnailUrl(uploadResult.metadata.publicId),
              width: uploadResult.metadata.width,
              height: uploadResult.metadata.height,
              format: uploadResult.metadata.format,
              size: uploadResult.metadata.size,
              coordinates: uploadResult.metadata.coordinates,
              dateTaken: uploadResult.metadata.dateTaken,
              uploadDate: new Date(),
              caption: ''
            });

            console.log(`✅ Photo saved to memory: ${uploadResult.metadata.publicId}`);
            console.log(`🖼️ Photo URLs:`, {
              publicId: uploadResult.metadata.publicId,
              url: uploadResult.metadata.url,
              thumbnailUrl: cloudinaryService.generateThumbnailUrl(uploadResult.metadata.publicId)
            });
          } else {
            console.error('❌ Photo upload failed:', uploadResult.error);
            // Continue with memory creation even if photo upload fails
            console.log('⚠️ Continuing with memory creation without photos...');
          }
        } catch (uploadError) {
          console.error('❌ Photo upload error:', uploadError);
        }
      }
    } else {
      console.log('📸 No photos provided for this memory');
    }

    // Use photo metadata to enhance venue data if available
    if (photos.length > 0) {
      const photoWithLocation = photos.find(p => p.coordinates);
      if (photoWithLocation && !venueData?.coordinates) {
        venueData = venueData || {};
        venueData.coordinates = [photoWithLocation.coordinates.lng, photoWithLocation.coordinates.lat];
      }

      const photoWithDate = photos.find(p => p.dateTaken);
      if (photoWithDate && !date) {
        date = photoWithDate.dateTaken;
      }
    }

    // Create memory object
    const memory = {
      matchId,
      matchType: matchType || 'manual',
      homeTeam: homeTeamData,
      awayTeam: awayTeamData,
      venue: venueData || { name: '', city: '', country: '' },
      competition: competition || '',
      date: date ? new Date(date) : new Date(),
      userScore: userScore || '',
      userNotes: userNotes || '',
      photos,
      attendedDate: new Date()
    };

    // Add to user's memories
    const user = await User.findById(req.user.id);
    user.attendedMatches.push(memory);
    await user.save();

    // Return the newly created memory
    const newMemory = user.attendedMatches[user.attendedMatches.length - 1];

    res.status(201).json({
      success: true,
      data: newMemory,
      message: 'Memory created successfully'
    });

  } catch (error) {
    console.error('Error creating memory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create memory',
      error: error.message
    });
  }
});

/**
 * PUT /api/memories/:id
 * Update a memory (including photo management)
 */
router.put('/:id', auth, upload.array('photos', 10), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const memory = user.attendedMatches.id(req.params.id);
    
    if (!memory) {
      return res.status(404).json({
        success: false,
        message: 'Memory not found'
      });
    }

    // Handle regular field updates
    const allowedUpdates = ['userScore', 'userNotes', 'venue', 'competition', 'date'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'date') {
          memory[field] = new Date(req.body[field]);
        } else if (field === 'venue' && typeof req.body[field] === 'string') {
          try {
            memory[field] = JSON.parse(req.body[field]);
          } catch (e) {
            memory[field] = req.body[field];
          }
        } else {
          memory[field] = req.body[field];
        }
      }
    });

    // Handle new photo uploads
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploadResult = await cloudinaryService.uploadPhoto(file.buffer, {
            public_id: `${memory.matchId}-${Date.now()}`,
            tags: ['memory', 'football', 'match']
          });

          if (uploadResult.success) {
            const newPhoto = {
              publicId: uploadResult.metadata.publicId,
              url: uploadResult.metadata.url,
              thumbnailUrl: cloudinaryService.generateThumbnailUrl(uploadResult.metadata.publicId),
              width: uploadResult.metadata.width,
              height: uploadResult.metadata.height,
              format: uploadResult.metadata.format,
              size: uploadResult.metadata.size,
              coordinates: uploadResult.metadata.coordinates,
              dateTaken: uploadResult.metadata.dateTaken,
              uploadDate: new Date(),
              caption: ''
            };

            memory.photos.push(newPhoto);
            console.log(`✅ New photo added: ${uploadResult.metadata.publicId}`);
          }
        } catch (uploadError) {
          console.error('❌ Photo upload error:', uploadError);
        }
      }
    }

    await user.save();

    res.json({
      success: true,
      data: memory,
      message: 'Memory updated successfully'
    });

  } catch (error) {
    console.error('Error updating memory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update memory',
      error: error.message
    });
  }
});

/**
 * DELETE /api/memories/:id
 * Delete a memory and all associated photos
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const memory = user.attendedMatches.id(req.params.id);
    
    if (!memory) {
      return res.status(404).json({
        success: false,
        message: 'Memory not found'
      });
    }

    // Delete photos from Cloudinary
    if (memory.photos && memory.photos.length > 0) {
      console.log(`🗑️ Deleting ${memory.photos.length} photo(s) from Cloudinary for memory ${memory.matchId}`);
      
      for (const photo of memory.photos) {
        if (photo.publicId) {
          try {
            console.log(`🗑️ Deleting photo: ${photo.publicId}`);
            await cloudinaryService.deletePhoto(photo.publicId);
            console.log(`✅ Photo deleted from Cloudinary: ${photo.publicId}`);
          } catch (deleteError) {
            console.error('❌ Photo deletion error:', deleteError);
          }
        } else {
          console.warn(`⚠️ Photo missing publicId:`, photo);
        }
      }
    } else {
      console.log('📸 No photos to delete for this memory');
    }

    // Remove memory from user
    user.attendedMatches.pull(req.params.id);
    await user.save();

    res.json({
      success: true,
      message: 'Memory deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting memory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete memory',
      error: error.message
    });
  }
});

/**
 * Helper function to calculate memory statistics
 */
function calculateMemoryStats(memories) {
  const stats = {
    totalMemories: memories.length,
    totalPhotos: 0,
    uniqueStadiums: new Set(),
    uniqueCountries: new Set(),
    uniqueLeagues: new Set(),
    dateRange: null
  };

  if (memories.length > 0) {
    const dates = memories.map(m => new Date(m.date)).filter(d => !isNaN(d));
    if (dates.length > 0) {
      stats.dateRange = {
        earliest: new Date(Math.min(...dates)),
        latest: new Date(Math.max(...dates))
      };
    }
  }

  memories.forEach(memory => {
    // Count photos
    if (memory.photos) {
      stats.totalPhotos += memory.photos.length;
    }

    // Count unique stadiums
    if (memory.venue?.name) {
      stats.uniqueStadiums.add(memory.venue.name);
    }

    // Count unique countries
    if (memory.venue?.country) {
      stats.uniqueCountries.add(memory.venue.country);
    }

    // Count unique leagues
    if (memory.competition) {
      stats.uniqueLeagues.add(memory.competition);
    }
  });

  // Convert Sets to counts
  stats.uniqueStadiumsCount = stats.uniqueStadiums.size;
  stats.uniqueCountriesCount = stats.uniqueCountries.size;
  stats.uniqueLeaguesCount = stats.uniqueLeagues.size;

  // Remove Sets from response
  delete stats.uniqueStadiums;
  delete stats.uniqueCountries;
  delete stats.uniqueLeagues;

  return stats;
}

module.exports = router;
