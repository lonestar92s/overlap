const mongoose = require('mongoose');

/**
 * Route Cost History Model
 * Tracks historical prices for flight and train routes
 */
const routeCostHistorySchema = new mongoose.Schema({
  origin: {
    code: {
      type: String,
      required: true,
      index: true
    },
    name: String,
    city: String,
    country: String
  },
  destination: {
    code: {
      type: String,
      required: true,
      index: true
    },
    name: String,
    city: String,
    country: String
  },
  type: {
    type: String,
    enum: ['flight', 'train'],
    required: true,
    index: true
  },
  currency: {
    type: String,
    default: 'USD',
    required: true
  },
  priceHistory: [{
    date: {
      type: Date,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    },
    source: String, // 'amadeus', 'skyscanner', etc.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],
  // Multi-currency price history
  priceHistoryMultiCurrency: [{
    date: {
      type: Date,
      required: true
    },
    prices: {
      type: Map,
      of: Number // Map of currency code to price
    },
    source: String,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],
  // Aggregated statistics
  statistics: {
    minPrice: Number,
    maxPrice: Number,
    avgPrice: Number,
    lastUpdated: Date,
    sampleCount: Number
  },
  // Metadata
  lastSearched: Date,
  searchCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index for efficient route lookups
routeCostHistorySchema.index({ 
  'origin.code': 1, 
  'destination.code': 1, 
  type: 1 
});

// Index for date range queries
routeCostHistorySchema.index({ 
  'priceHistory.date': 1 
});

/**
 * Update price history with new price data
 */
routeCostHistorySchema.methods.addPricePoint = function(price, currency, source, metadata = {}) {
  const now = new Date();
  
  // Add to priceHistory
  this.priceHistory.push({
    date: now,
    price,
    currency,
    source,
    metadata
  });

  // Update statistics
  this.updateStatistics();
  
  // Update last searched
  this.lastSearched = now;
  this.searchCount += 1;
};

/**
 * Update aggregated statistics
 */
routeCostHistorySchema.methods.updateStatistics = function() {
  if (this.priceHistory.length === 0) return;

  const prices = this.priceHistory
    .filter(p => p.currency === this.currency)
    .map(p => p.price);

  if (prices.length > 0) {
    this.statistics = {
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      lastUpdated: new Date(),
      sampleCount: prices.length
    };
  }
};

/**
 * Get average price for a date range
 */
routeCostHistorySchema.methods.getAveragePrice = function(startDate, endDate) {
  const prices = this.priceHistory
    .filter(p => {
      const priceDate = new Date(p.date);
      return priceDate >= startDate && priceDate <= endDate && p.currency === this.currency;
    })
    .map(p => p.price);

  if (prices.length === 0) return null;

  return prices.reduce((a, b) => a + b, 0) / prices.length;
};

/**
 * Static method to find or create route cost history
 */
routeCostHistorySchema.statics.findOrCreate = async function(origin, destination, type, currency = 'USD') {
  const route = await this.findOne({
    'origin.code': origin,
    'destination.code': destination,
    type,
    currency
  });

  if (route) {
    return route;
  }

  // Create new route
  return await this.create({
    origin: { code: origin },
    destination: { code: destination },
    type,
    currency,
    priceHistory: [],
    priceHistoryMultiCurrency: [],
    statistics: {
      sampleCount: 0
    }
  });
};

const RouteCostHistory = mongoose.model('RouteCostHistory', routeCostHistorySchema);

module.exports = RouteCostHistory;

