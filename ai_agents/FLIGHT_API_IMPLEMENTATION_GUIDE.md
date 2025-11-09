# Flight API Implementation Guide

**Date**: 2025-01-31  
**API Provider**: Amadeus (Primary)  
**Status**: Ready to implement

---

## API Provider Recommendation

### 🏆 **Amadeus API** (Recommended - Start Here)

**Why Amadeus**:
- ✅ **Free tier available**: Self-Service tier with 2,000 API calls/month
- ✅ **Excellent documentation**: Comprehensive guides and SDKs
- ✅ **Global coverage**: 200+ airlines, worldwide routes
- ✅ **Real-time pricing**: Live flight data
- ✅ **Good for startups**: Free tier perfect for development/testing
- ✅ **Easy integration**: REST API with JSON responses
- ✅ **SDK available**: Node.js SDK for easier integration

**Pricing**:
- **Self-Service (Free)**: 2,000 API calls/month
- **Standard**: $0.10 per API call (after free tier)
- **Enterprise**: Custom pricing for high volume

**Limitations**:
- Free tier: 2,000 calls/month (enough for development)
- Rate limit: 10 requests/second
- No booking capability on free tier (search only)

**Get Started**:
1. Sign up: https://developers.amadeus.com/
2. Create app in developer portal
3. Get API Key and API Secret
4. Use test environment for development

---

### Alternative: Skyscanner (Fallback)

**Why Skyscanner**:
- ✅ Revenue share model (no upfront cost)
- ✅ Aggregates multiple providers
- ✅ Good for affiliate monetization

**Limitations**:
- ❌ Requires affiliate partnership approval
- ❌ Longer approval process
- ❌ Less control over data format

**Recommendation**: Start with Amadeus, add Skyscanner later as fallback if needed.

---

## Implementation Plan

### Phase 1: Setup & Infrastructure (This Week)

#### Step 1: Get Amadeus API Credentials

1. **Sign up for Amadeus Developer Account**:
   - Go to: https://developers.amadeus.com/
   - Click "Get Started for Free"
   - Create account

2. **Create Application**:
   - Go to "My Self-Service Workspace"
   - Click "Create New App"
   - Name: "Flight Match Finder"
   - Get your **API Key** and **API Secret**
   - **Note**: In the Amadeus dashboard, these are called "API Key" and "API Secret"
   - In our code, we use them as `AMADEUS_CLIENT_ID` (API Key) and `AMADEUS_CLIENT_SECRET` (API Secret)
   - This is because Amadeus uses OAuth 2.0, where API Key = Client ID

3. **Test Environment**:
   - Use **Test** environment for development
   - Test API Key starts with `test_`
   - Production API Key starts with `live_`

#### Step 2: Backend Setup

**File Structure**:
```
overlap/backend/
├── src/
│   ├── services/
│   │   └── transportationService.js (NEW)
│   ├── providers/
│   │   └── amadeusProvider.js (NEW)
│   ├── models/
│   │   └── RouteCostHistory.js (NEW)
│   └── routes/
│       └── transportation.js (NEW)
```

**Environment Variables** (`.env`):
```bash
# Amadeus API (Test Environment)
# Note: In Amadeus dashboard, these are called "API Key" and "API Secret"
# But we use CLIENT_ID/CLIENT_SECRET because Amadeus uses OAuth 2.0
AMADEUS_CLIENT_ID=test_xxxxxxxxxxxxx    # This is your "API Key" from Amadeus dashboard
AMADEUS_CLIENT_SECRET=test_xxxxxxxxxxxxx # This is your "API Secret" from Amadeus dashboard
AMADEUS_ENVIRONMENT=test  # or 'production'

# Optional: Skyscanner (for later)
SKYSCANNER_API_KEY=xxx
```

#### Step 3: Install Dependencies

```bash
cd overlap/backend
npm install amadeus
```

---

### Phase 2: Backend Implementation

#### Step 1: Create Amadeus Provider

**File**: `overlap/backend/src/providers/amadeusProvider.js`

```javascript
const Amadeus = require('amadeus');

class AmadeusProvider {
  constructor() {
    this.amadeus = new Amadeus({
      clientId: process.env.AMADEUS_API_KEY,
      clientSecret: process.env.AMADEUS_API_SECRET,
      hostname: process.env.AMADEUS_ENVIRONMENT === 'production' 
        ? 'production' 
        : 'test'
    });
  }

  /**
   * Search for flights
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} Flight results
   */
  async searchFlights(params) {
    try {
      const {
        origin,
        destination,
        dateFrom,
        dateTo,
        returnDate,
        passengers = 1,
        class: travelClass = 'ECONOMY'
      } = params;

      // Build request
      const request = {
        originLocationCode: origin, // e.g., "JFK", "NYC"
        destinationLocationCode: destination, // e.g., "MAD", "LON"
        departureDate: dateFrom, // YYYY-MM-DD
        adults: passengers,
        travelClass: travelClass,
        currencyCode: 'USD',
        max: 10 // Limit results
      };

      // Add return date if round trip
      if (returnDate) {
        request.returnDate = returnDate;
      }

      // Add date range for one-way (if dateTo provided)
      if (dateTo && !returnDate) {
        // Amadeus doesn't support date ranges directly
        // We'll search for the start date and filter client-side
        // Or make multiple requests for date range
      }

      const response = await this.amadeus.shopping.flightOffersSearch.get(request);
      
      return this.formatFlightResults(response.data);
    } catch (error) {
      console.error('Amadeus API error:', error);
      throw new Error(`Flight search failed: ${error.message}`);
    }
  }

  /**
   * Format Amadeus response to our standard format
   */
  formatFlightResults(data) {
    if (!data || !data.length) {
      return [];
    }

    return data.map(offer => {
      const itinerary = offer.itineraries[0];
      const segments = itinerary.segments;
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
          name: firstSegment.departure.at, // Airport name
          city: firstSegment.departure.iataCode // Will need airport lookup
        },
        destination: {
          code: lastSegment.arrival.iataCode,
          name: lastSegment.arrival.at,
          city: lastSegment.arrival.iataCode
        },
        departure: {
          date: firstSegment.departure.at,
          time: firstSegment.departure.at.split('T')[1],
          airport: firstSegment.departure.iataCode
        },
        arrival: {
          date: lastSegment.arrival.at,
          time: lastSegment.arrival.at.split('T')[1],
          airport: lastSegment.arrival.iataCode
        },
        duration: this.calculateDuration(firstSegment.departure.at, lastSegment.arrival.at),
        stops: segments.length - 1,
        airline: {
          name: firstSegment.carrierCode, // Will need airline lookup
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
        bookingUrl: null // Amadeus free tier doesn't provide booking
      };
    });
  }

  /**
   * Calculate duration in minutes
   */
  calculateDuration(departure, arrival) {
    const dep = new Date(departure);
    const arr = new Date(arrival);
    return Math.round((arr - dep) / (1000 * 60)); // minutes
  }

  /**
   * Get airport information (for autocomplete)
   */
  async searchAirports(query) {
    try {
      const response = await this.amadeus.referenceData.locations.get({
        keyword: query,
        subType: 'AIRPORT',
        'page[limit]': 10
      });

      return response.data.map(airport => ({
        code: airport.iataCode,
        name: airport.name,
        city: airport.address.cityName,
        country: airport.address.countryCode,
        coordinates: {
          lat: airport.geoCode.latitude,
          lng: airport.geoCode.longitude
        }
      }));
    } catch (error) {
      console.error('Airport search error:', error);
      return [];
    }
  }
}

module.exports = AmadeusProvider;
```

#### Step 2: Create Transportation Service

**File**: `overlap/backend/src/services/transportationService.js`

```javascript
const AmadeusProvider = require('../providers/amadeusProvider');
const RouteCostHistory = require('../models/RouteCostHistory');

class TransportationService {
  constructor() {
    this.flightProviders = [
      new AmadeusProvider()
      // Add SkyscannerProvider later as fallback
    ];
  }

  /**
   * Search flights with fallback chain
   */
  async searchFlights(params) {
    let lastError = null;

    for (const provider of this.flightProviders) {
      try {
        const results = await provider.searchFlights(params);
        
        // Update route cost history
        await this.updateRouteCostHistory(
          params.origin,
          params.destination,
          'flight',
          results
        );

        return {
          success: true,
          results,
          provider: provider.constructor.name
        };
      } catch (error) {
        console.error(`${provider.constructor.name} failed:`, error);
        lastError = error;
        continue; // Try next provider
      }
    }

    throw new Error(`All flight providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Update route cost history with new prices
   */
  async updateRouteCostHistory(origin, destination, type, results) {
    if (!results || results.length === 0) return;

    // Extract prices
    const prices = results
      .map(r => r.price?.amount)
      .filter(p => p != null);

    if (prices.length === 0) return;

    // Find or create route cost history
    const routeKey = `${origin}-${destination}`;
    let routeCost = await RouteCostHistory.findOne({
      'route.origin.code': origin,
      'route.destination.code': destination,
      type
    });

    if (!routeCost) {
      routeCost = new RouteCostHistory({
        route: {
          origin: { code: origin },
          destination: { code: destination }
        },
        type,
        currency: results[0].price?.currency || 'USD',
        priceHistory: [],
        statistics: {
          averagePrice: 0,
          minPrice: Infinity,
          maxPrice: 0,
          sampleCount: 0,
          lastUpdated: new Date()
        }
      });
    }

    // Add new prices to history
    const now = new Date();
    prices.forEach(price => {
      routeCost.priceHistory.push({
        date: now,
        price,
        currency: results[0].price?.currency || 'USD',
        source: 'api'
      });
    });

    // Update statistics
    const allPrices = routeCost.priceHistory.map(h => h.price);
    routeCost.statistics = {
      averagePrice: allPrices.reduce((a, b) => a + b, 0) / allPrices.length,
      minPrice: Math.min(...allPrices),
      maxPrice: Math.max(...allPrices),
      sampleCount: allPrices.length,
      lastUpdated: now
    };

    await routeCost.save();
  }

  /**
   * Get route cost history
   */
  async getRouteCost(origin, destination, type = 'flight', currency = 'USD') {
    const routeCost = await RouteCostHistory.findOne({
      'route.origin.code': origin,
      'route.destination.code': destination,
      type
    });

    if (!routeCost) {
      return null;
    }

    // Convert currency if needed (simplified - would need currency API)
    return {
      route: {
        origin: { code: routeCost.route.origin.code },
        destination: { code: routeCost.route.destination.code }
      },
      type,
      currency: routeCost.currency,
      statistics: routeCost.statistics,
      priceTrend: this.calculatePriceTrend(routeCost.priceHistory)
    };
  }

  /**
   * Calculate price trend (up/down/stable)
   */
  calculatePriceTrend(priceHistory) {
    if (priceHistory.length < 2) return 'stable';

    const recent = priceHistory.slice(-7); // Last 7 prices
    const older = priceHistory.slice(-14, -7); // Previous 7 prices

    if (recent.length === 0 || older.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b.price, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b.price, 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (change > 5) return 'up';
    if (change < -5) return 'down';
    return 'stable';
  }

  /**
   * Search airports for autocomplete
   */
  async searchAirports(query) {
    // Use first available provider
    if (this.flightProviders.length > 0) {
      return await this.flightProviders[0].searchAirports(query);
    }
    return [];
  }
}

module.exports = new TransportationService();
```

#### Step 3: Create Route Cost History Model

**File**: `overlap/backend/src/models/RouteCostHistory.js`

```javascript
const mongoose = require('mongoose');

const routeCostHistorySchema = new mongoose.Schema({
  route: {
    origin: {
      code: { type: String, required: true },
      city: String,
      country: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    destination: {
      code: { type: String, required: true },
      city: String,
      country: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    }
  },
  type: {
    type: String,
    enum: ['flight', 'train'],
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  statistics: {
    averagePrice: Number,
    minPrice: Number,
    maxPrice: Number,
    sampleCount: { type: Number, default: 0 },
    lastUpdated: Date
  },
  priceHistory: [{
    date: Date,
    price: Number,
    currency: String,
    source: {
      type: String,
      enum: ['user_search', 'api', 'aggregated'],
      default: 'api'
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
routeCostHistorySchema.index({ 'route.origin.code': 1, 'route.destination.code': 1, type: 1 });
routeCostHistorySchema.index({ 'statistics.lastUpdated': 1 });

// Update updatedAt on save
routeCostHistorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('RouteCostHistory', routeCostHistorySchema);
```

#### Step 4: Create API Routes

**File**: `overlap/backend/src/routes/transportation.js`

```javascript
const express = require('express');
const router = express.Router();
const transportationService = require('../services/transportationService');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/transportation/flights/search
 * Search for flights
 */
router.get('/flights/search', async (req, res) => {
  try {
    const {
      origin,
      destination,
      dateFrom,
      dateTo,
      returnDate,
      passengers = 1,
      class: travelClass = 'ECONOMY'
    } = req.query;

    // Validation
    if (!origin || !destination || !dateFrom) {
      return res.status(400).json({
        success: false,
        message: 'Origin, destination, and dateFrom are required'
      });
    }

    // Search flights
    const result = await transportationService.searchFlights({
      origin,
      destination,
      dateFrom,
      dateTo,
      returnDate,
      passengers: parseInt(passengers),
      class: travelClass
    });

    // Get route cost history for context
    const routeCost = await transportationService.getRouteCost(
      origin,
      destination,
      'flight'
    );

    // Enrich results with cost context
    const enrichedResults = result.results.map(flight => {
      const avgPrice = routeCost?.statistics?.averagePrice;
      const priceDiff = avgPrice ? flight.price.amount - avgPrice : 0;
      const isGoodDeal = priceDiff < -20; // 20 currency units below average

      return {
        ...flight,
        averagePrice: avgPrice,
        priceDifference: priceDiff,
        isGoodDeal
      };
    });

    // Calculate price range
    const prices = enrichedResults.map(f => f.price.amount);
    const priceRange = {
      min: Math.min(...prices),
      max: Math.max(...prices),
      average: prices.reduce((a, b) => a + b, 0) / prices.length
    };

    res.json({
      success: true,
      results: enrichedResults,
      priceRange,
      provider: result.provider
    });
  } catch (error) {
    console.error('Flight search error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to search flights'
    });
  }
});

/**
 * GET /api/transportation/airports/search
 * Search airports for autocomplete
 */
router.get('/airports/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        results: []
      });
    }

    const airports = await transportationService.searchAirports(query);

    res.json({
      success: true,
      results: airports
    });
  } catch (error) {
    console.error('Airport search error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to search airports'
    });
  }
});

/**
 * GET /api/transportation/route-cost/:origin/:destination
 * Get route cost history
 */
router.get('/route-cost/:origin/:destination', async (req, res) => {
  try {
    const { origin, destination } = req.params;
    const { currency = 'USD' } = req.query;

    const routeCost = await transportationService.getRouteCost(
      origin,
      destination,
      'flight',
      currency
    );

    if (!routeCost) {
      return res.json({
        success: true,
        route: { origin: { code: origin }, destination: { code: destination } },
        type: 'flight',
        message: 'No cost history available for this route'
      });
    }

    res.json({
      success: true,
      ...routeCost
    });
  } catch (error) {
    console.error('Route cost error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get route cost'
    });
  }
});

module.exports = router;
```

#### Step 5: Register Routes in Main App

**File**: `overlap/backend/src/app.js` (or main server file)

```javascript
// Add this import
const transportationRoutes = require('./routes/transportation');

// Add this route registration
app.use('/api/transportation', transportationRoutes);
```

---

### Phase 3: Mobile App Integration

#### Step 1: Extend ApiService

**File**: `mobile-app/services/api.js`

Add these methods to the `ApiService` class:

```javascript
// Add to ApiService class

/**
 * Search for flights
 */
async searchFlights({ origin, destination, dateFrom, dateTo, returnDate, passengers = 1, class: travelClass = 'ECONOMY' }) {
  try {
    const params = new URLSearchParams();
    params.append('origin', origin);
    params.append('destination', destination);
    params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    if (returnDate) params.append('returnDate', returnDate);
    params.append('passengers', passengers.toString());
    params.append('class', travelClass);

    const url = `${this.baseURL}/transportation/flights/search?${params.toString()}`;
    const response = await this.fetchWithTimeout(url, { method: 'GET' }, 20000);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || 'Failed to search flights');
    }

    return data;
  } catch (error) {
    console.error('Error searching flights:', error);
    throw error;
  }
}

/**
 * Search airports for autocomplete
 */
async searchAirports(query) {
  try {
    if (!query || query.trim().length < 2) {
      return { success: true, results: [] };
    }

    const params = new URLSearchParams();
    params.append('query', query.trim());

    const url = `${this.baseURL}/transportation/airports/search?${params.toString()}`;
    const response = await this.fetchWithTimeout(url, { method: 'GET' }, 10000);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || 'Failed to search airports');
    }

    return data;
  } catch (error) {
    console.error('Error searching airports:', error);
    return { success: false, results: [] };
  }
}

/**
 * Get route cost history
 */
async getRouteCost(origin, destination, currency = 'USD') {
  try {
    const params = new URLSearchParams();
    if (currency) params.append('currency', currency);

    const url = `${this.baseURL}/transportation/route-cost/${origin}/${destination}?${params.toString()}`;
    const response = await this.fetchWithTimeout(url, { method: 'GET' }, 10000);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || 'Failed to get route cost');
    }

    return data;
  } catch (error) {
    console.error('Error getting route cost:', error);
    return null;
  }
}
```

---

## Testing the Integration

### 1. Test Backend Endpoint

```bash
# Test flight search
curl "http://localhost:3001/api/transportation/flights/search?origin=JFK&destination=MAD&dateFrom=2025-02-15&passengers=1"

# Test airport search
curl "http://localhost:3001/api/transportation/airports/search?query=New%20York"

# Test route cost
curl "http://localhost:3001/api/transportation/route-cost/JFK/MAD"
```

### 2. Test with Postman/Thunder Client

Create requests for:
- Flight search
- Airport autocomplete
- Route cost history

---

## Next Steps

1. ✅ **Get Amadeus API credentials** (15 minutes)
2. ✅ **Set up environment variables** (5 minutes)
3. ✅ **Install Amadeus SDK** (2 minutes)
4. ✅ **Create provider class** (1-2 hours)
5. ✅ **Create service layer** (1-2 hours)
6. ✅ **Create API routes** (1 hour)
7. ✅ **Test backend endpoints** (30 minutes)
8. ✅ **Extend mobile ApiService** (30 minutes)
9. ✅ **Create FlightSearchScreen** (2-3 hours)
10. ✅ **Test end-to-end** (1 hour)

**Total Estimated Time**: 8-12 hours for basic flight search integration

---

## Common Issues & Solutions

### Issue 1: "Invalid API Key"
**Solution**: 
- Check environment variables are loaded
- Verify API key format (test keys start with `test_`)
- Ensure you're using test environment for development

### Issue 2: "Rate Limit Exceeded"
**Solution**:
- Free tier: 2,000 calls/month
- Implement caching to reduce API calls
- Use test environment (separate rate limits)

### Issue 3: "No Results Found"
**Solution**:
- Verify airport codes are correct (IATA codes)
- Check date format (YYYY-MM-DD)
- Some routes may not have flights on certain dates

### Issue 4: "Airport Not Found"
**Solution**:
- Use IATA codes (JFK, LHR, MAD) not city names
- Use airport search endpoint for autocomplete
- Handle city-to-airport conversion

---

## API Rate Limits & Best Practices

### Amadeus Free Tier Limits:
- **Monthly**: 2,000 API calls
- **Per Second**: 10 requests/second
- **Daily**: ~66 calls/day (if spread evenly)

### Best Practices:
1. **Cache aggressively**: Cache search results for 15-30 minutes
2. **Batch requests**: Don't make redundant calls
3. **Use airport search**: Cache airport data (doesn't change often)
4. **Monitor usage**: Track API calls to stay within limits
5. **Error handling**: Graceful fallback if API fails

---

## Production Considerations

### When Moving to Production:

1. **Upgrade Amadeus Plan**:
   - Standard tier: $0.10 per API call
   - Enterprise: Custom pricing for high volume

2. **Add Fallback Provider**:
   - Integrate Skyscanner as backup
   - Use adapter pattern (already in architecture)

3. **Implement Caching**:
   - Redis for API response caching
   - Database for route cost history

4. **Monitoring**:
   - Track API usage
   - Monitor error rates
   - Set up alerts for rate limits

---

## Quick Start Checklist

- [ ] Sign up for Amadeus developer account
- [ ] Get API Key and Secret
- [ ] Add to backend `.env` file
- [ ] Install `amadeus` npm package
- [ ] Create `amadeusProvider.js`
- [ ] Create `transportationService.js`
- [ ] Create `RouteCostHistory` model
- [ ] Create `/api/transportation` routes
- [ ] Register routes in main app
- [ ] Test backend endpoints
- [ ] Extend mobile `ApiService`
- [ ] Test mobile integration

---

## Resources

- **Amadeus Developer Portal**: https://developers.amadeus.com/
- **Amadeus API Docs**: https://developers.amadeus.com/self-service/category/air/api-doc/flight-offers-search
- **Amadeus Node.js SDK**: https://github.com/amadeus4dev/amadeus-node
- **API Reference**: https://developers.amadeus.com/get-started/apis-348

---

## Ready to Start?

1. **Get API credentials** (link above)
2. **Set up backend infrastructure** (follow steps above)
3. **Test with Postman** (verify API works)
4. **Build mobile screen** (FlightSearchScreen)
5. **Iterate and improve**

Let me know when you have the API credentials and we can start implementing! 🚀

