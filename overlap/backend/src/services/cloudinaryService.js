const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || 'demo',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'demo'
});

class CloudinaryService {
  constructor() {
    this.cloudinary = cloudinary;
  }

  /**
   * Upload a photo to Cloudinary with metadata extraction
   * @param {Buffer} fileBuffer - File buffer
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} - Upload result with metadata
   */
  async uploadPhoto(fileBuffer, options = {}) {
    try {
      // Check if Cloudinary is properly configured
      if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME === 'demo') {
        console.warn('⚠️ Cloudinary not configured - using fallback storage');
        return {
          success: false,
          error: 'Cloudinary not configured. Please set up CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.'
        };
      }

      const uploadOptions = {
        resource_type: 'auto',
        folder: 'memories',
        transformation: [
          { quality: 'auto:good' }, // Optimize quality
          { fetch_format: 'auto' }  // Convert to best format
        ],
        ...options
      };

      // Upload to Cloudinary
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        uploadStream.end(fileBuffer);
      });

      // Extract metadata from the result
      const metadata = {
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
        createdAt: result.created_at,
        coordinates: result.exif?.GPSLatitude && result.exif?.GPSLongitude ? {
          lat: this.parseGPSCoordinate(result.exif.GPSLatitude, result.exif.GPSLatitudeRef),
          lng: this.parseGPSCoordinate(result.exif.GPSLongitude, result.exif.GPSLongitudeRef)
        } : null,
        dateTaken: result.exif?.DateTimeOriginal ? new Date(result.exif.DateTimeOriginal) : null
      };

      console.log(`✅ Photo uploaded to Cloudinary: ${result.public_id}`);
      console.log(`📍 Location data:`, metadata.coordinates);
      console.log(`📅 Date taken:`, metadata.dateTaken);
      console.log(`📊 EXIF data available:`, {
        hasGPS: !!(result.exif?.GPSLatitude && result.exif?.GPSLongitude),
        hasDateTime: !!result.exif?.DateTimeOriginal,
        exifKeys: result.exif ? Object.keys(result.exif) : 'No EXIF data'
      });
      console.log(`📸 Full Cloudinary result:`, {
        public_id: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
        exif: result.exif
      });

      return {
        success: true,
        data: result,
        metadata
      };

    } catch (error) {
      console.error('❌ Cloudinary upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse GPS coordinates from EXIF data
   * @param {Array} coordinate - GPS coordinate array
   * @param {String} ref - GPS reference (N/S, E/W)
   * @returns {Number} - Parsed coordinate
   */
  parseGPSCoordinate(coordinate, ref) {
    if (!coordinate || !Array.isArray(coordinate)) return null;
    
    const degrees = coordinate[0] || 0;
    const minutes = coordinate[1] || 0;
    const seconds = coordinate[2] || 0;
    
    let decimal = degrees + (minutes / 60) + (seconds / 3600);
    
    // Apply reference direction
    if (ref === 'S' || ref === 'W') {
      decimal = -decimal;
    }
    
    return decimal;
  }

  /**
   * Delete a photo from Cloudinary
   * @param {String} publicId - Cloudinary public ID
   * @returns {Promise<Object>} - Deletion result
   */
  async deletePhoto(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      console.log(`🗑️ Photo deleted from Cloudinary: ${publicId}`);
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Cloudinary deletion error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate optimized thumbnail URL
   * @param {String} publicId - Cloudinary public ID
   * @param {Object} options - Thumbnail options
   * @returns {String} - Thumbnail URL
   */
  generateThumbnailUrl(publicId, options = {}) {
    const defaultOptions = {
      width: 300,
      height: 300,
      crop: 'fill',
      quality: 'auto:good',
      format: 'auto'
    };

    const thumbnailOptions = { ...defaultOptions, ...options };
    return cloudinary.url(publicId, thumbnailOptions);
  }

  /**
   * Get photo statistics
   * @param {String} publicId - Cloudinary public ID
   * @returns {Promise<Object>} - Photo statistics
   */
  async getPhotoStats(publicId) {
    try {
      const result = await cloudinary.api.resource(publicId);
      return {
        success: true,
        data: {
          views: result.views || 0,
          downloads: result.downloads || 0,
          format: result.format,
          size: result.bytes,
          dimensions: {
            width: result.width,
            height: result.height
          }
        }
      };
    } catch (error) {
      console.error('❌ Error getting photo stats:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new CloudinaryService();
