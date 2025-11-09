const Amadeus = require('amadeus');

/**
 * Amadeus Flight API Provider
 * Implements the flight search adapter pattern
 */
class AmadeusProvider {
  constructor() {
    const clientId = process.env.AMADEUS_CLIENT_ID;
    const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
    const environment = process.env.AMADEUS_ENVIRONMENT || 'test';

    if (!clientId || !clientSecret) {
      throw new Error('Amadeus credentials not configured. Set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET');
    }

    this.amadeus = new Amadeus({
      clientId,
      clientSecret,
      hostname: environment === 'production' ? 'production' : 'test'
    });
  }

  /**
   * Search for flights
   * @param {Object} params - Search parameters
   * @param {string} params.origin - Origin airport IATA code
   * @param {string} params.destination - Destination airport IATA code
   * @param {string} params.departureDate - Departure date (YYYY-MM-DD)
   * @param {string} [params.returnDate] - Return date (YYYY-MM-DD) for round trips
   * @param {number} [params.adults=1] - Number of adult passengers
   * @param {number} [params.max=10] - Maximum number of results
   * @param {string} [params.currency='USD'] - Currency code
   * @param {boolean} [params.nonStop=false] - Filter to only nonstop/direct flights
   * @returns {Promise<Array>} Array of normalized flight offers
   */
  async searchFlights(params) {
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
      } = params;

      // Validate required parameters
      if (!origin || !destination || !departureDate) {
        throw new Error('Missing required parameters: origin, destination, departureDate');
      }

      // Build search parameters
      const searchParams = {
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate,
        adults: Number(adults),
        max: Number(max),
        currencyCode: currency
      };

      // Add return date if provided (round trip)
      if (returnDate) {
        searchParams.returnDate = returnDate;
      }

      // Add nonstop filter if requested
      if (nonStop === true || nonStop === 'true') {
        searchParams.nonStop = true;
      }

      // Make API call
      const response = await this.amadeus.shopping.flightOffersSearch.get(searchParams);

      // Handle empty results
      if (!response.data || response.data.length === 0) {
        return [];
      }

      // Normalize and return results
      return this.normalizeFlightOffers(response.data);
    } catch (error) {
      console.error('Amadeus flight search error:', {
        message: error.message,
        code: error.code,
        description: error.description
      });

      // Re-throw with more context
      throw new Error(`Amadeus API error: ${error.description || error.message}`);
    }
  }

  /**
   * Normalize Amadeus flight offers to our standard format
   * @param {Array} offers - Raw Amadeus flight offers
   * @returns {Array} Normalized flight offers
   */
  normalizeFlightOffers(offers) {
    return offers.map(offer => {
      const segments = offer.itineraries[0].segments;
      const firstSegment = segments[0];
      const lastSegment = segments[segments.length - 1];

      return {
        id: offer.id,
        price: {
          currency: offer.price.currency,
          amount: parseFloat(offer.price.total),
          formatted: `${offer.price.currency} ${offer.price.total}`
        },
        origin: {
          code: firstSegment.departure.iataCode,
          name: firstSegment.departure.iataCode, // Will need airport lookup for full name
          city: firstSegment.departure.iataCode
        },
        destination: {
          code: lastSegment.arrival.iataCode,
          name: lastSegment.arrival.iataCode,
          city: lastSegment.arrival.iataCode
        },
        departure: {
          date: firstSegment.departure.at,
          time: firstSegment.departure.at.split('T')[1]?.substring(0, 5), // HH:MM
          airport: firstSegment.departure.iataCode
        },
        arrival: {
          date: lastSegment.arrival.at,
          time: lastSegment.arrival.at.split('T')[1]?.substring(0, 5),
          airport: lastSegment.arrival.iataCode
        },
        duration: this.calculateDuration(firstSegment.departure.at, lastSegment.arrival.at),
        stops: segments.length - 1,
        airline: {
          name: firstSegment.carrierCode, // Will need airline lookup for full name
          code: firstSegment.carrierCode
        },
        segments: segments.map(seg => ({
          departure: {
            airport: seg.departure.iataCode,
            time: seg.departure.at
          },
          arrival: {
            airport: seg.arrival.iataCode,
            time: seg.arrival.at
          },
          duration: this.calculateDuration(seg.departure.at, seg.arrival.at),
          carrier: seg.carrierCode
        })),
        bookingUrl: null, // Amadeus free tier doesn't provide booking URLs
        provider: 'amadeus'
      };
    });
  }

  /**
   * Calculate duration in minutes between two ISO datetime strings
   * @param {string} departure - ISO datetime string
   * @param {string} arrival - ISO datetime string
   * @returns {number} Duration in minutes
   */
  calculateDuration(departure, arrival) {
    const dep = new Date(departure);
    const arr = new Date(arrival);
    return Math.round((arr - dep) / (1000 * 60)); // minutes
  }

  /**
   * Search for airports by keyword (for autocomplete)
   * @param {string} query - Search query
   * @param {number} [limit=10] - Maximum results
   * @returns {Promise<Array>} Array of airport objects
   */
  async searchAirports(query, limit = 10) {
    try {
      const response = await this.amadeus.referenceData.locations.get({
        keyword: query,
        subType: 'AIRPORT',
        'page[limit]': limit
      });

      if (!response.data) {
        return [];
      }

      return response.data.map(airport => ({
        code: airport.iataCode,
        name: airport.name,
        city: airport.address?.cityName || '',
        country: airport.address?.countryCode || '',
        coordinates: {
          lat: airport.geoCode?.latitude,
          lng: airport.geoCode?.longitude
        }
      }));
    } catch (error) {
      console.error('Airport search error:', error);
      return [];
    }
  }

  /**
   * Get nearest airports by coordinates
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {number} [radius=100] - Search radius in km
   * @param {number} [limit=3] - Maximum results
   * @returns {Promise<Array>} Array of airport objects
   */
  async getNearestAirports(latitude, longitude, radius = 100, limit = 3) {
    try {
      const response = await this.amadeus.referenceData.locations.airports.get({
        latitude,
        longitude,
        radius: Number(radius),
        'page[limit]': Number(limit),
        sort: 'distance'
      });

      if (!response.data) {
        return [];
      }

      return response.data.map(airport => ({
        code: airport.iataCode,
        name: airport.name,
        city: airport.address?.cityName || '',
        country: airport.address?.countryCode || '',
        distance: airport.distance?.value, // in km
        coordinates: {
          lat: airport.geoCode?.latitude,
          lng: airport.geoCode?.longitude
        }
      }));
    } catch (error) {
      console.error('Nearest airports error:', error);
      return [];
    }
  }
}

module.exports = AmadeusProvider;

