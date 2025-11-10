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
      const itinerary = offer.itineraries[0];
      const segments = itinerary.segments;
      const firstSegment = segments[0];
      const lastSegment = segments[segments.length - 1];

      // Use Amadeus-provided duration directly
      // Duration is in ISO 8601 format (e.g., "PT8H5M") - parse to minutes
      let duration = 0;
      if (itinerary.duration) {
        if (typeof itinerary.duration === 'string') {
          // Parse ISO 8601 duration string
          duration = this.parseISODuration(itinerary.duration);
        } else if (typeof itinerary.duration === 'number') {
          // Already in minutes
          duration = itinerary.duration;
        }
      }
      
      // Fallback to calculation if duration not available
      if (!duration || duration === 0) {
        duration = this.calculateDuration(firstSegment.departure.at, lastSegment.arrival.at);
      }

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
        duration: duration,
        stops: segments.length - 1,
        airline: {
          name: firstSegment.carrierCode, // Will need airline lookup for full name
          code: firstSegment.carrierCode
        },
        segments: segments.map(seg => {
          // For individual segments, try to use duration if available, otherwise calculate
          const segDuration = seg.duration 
            ? this.parseISODuration(seg.duration)
            : this.calculateDuration(seg.departure.at, seg.arrival.at);
          
          return {
            departure: {
              airport: seg.departure.iataCode,
              time: seg.departure.at
            },
            arrival: {
              airport: seg.arrival.iataCode,
              time: seg.arrival.at
            },
            duration: segDuration,
            carrier: seg.carrierCode
          };
        }),
        bookingUrl: null, // Amadeus free tier doesn't provide booking URLs
        provider: 'amadeus'
      };
    });
  }

  /**
   * Parse ISO 8601 duration string to minutes
   * @param {string} duration - ISO 8601 duration (e.g., "PT8H5M" for 8 hours 5 minutes)
   * @returns {number} Duration in minutes
   */
  parseISODuration(duration) {
    if (!duration) return 0;
    
    // ISO 8601 format: PT8H5M (Period Time: 8 Hours 5 Minutes)
    // Also handles formats like: PT14H5M, PT8H, PT45M, etc.
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) {
      console.warn('Failed to parse ISO duration:', duration);
      return 0;
    }
    
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    
    const totalMinutes = hours * 60 + minutes + Math.round(seconds / 60);
    
    // Debug logging
    if (process.env.NODE_ENV !== 'production') {
      console.log('Parsed duration:', {
        input: duration,
        hours,
        minutes,
        seconds,
        totalMinutes
      });
    }
    
    return totalMinutes;
  }

  /**
   * Calculate duration in minutes between two ISO datetime strings
   * Note: This method is less accurate due to timezone issues. Prefer using parseISODuration
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
   * Get flight status by flight number and date
   * @param {string} airlineCode - Airline IATA code (e.g., "AA", "DL", "UA")
   * @param {string} flightNumber - Flight number (e.g., "100", "1234")
   * @param {string} scheduledDepartureDate - Scheduled departure date (YYYY-MM-DD)
   * @returns {Promise<Object>} Flight status information
   */
  async getFlightStatus(airlineCode, flightNumber, scheduledDepartureDate) {
    try {
      // Amadeus Flight Status API endpoint
      // Note: API uses 'flightNumber' parameter, not 'number'
      const params = {
        carrierCode: airlineCode,
        flightNumber: flightNumber,
        scheduledDepartureDate
      };
      
      console.log('Calling Amadeus Flight Status API with params:', params);
      
      const response = await this.amadeus.schedule.flights.get(params);

      console.log('Amadeus Flight Status API response:', {
        hasData: !!response.data,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        fullResponse: JSON.stringify(response, null, 2).substring(0, 500) // First 500 chars for debugging
      });

      // Handle empty or invalid response
      if (!response.data) {
        throw new Error('Flight not found - no data returned');
      }

      // Response can be an array or single object
      const flight = Array.isArray(response.data) ? response.data[0] : response.data;
      
      if (!flight) {
        throw new Error('Flight not found');
      }

      // Normalize the response to our standard format
      // Amadeus Flight Status API structure: { type, id, flightNumber, carrierCode, departure: { iataCode, at }, arrival: { iataCode, at }, duration, status }
      return {
        flightNumber: `${airlineCode}${flight.flightNumber || flightNumber}`,
        airline: {
          code: flight.carrierCode || airlineCode,
          name: flight.operating?.carrierCode || flight.carrierCode || airlineCode
        },
        departure: {
          airport: {
            code: flight.departure?.iataCode,
            name: flight.departure?.iataCode // Airport name would need separate lookup
          },
          date: flight.departure?.at ? flight.departure.at.split('T')[0] : null,
          time: flight.departure?.at ? flight.departure.at.split('T')[1]?.substring(0, 5) : null,
          terminal: flight.departure?.terminal || null,
          gate: flight.departure?.gate || null
        },
        arrival: {
          airport: {
            code: flight.arrival?.iataCode,
            name: flight.arrival?.iataCode // Airport name would need separate lookup
          },
          date: flight.arrival?.at ? flight.arrival.at.split('T')[0] : null,
          time: flight.arrival?.at ? flight.arrival.at.split('T')[1]?.substring(0, 5) : null,
          terminal: flight.arrival?.terminal || null,
          gate: flight.arrival?.gate || null
        },
        duration: flight.duration ? this.parseISODuration(flight.duration) : null,
        aircraft: flight.aircraft?.code || null,
        status: flight.status || 'SCHEDULED'
      };
    } catch (error) {
      console.error('Amadeus flight status error:', {
        message: error.message,
        code: error.code,
        description: error.description,
        airlineCode,
        flightNumber,
        scheduledDepartureDate,
        response: error.response?.data,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });

      // Better error message handling
      let errorMessage = 'Failed to get flight status';
      if (error.description) {
        errorMessage += `: ${error.description}`;
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      } else if (error.response?.data) {
        errorMessage += `: ${JSON.stringify(error.response.data)}`;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Parse flight number into airline code and flight number
   * @param {string} flightNumber - Full flight number (e.g., "AA100", "DL1234")
   * @returns {Object} { airlineCode, flightNumber }
   */
  parseFlightNumber(fullFlightNumber) {
    // Remove any spaces or dashes
    const cleaned = fullFlightNumber.replace(/[\s-]/g, '').toUpperCase();
    
    // Match airline code (2-3 letters) followed by flight number (1-4 digits)
    const match = cleaned.match(/^([A-Z]{2,3})(\d{1,4})$/);
    
    if (!match) {
      throw new Error(`Invalid flight number format: ${fullFlightNumber}. Expected format: AA100 or DL1234`);
    }
    
    return {
      airlineCode: match[1],
      flightNumber: match[2]
    };
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

