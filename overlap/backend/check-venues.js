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
    console.log('Venues with venueIds:', venuesWithIds.length);
    
    // Check English venues with venueIds
    const englishVenuesWithIds = await Venue.find({ 
      venueId: { $exists: true }, 
      country: 'England' 
    });
    console.log('English venues with venueIds:', englishVenuesWithIds.length);
    
    console.log('English venues with venueIds:');
    englishVenuesWithIds.forEach(v => {
      console.log(`- ${v.name} (ID: ${v.venueId}, Coordinates: ${v.coordinates ? 'Yes' : 'No'})`);
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
    console.log('Venues with venueIds:', venuesWithIds.length);
    
    // Check English venues with venueIds
    const englishVenuesWithIds = await Venue.find({ 
      venueId: { $exists: true }, 
      country: 'England' 
    });
    console.log('English venues with venueIds:', englishVenuesWithIds.length);
    
    console.log('English venues with venueIds:');
    englishVenuesWithIds.forEach(v => {
      console.log(`- ${v.name} (ID: ${v.venueId}, Coordinates: ${v.coordinates ? 'Yes' : 'No'})`);
    });

    await mongoose.disconnect();
  })
  .catch(console.error); 
 