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

    // Premier League venues missing coordinates
    const missingCoordinates = [
      {
        venueId: 556,
        name: 'Old Trafford',
        coordinates: [-2.2914, 53.4631] // [longitude, latitude]
      },
      {
        venueId: 535,
        name: 'Craven Cottage',
        coordinates: [-0.2219, 51.4749] // [longitude, latitude]
      },
      {
        venueId: 546,
        name: 'Elland Road',
        coordinates: [-1.5721, 53.7777] // [longitude, latitude]
      },
      {
        venueId: 8560,
        name: 'Goodison Park',
        coordinates: [-2.9664, 53.4389] // [longitude, latitude]
      }
    ];

    console.log('Adding missing coordinates...');
    
    for (const venue of missingCoordinates) {
      const result = await Venue.updateOne(
        { venueId: venue.venueId },
        { $set: { coordinates: venue.coordinates } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`✅ Added coordinates for ${venue.name} (ID: ${venue.venueId})`);
      } else {
        console.log(`⚠️ Could not find venue ${venue.name} (ID: ${venue.venueId})`);
      }
    }

    // Verify all Premier League venues now have coordinates
    const englishVenuesWithIds = await Venue.find({ 
      venueId: { $exists: true }, 
      country: 'England' 
    });
    
    console.log('\nVerification - All Premier League venues:');
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

    // Premier League venues missing coordinates
    const missingCoordinates = [
      {
        venueId: 556,
        name: 'Old Trafford',
        coordinates: [-2.2914, 53.4631] // [longitude, latitude]
      },
      {
        venueId: 535,
        name: 'Craven Cottage',
        coordinates: [-0.2219, 51.4749] // [longitude, latitude]
      },
      {
        venueId: 546,
        name: 'Elland Road',
        coordinates: [-1.5721, 53.7777] // [longitude, latitude]
      },
      {
        venueId: 8560,
        name: 'Goodison Park',
        coordinates: [-2.9664, 53.4389] // [longitude, latitude]
      }
    ];

    console.log('Adding missing coordinates...');
    
    for (const venue of missingCoordinates) {
      const result = await Venue.updateOne(
        { venueId: venue.venueId },
        { $set: { coordinates: venue.coordinates } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`✅ Added coordinates for ${venue.name} (ID: ${venue.venueId})`);
      } else {
        console.log(`⚠️ Could not find venue ${venue.name} (ID: ${venue.venueId})`);
      }
    }

    // Verify all Premier League venues now have coordinates
    const englishVenuesWithIds = await Venue.find({ 
      venueId: { $exists: true }, 
      country: 'England' 
    });
    
    console.log('\nVerification - All Premier League venues:');
    englishVenuesWithIds.forEach(v => {
      console.log(`- ${v.name} (ID: ${v.venueId}, Coordinates: ${v.coordinates ? 'Yes' : 'No'})`);
    });

    await mongoose.disconnect();
  })
  .catch(console.error); 
 