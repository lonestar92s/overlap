const AmadeusProvider = require('../providers/amadeusProvider');
const RouteCostHistory = require('../models/RouteCostHistory');

/**
 * Transportation Service
 * Orchestrates flight and train search across multiple providers
 */
class TransportationService {
  constructor() {
    this.flightProviders = [];
    this.trainProviders = [];

    // Initialize flight providers
    try {
      this.flightProviders.push(new AmadeusProvider());
    } catch (error) {
      console.warn('Amadeus provider not available:', error.message);
    }

    // TODO: Add SkyscannerProvider as fallback
    // TODO: Add train providers (Rail Europe, etc.)
  }

  /**
   * Search flights with fallback chain
   * @param {Object} params - Search parameters
   * @returns {Promise<Object>} Search results with provider info
   */
  async searchFlights(params) {
    if (this.flightProviders.length === 0) {
      throw new Error('No flight providers configured');
    }

    let lastError = null;

    // Try each provider in order
    for (const provider of this.flightProviders) {
      try {
        const results = await provider.searchFlights(params);
        
        // Update route cost history asynchronously (don't block response)
        this.updateRouteCostHistory(
          params.origin,
          params.destination,
          'flight',
          results
        ).catch(err => {
          console.error('Failed to update route cost history:', err);
        });

        return {
          success: true,
          results,
          provider: provider.constructor.name,
          count: results.length
        };
      } catch (error) {
        console.error(`${provider.constructor.name} failed:`, error.message);
        lastError = error;
        continue; // Try next provider
      }
    }

    // All providers failed
    throw new Error(
      `All flight providers failed. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Search trains (placeholder for future implementation)
   * @param {Object} params - Search parameters
   * @returns {Promise<Object>} Search results
   */
  async searchTrains(params) {
    // TODO: Implement train search
    throw new Error('Train search not yet implemented');
  }

  /**
   * Update route cost history with new prices
   * @param {string} origin - Origin code
   * @param {string} destination - Destination code
   * @param {string} type - 'flight' or 'train'
   * @param {Array} results - Search results with prices
   */
  async updateRouteCostHistory(origin, destination, type, results) {
    if (!results || results.length === 0) return;

    try {
      // Extract prices from results
      const prices = results
        .map(r => ({
          amount: r.price?.amount,
          currency: r.price?.currency || 'USD'
        }))
        .filter(p => p.amount != null);

      if (prices.length === 0) return;

      // Find or create route cost history
      const route = await RouteCostHistory.findOrCreate(
        origin,
        destination,
        type,
        prices[0].currency
      );

      // Add price points for each result
      prices.forEach(price => {
        route.addPricePoint(
          price.amount,
          price.currency,
          results[0].provider || 'unknown',
          { resultCount: results.length }
        );
      });

      // Save route
      await route.save();
    } catch (error) {
      console.error('Error updating route cost history:', error);
      // Don't throw - this is a background operation
    }
  }

  /**
   * Get route cost history
   * @param {string} origin - Origin code
   * @param {string} destination - Destination code
   * @param {string} type - 'flight' or 'train'
   * @param {string} [currency='USD'] - Currency code
   * @returns {Promise<Object|null>} Route cost history
   */
  async getRouteCostHistory(origin, destination, type, currency = 'USD') {
    try {
      const route = await RouteCostHistory.findOne({
        'origin.code': origin,
        'destination.code': destination,
        type,
        currency
      });

      return route;
    } catch (error) {
      console.error('Error getting route cost history:', error);
      return null;
    }
  }

  /**
   * Search airports by keyword
   * @param {string} query - Search query
   * @param {number} [limit=10] - Maximum results
   * @returns {Promise<Array>} Array of airports
   */
  async searchAirports(query, limit = 10) {
    if (this.flightProviders.length === 0) {
      return [];
    }

    // Use first available provider
    try {
      return await this.flightProviders[0].searchAirports(query, limit);
    } catch (error) {
      console.error('Airport search error:', error);
      return [];
    }
  }

  /**
   * Get nearest airports
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {number} [radius=100] - Search radius in km
   * @param {number} [limit=3] - Maximum results
   * @returns {Promise<Array>} Array of airports
   */
  async getNearestAirports(latitude, longitude, radius = 100, limit = 3) {
    if (this.flightProviders.length === 0) {
      return [];
    }

    // Use first available provider
    try {
      return await this.flightProviders[0].getNearestAirports(
        latitude,
        longitude,
        radius,
        limit
      );
    } catch (error) {
      console.error('Nearest airports error:', error);
      return [];
    }
  }

  /**
   * Get flight status by flight number and date
   * @param {string} flightNumber - Full flight number (e.g., "AA100", "DL1234")
   * @param {string} scheduledDepartureDate - Scheduled departure date (YYYY-MM-DD)
   * @returns {Promise<Object>} Flight status information
   */
  async getFlightStatus(flightNumber, scheduledDepartureDate) {
    if (this.flightProviders.length === 0) {
      throw new Error('No flight providers configured');
    }

    // Parse flight number into airline code and number
    const provider = this.flightProviders[0];
    const { airlineCode, flightNumber: number } = provider.parseFlightNumber(flightNumber);

    // Use first available provider
    try {
      return await provider.getFlightStatus(airlineCode, number, scheduledDepartureDate);
    } catch (error) {
      console.error('Flight status error:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new TransportationService();

