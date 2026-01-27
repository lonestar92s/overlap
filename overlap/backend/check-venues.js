const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flight-match-finder')
  .then(async () => {
    const Venue = mongoose.model('Venue', new mongoose.Schema({
      venueId: Number, 
      name: String, 
      country: String,
      coordinates: [Number]
    }));
    // Check venues with venueIds
    const venuesWithIds = await Venue.find({ venueId: { $exists: true } });
    // Check English venues with venueIds
    const englishVenuesWithIds = await Venue.find({ 
      venueId: { $exists: true }, 
      country: 'England' 
    });
    englishVenuesWithIds.forEach(v => {
    });
    await mongoose.disconnect();
  })
  .catch(console.error); 
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flight-match-finder')
  .then(async () => {
    const Venue = mongoose.model('Venue', new mongoose.Schema({
      venueId: Number, 
      name: String, 
      country: String,
      coordinates: [Number]
    }));
    // Check venues with venueIds
    const venuesWithIds = await Venue.find({ venueId: { $exists: true } });
    // Check English venues with venueIds
    const englishVenuesWithIds = await Venue.find({ 
      venueId: { $exists: true }, 
      country: 'England' 
    });
    englishVenuesWithIds.forEach(v => {
    });
    await mongoose.disconnect();
  })
  .catch(console.error); 
